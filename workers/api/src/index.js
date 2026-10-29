const ALLOWED_RPCS = {
  urania_list_accounts: { method: "POST", roles: ["admin", "sales", "researcher"] },
  urania_create_account: { method: "POST", roles: ["admin", "sales"] },
  urania_list_leads: { method: "POST", roles: ["admin", "sales", "researcher"] },
  urania_create_lead: { method: "POST", roles: ["admin", "sales"] },
  urania_list_products: { method: "POST", roles: ["admin", "researcher", "sales"] },
  urania_create_product: { method: "POST", roles: ["admin", "researcher"] },
  urania_list_data_sources: { method: "POST", roles: ["admin", "researcher"] },
  urania_create_collection_job: { method: "POST", roles: ["admin", "researcher"] },
  urania_set_provider_state: { method: "POST", roles: ["admin"] },
  urania_list_contacts: { method: "POST", roles: ["admin", "sales"] },
  urania_create_contact: { method: "POST", roles: ["admin", "sales"] },
  urania_list_opportunities: { method: "POST", roles: ["admin", "sales"] },
  urania_create_opportunity: { method: "POST", roles: ["admin", "sales"] }
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
  let projectPreview = false;
  try { projectPreview = new URL(origin).protocol === "https:" && new URL(origin).hostname.endsWith(".urania-preview.pages.dev"); } catch {}
  return { origin, allowed: allowed.includes(origin) || projectPreview };
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
      endpoints: ["GET /health", "GET /api/v1/status", "POST /api/v1/rpc/:allowlisted_function", "POST /api/v1/jobs"],
      auth: "Supabase access token required for RPC calls",
      dataProviders: "catalog only; third-party providers are not configured by this API"
    }, 200, headers);
  }
  if (url.pathname === "/api/v1/jobs" && request.method === "POST") {
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ error: "backend_not_configured" }, 503, headers);
    if (!env.URANIA_JOBS || typeof env.URANIA_JOBS.send !== "function") return json({ error: "queue_not_configured" }, 503, headers);
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401, headers);
    const authResponse = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authorization }
    });
    if (!authResponse.ok) return json({ error: "invalid_session" }, 401, headers);
    const user = await authResponse.json();
    if (!["admin", "researcher"].includes(user?.app_metadata?.urania_role)) return json({ error: "role_not_allowed" }, 403, headers);
    let job;
    try {
      const text = await request.text();
      if (text.length > 16384) return json({ error: "payload_too_large" }, 413, headers);
      job = JSON.parse(text || "{}");
      if (!job || Array.isArray(job) || typeof job !== "object") throw new Error("invalid_object");
    } catch {
      return json({ error: "invalid_json" }, 400, headers);
    }
    const allowedJobTypes = ["research.search", "research.refresh", "provider.health_check", "product.enrich", "crm.company_discovery"];
    if (!allowedJobTypes.includes(job.job_type)) return json({ error: "job_type_not_allowed" }, 400, headers);
    if (typeof job.idempotency_key !== "string" || job.idempotency_key.length < 8 || job.idempotency_key.length > 160) {
      return json({ error: "invalid_idempotency_key" }, 400, headers);
    }
    const createResponse = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/urania_create_collection_job", {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: authorization,
        "Content-Type": "application/json",
        "Accept-Profile": "public",
        "Content-Profile": "public"
      },
      body: JSON.stringify({
        p_job_type: job.job_type,
        p_provider_key: job.provider_key || null,
        p_market_country: job.market_country || null,
        p_input_payload: job.input_payload || {},
        p_idempotency_key: job.idempotency_key
      })
    });
    const createText = await createResponse.text();
    let created;
    try { created = JSON.parse(createText); } catch { created = null; }
    if (!createResponse.ok || !created?.data?.id) return json({ error: "job_record_failed", detail: created }, createResponse.status || 502, headers);
    const message = {
      schema_version: 1,
      job_id: created.data.id,
      job_type: job.job_type,
      provider_key: job.provider_key || null,
      market_country: job.market_country || null,
      input_payload: job.input_payload || {},
      idempotency_key: job.idempotency_key,
      requested_by: user.id,
      created_at: new Date().toISOString()
    };
    try {
      await env.URANIA_JOBS.send(message);
    } catch {
      return json({ error: "queue_publish_failed", job_id: created.data.id, retry_with_same_idempotency_key: true }, 503, headers);
    }
    return json({ data: { id: created.data.id, status: created.data.status || "queued", queued: true } }, 202, headers);
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
    ALLOWED_ORIGINS: typeof ALLOWED_ORIGINS === "undefined" ? "" : ALLOWED_ORIGINS,
    URANIA_JOBS: typeof URANIA_JOBS === "undefined" ? null : URANIA_JOBS
  }));
});
