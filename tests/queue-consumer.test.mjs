import test from "node:test";
import assert from "node:assert/strict";
import consumer from "../workers/queue-consumer/src/index.js";

function makeMessage(body) {
  const calls = { ack: 0, retry: [] };
  return {
    body,
    ack() { calls.ack += 1; },
    retry(options) { calls.retry.push(options); },
    calls,
  };
}

function rpcResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("health endpoint reports service health without exposing secrets", async () => {
  const response = await consumer.fetch(new Request("https://worker.example/health"), {
    SERPAPI_API_KEY: "test-secret",
    URANIA_INTERNAL_TOKEN: "internal-test-token",
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.service, "urania-queue-consumer");
  assert.equal(body.serpapiConfigured, true);
  assert.equal(body.internalTokenConfigured, true);
  assert.equal(JSON.stringify(body).includes("test-secret"), false);
});

test("malformed queue messages are acknowledged and never call the backend", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("unexpected network call"); };
  t.after(() => { globalThis.fetch = originalFetch; });

  const message = makeMessage({ schema_version: 2, job_id: "job-1", job_type: "research.search" });
  await consumer.queue({ messages: [message] }, {});
  assert.equal(message.calls.ack, 1);
  assert.deepEqual(message.calls.retry, []);
});

test("already-claimed jobs are acknowledged without duplicate processing", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(init.body);
    calls.push(payload.action);
    return rpcResponse({ claimed: false });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const message = makeMessage({
    schema_version: 1,
    job_id: "job-duplicate",
    job_type: "research.search",
    input_payload: { query: "test query" },
  });
  await consumer.queue({ messages: [message] }, {
    SUPABASE_URL: "https://project.supabase.co",
    URANIA_INTERNAL_TOKEN: "test-internal-token",
  });
  assert.equal(message.calls.ack, 1);
  assert.deepEqual(calls, ["urania_worker_claim_job"]);
});

test("unapproved providers fail closed before any third-party request", async (t) => {
  const originalFetch = globalThis.fetch;
  const actions = [];
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(init.body);
    actions.push(payload.action);
    if (payload.action === "urania_worker_claim_job") return rpcResponse({ claimed: true });
    if (payload.action === "urania_worker_get_provider") {
      return rpcResponse({ status: "inactive", authorization_status: "pending" });
    }
    if (payload.action === "urania_worker_update_job") return rpcResponse({ status: "failed" });
    throw new Error("unexpected action " + payload.action);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const message = makeMessage({
    schema_version: 1,
    job_id: "job-unapproved",
    job_type: "research.search",
    provider_key: "serpapi",
    input_payload: { query: "test query" },
  });
  await consumer.queue({ messages: [message] }, {
    SUPABASE_URL: "https://project.supabase.co",
    URANIA_INTERNAL_TOKEN: "test-internal-token",
    SERPAPI_API_KEY: "test-serpapi-key",
  });
  assert.equal(message.calls.ack, 1);
  assert.deepEqual(message.calls.retry, []);
  assert.deepEqual(actions, [
    "urania_worker_claim_job",
    "urania_worker_get_provider",
    "urania_worker_update_job",
  ]);
});

test("backend claim failures retry rather than silently dropping jobs", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("temporary network error"); };
  t.after(() => { globalThis.fetch = originalFetch; });

  const message = makeMessage({
    schema_version: 1,
    job_id: "job-retry",
    job_type: "research.search",
    input_payload: { query: "test query" },
  });
  await consumer.queue({ messages: [message] }, {
    SUPABASE_URL: "https://project.supabase.co",
    URANIA_INTERNAL_TOKEN: "test-internal-token",
  });
  assert.equal(message.calls.ack, 0);
  assert.deepEqual(message.calls.retry, [{ delaySeconds: 60 }]);
});

test("provider error payloads are not persisted verbatim", async (t) => {
  const originalFetch = globalThis.fetch;
  const updates = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("serpapi.com")) {
      return rpcResponse({ error: "upstream echoed credential=do-not-store-this" }, 400);
    }
    const payload = JSON.parse(init.body);
    if (payload.action === "urania_worker_claim_job") return rpcResponse({ claimed: true });
    if (payload.action === "urania_worker_get_provider") {
      return rpcResponse({ status: "active", authorization_status: "approved", api_key: "test-key" });
    }
    if (payload.action === "urania_worker_update_job") {
      updates.push(payload);
      return rpcResponse({ status: "failed" });
    }
    throw new Error("unexpected request " + url);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const message = makeMessage({
    schema_version: 1, job_id: "job-provider-error", job_type: "research.search",
    provider_key: "serpapi", input_payload: { query: "test query" },
  });
  await consumer.queue({ messages: [message] }, {
    SUPABASE_URL: "https://project.supabase.co", URANIA_INTERNAL_TOKEN: "test-internal-token",
  });
  assert.equal(message.calls.ack, 1);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].p_error_code, "provider_request_error");
  assert.match(updates[0].p_error_message, /inspect worker logs/i);
  assert.equal(updates[0].p_error_message.includes("do-not-store-this"), false);
});

test("Apollo company discovery maps organization results into normalized research records", async (t) => {
  const originalFetch=globalThis.fetch; const stored=[];
  globalThis.fetch=async (url,init={})=>{
    if(String(url).includes("api.apollo.io")){
      assert.equal(init.method,"POST");
      assert.equal(new Headers(init.headers).get("x-api-key"),"apollo-test-key");
      return rpcResponse({organizations:[{id:"org-1",name:"Example Ltd",website_url:"https://example.com",primary_domain:"example.com",industry:"Retail",estimated_num_employees:120,country:"GB"}]});
    }
    const body=JSON.parse(init.body);
    if(body.action==="urania_worker_claim_job")return rpcResponse({claimed:true});
    if(body.action==="urania_worker_get_provider")return rpcResponse({status:"active",authorization_status:"approved",api_key:"apollo-test-key"});
    if(body.action==="urania_worker_store_search_results"){stored.push(body);return rpcResponse({status:"succeeded"});}
    throw new Error("unexpected action "+body.action);
  };
  t.after(()=>{globalThis.fetch=originalFetch;});
  const message=makeMessage({schema_version:1,job_id:"job-apollo",job_type:"crm.company_discovery",provider_key:"apollo",input_payload:{query:"sustainable home retailers"}});
  await consumer.queue({messages:[message]},{SUPABASE_URL:"https://project.supabase.co",URANIA_INTERNAL_TOKEN:"test-token"});
  assert.equal(message.calls.ack,1);
  assert.equal(stored.length,1);
  assert.equal(stored[0].p_provider_key,"apollo");
  assert.equal(stored[0].p_results[0].title,"Example Ltd");
  assert.equal(stored[0].p_results[0].displayed_link,"example.com");
});

test("Hunter contact enrichment requires purpose and lawful basis and keeps API key out of URLs", async (t) => {
  const originalFetch=globalThis.fetch; const stored=[];
  globalThis.fetch=async (url,init={})=>{
    if(String(url).includes("api.hunter.io")){
      assert.equal(String(url).includes("hunter-test-key"),false);
      assert.equal(new Headers(init.headers).get("X-API-KEY"),"hunter-test-key");
      return rpcResponse({data:{emails:[{value:"buyer@example.com",first_name:"Alex",last_name:"Buyer",position:"Procurement",department:"purchasing",confidence:94,verification:{status:"valid"}}]}});
    }
    const body=JSON.parse(init.body);
    if(body.action==="urania_worker_claim_job")return rpcResponse({claimed:true});
    if(body.action==="urania_worker_get_provider")return rpcResponse({status:"active",authorization_status:"approved",api_key:"hunter-test-key"});
    if(body.action==="urania_worker_store_search_results"){stored.push(body);return rpcResponse({status:"succeeded"});}
    throw new Error("unexpected action "+body.action);
  };
  t.after(()=>{globalThis.fetch=originalFetch;});
  const message=makeMessage({schema_version:1,job_id:"job-hunter",job_type:"crm.contact_enrichment",provider_key:"hunter",market_country:"GB",input_payload:{query:"example.com",domain:"example.com",lawful_basis:"legitimate_interest",purpose:"B2B supplier research and relevant product introduction"}});
  await consumer.queue({messages:[message]},{SUPABASE_URL:"https://project.supabase.co",URANIA_INTERNAL_TOKEN:"test-token"});
  assert.equal(message.calls.ack,1);
  assert.equal(stored.length,1);
  assert.equal(stored[0].p_results[0].email,"buyer@example.com");
  assert.match(stored[0].p_results[0].snippet,/Procurement/);
});

test("Hunter contact enrichment fails closed when lawful basis is missing", async (t) => {
  const originalFetch=globalThis.fetch; const actions=[];
  globalThis.fetch=async (_url,init={})=>{
    const body=JSON.parse(init.body);actions.push(body.action);
    if(body.action==="urania_worker_claim_job")return rpcResponse({claimed:true});
    if(body.action==="urania_worker_get_provider")return rpcResponse({status:"active",authorization_status:"approved",api_key:"hunter-test-key"});
    if(body.action==="urania_worker_update_job")return rpcResponse({status:"failed"});
    throw new Error("third-party request must not run");
  };
  t.after(()=>{globalThis.fetch=originalFetch;});
  const message=makeMessage({schema_version:1,job_id:"job-hunter-blocked",job_type:"crm.contact_enrichment",provider_key:"hunter",market_country:"GB",input_payload:{query:"example.com",domain:"example.com",purpose:"B2B supplier research and relevant product introduction"}});
  await consumer.queue({messages:[message]},{SUPABASE_URL:"https://project.supabase.co",URANIA_INTERNAL_TOKEN:"test-token"});
  assert.equal(message.calls.ack,1);
  assert.deepEqual(actions,["urania_worker_claim_job","urania_worker_get_provider","urania_worker_update_job"]);
});
