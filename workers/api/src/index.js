const ALLOWED_RPCS = {
  urania_list_accounts: { method: "POST", roles: ["admin", "sales", "researcher"] },
  urania_create_account: { method: "POST", roles: ["admin", "sales"] },
  urania_list_leads: { method: "POST", roles: ["admin", "sales", "researcher"] },
  urania_create_lead: { method: "POST", roles: ["admin", "sales"] },
  urania_list_products: { method: "POST", roles: ["admin", "researcher", "sales"] },
  urania_list_data_sources: { method: "POST", roles: ["admin", "researcher"] },
  urania_create_collection_job: { method: "POST", roles: ["admin", "researcher"] }
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers }
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return { origin: null, allowed: true };
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
  return { origin, allowed: allowed.includes(origin) };
}

function corsHeaders(origin) {
  return origin ? {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-max-age": "600",
    "vary": "Origin"
  } : {};
}

async function handle(request, env) {
  const url = new URL(request.url);
  const cors = allowedOrigin(request, env);
  if (!cors.allowed) return json({ error: "origin_not_allowed" }, 403, { vary: "Origin" });
  const headers = corsHeaders(cors.origin);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (url.pathname === "/health" && request.method === "GET") {
    return json({
      status: "ok",
      service: "urania-api",
      version: "0.2.0",
      supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY),
      timestamp: new Date().toISOString()
    }, 200, headers);
  }
  if (url.pathname === "/api/v1/status" && request.method === "GET") {
    return json({
      service: "urania-api",
      version: "0.2.0",
      endpoints: ["GET /health", "GET /api/v1/status", "POST /api/v1/rpc/:allowlisted_function"],
      auth: "Supabase access token required for RPC calls",
      dataProviders: "catalog only; third-party providers are not configured by this API"
    }, 200, headers);
  }
  const match = url.pathname.match(/^\/api\/v1\/rpc\/([a-z_]+)$/);
  if (!match) return json({ error: "not_found" }, 404, headers);
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, headers);
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ error: "backend_not_configured" }, 503, headers);

  const functionName = match[1];
  const policy = ALLOWED_RPCS[functionName];
  if (!policy) return json({ error: "rpc_not_allowed" }, 404, headers);
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401, headers);

  const authResponse = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authorization }
  });
  if (!authResponse.ok) return json({ error: "invalid_session" }, 401, headers);
  const user = await authResponse.json();
  const role = user?.app_metadata?.urania_role;
  if (!policy.roles.includes(role)) return json({ error: "role_not_allowed" }, 403, headers);

  let payload;
  try {
    const text = await request.text();
    if (text.length > 16384) return json({ error: "payload_too_large" }, 413, headers);
    payload = JSON.parse(text || "{}");
    if (!payload || Array.isArray(payload) || typeof payload !== "object") throw new Error("invalid_object");
  } catch {
    return json({ error: "invalid_json" }, 400, headers);
  }

  const rpcResponse = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + functionName, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization,
      "Content-Type": "application/json",
      "Accept-Profile": "public",
      "Content-Profile": "public"
    },
    body: JSON.stringify(payload)
  });
  const responseText = await rpcResponse.text();
  let responseBody;
  try { responseBody = JSON.parse(responseText); } catch { responseBody = { error: "invalid_upstream_response" }; }
  return json(responseBody, rpcResponse.status, headers);
}

addEventListener("fetch", event => {
  event.respondWith(handle(event.request, {
    SUPABASE_URL: typeof SUPABASE_URL === "undefined" ? "" : SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: typeof SUPABASE_PUBLISHABLE_KEY === "undefined" ? "" : SUPABASE_PUBLISHABLE_KEY,
    ALLOWED_ORIGINS: typeof ALLOWED_ORIGINS === "undefined" ? "" : ALLOWED_ORIGINS
  }));
});
