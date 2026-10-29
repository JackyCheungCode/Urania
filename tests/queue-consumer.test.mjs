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
