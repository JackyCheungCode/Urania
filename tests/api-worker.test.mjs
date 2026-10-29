import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../workers/api/src/index.js";

const baseEnv = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  ALLOWED_ORIGINS: "https://app.example.com",
};

test("health endpoint is public and reports only non-secret configuration state", async () => {
  const response = await handle(new Request("https://api.example.com/health"), baseEnv);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.service, "urania-api");
  assert.equal(body.supabaseConfigured, true);
  assert.equal(JSON.stringify(body).includes("test-publishable-key"), false);
});

test("unknown origins are rejected before routing", async () => {
  const response = await handle(new Request("https://api.example.com/health", {
    headers: { Origin: "https://attacker.example" },
  }), baseEnv);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "origin_not_allowed" });
});

test("approved origins receive explicit CORS headers", async () => {
  const response = await handle(new Request("https://api.example.com/health", {
    headers: { Origin: "https://app.example.com" },
  }), baseEnv);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://app.example.com");
  assert.match(response.headers.get("vary") || "", /Origin/i);
});

test("RPC proxy rejects unknown function names without making upstream calls", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("unexpected upstream request"); };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await handle(new Request("https://api.example.com/api/v1/rpc/urania_delete_everything", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }), baseEnv);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "rpc_not_allowed" });
});

test("RPC proxy requires a bearer token before contacting Supabase", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("unexpected upstream request"); };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await handle(new Request("https://api.example.com/api/v1/rpc/urania_list_products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ p_limit: 10 }),
  }), baseEnv);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "authentication_required" });
});

test("admin-only RPC is denied to a researcher even with a valid session", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.equal(String(url), "https://project.supabase.co/auth/v1/user");
    return new Response(JSON.stringify({
      id: "user-researcher",
      app_metadata: { urania_role: "researcher" },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await handle(new Request("https://api.example.com/api/v1/rpc/urania_set_provider_state", {
    method: "POST",
    headers: { authorization: "Bearer valid-test-token", "content-type": "application/json" },
    body: JSON.stringify({ p_provider_key: "serpapi" }),
  }), baseEnv);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "role_not_allowed" });
  assert.equal(calls, 1);
});

test("researchers can request their authorized collection job history", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(String(url));
    if (String(url).endsWith("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "user-researcher", app_metadata: { urania_role: "researcher" } }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }
    assert.equal(String(url), "https://project.supabase.co/rest/v1/rpc/urania_list_collection_jobs");
    assert.equal(init.method, "POST");
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await handle(new Request("https://api.example.com/api/v1/rpc/urania_list_collection_jobs", {
    method: "POST",
    headers: { authorization: "Bearer valid-test-token", "content-type": "application/json" },
    body: JSON.stringify({ p_limit: 20 }),
  }), baseEnv);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [] });
  assert.equal(calls.length, 2);
});


test("placeholder Supabase publishable key is treated as unconfigured", async () => {
  const response = await handle(new Request("https://api.example.com/health"), {
    ...baseEnv,
    SUPABASE_PUBLISHABLE_KEY: "CONFIGURE_IN_CLOUDFLARE_DASHBOARD",
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).supabaseConfigured, false);
});

test("RPC returns a safe actionable message for backend permission errors", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    if (String(url).endsWith("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "user-sales", app_metadata: { urania_role: "sales" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ code: "42501", message: "permission denied", details: "internal" }), { status: 403 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const response = await handle(new Request("https://api.example.com/api/v1/rpc/urania_create_account", {
    method: "POST", headers: { authorization: "Bearer valid-test-token", "content-type": "application/json" }, body: JSON.stringify({ p_company_name: "Example Ltd" }),
  }), baseEnv);
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.code, "42501");
  assert.match(body.message, /权限不足/);
  assert.equal(JSON.stringify(body).includes("internal"), false);
  assert.equal(calls, 2);
});


test("provider credential RPC is admin-only and does not echo credential values", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({url:String(url),body:init.body});
    if (String(url).endsWith("/auth/v1/user")) {
      return new Response(JSON.stringify({ id:"user-admin", app_metadata:{urania_role:"admin"} }), {status:200});
    }
    return new Response(JSON.stringify({data:{provider_key:"serpapi",credential_configured:true,status:"configured"}}), {status:200});
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const response = await handle(new Request("https://api.example.com/api/v1/rpc/urania_set_provider_credential", {
    method:"POST",
    headers:{authorization:"Bearer valid-test-token","content-type":"application/json"},
    body:JSON.stringify({p_provider_key:"serpapi",p_api_key:"test-provider-secret-123"}),
  }), baseEnv);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.data.credential_configured,true);
  assert.equal(JSON.stringify(body).includes("test-provider-secret-123"),false);
  assert.equal(calls.length,2);
  assert.match(calls[1].body,/test-provider-secret-123/);
});

test("approval queue RPCs are restricted to authorized sales roles", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(String(url));
    if (String(url).endsWith("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "user-sales", app_metadata: { urania_role: "sales" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await handle(new Request("https://api.example.com/api/v1/rpc/urania_list_approvals", {
    method: "POST",
    headers: { authorization: "Bearer valid-test-token", "content-type": "application/json" },
    body: JSON.stringify({ p_limit: 20 }),
  }), baseEnv);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [] });
  assert.equal(calls.length, 2);
  assert.equal(calls[1], "https://project.supabase.co/rest/v1/rpc/urania_list_approvals");
});

test("first-contact email approval creation RPC is restricted and forwarded for sales", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(String(url));
    if (String(url).endsWith("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "user-sales", app_metadata: { urania_role: "sales" } }), { status: 200 });
    }
    assert.match(String(url), /\/rest\/v1\/rpc\/urania_create_email_approval$/);
    const body = JSON.parse(init.body);
    assert.equal(body.p_contact_id, "contact-1");
    assert.equal(body.p_subject, "Introductory note");
    return new Response(JSON.stringify({ data: { status: "pending" } }), { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const response = await handle(new Request("https://api.example.com/api/v1/rpc/urania_create_email_approval", {
    method: "POST",
    headers: { authorization: "Bearer valid-test-token", "content-type": "application/json" },
    body: JSON.stringify({ p_contact_id: "contact-1", p_subject: "Introductory note", p_body: "A proposed email body with enough detail." }),
  }), baseEnv);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, "pending");
  assert.equal(calls.length, 2);
});
