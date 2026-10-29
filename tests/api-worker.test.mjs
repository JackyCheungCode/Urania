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
