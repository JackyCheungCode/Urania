const ALLOWED_RPCS = {
  urania_list_accounts: { method: "POST", roles: ["admin", "sales", "researcher"] },
  urania_create_account: { method: "POST", roles: ["admin", "sales"] },
  urania_list_leads: { method: "POST", roles: ["admin", "sales", "researcher"] },
  urania_create_lead: { method: "POST", roles: ["admin", "sales"] },
  urania_list_products: { method: "POST", roles: ["admin", "researcher", "sales"] },
  urania_create_product: { method: "POST", roles: ["admin", "researcher"] },
  urania_list_data_sources: { method: "POST", roles: ["admin", "researcher"] },
  urania_create_collection_job: { method: "POST", roles: ["admin", "researcher"] },
  urania_list_collection_jobs: { method: "POST", roles: ["admin", "researcher"] },
  urania_set_provider_state: { method: "POST", roles: ["admin"] },
  urania_set_provider_credential: { method: "POST", roles: ["admin"] },
  urania_list_contacts: { method: "POST", roles: ["admin", "sales"] },
  urania_create_contact: { method: "POST", roles: ["admin", "sales"] },
  urania_list_opportunities: { method: "POST", roles: ["admin", "sales"] },
  urania_create_opportunity: { method: "POST", roles: ["admin", "sales"] },
  urania_list_activities: { method: "POST", roles: ["admin", "sales"] },
  urania_create_activity: { method: "POST", roles: ["admin", "sales"] },
  urania_list_quotes: { method: "POST", roles: ["admin", "sales"] },
  urania_create_quote: { method: "POST", roles: ["admin", "sales"] },
  urania_set_quote_status: { method: "POST", roles: ["admin", "sales"] },
  urania_list_approvals: { method: "POST", roles: ["admin", "sales"] },
  urania_review_approval: { method: "POST", roles: ["admin", "sales"] },
  urania_create_email_approval: { method: "POST", roles: ["admin", "sales"] },
  urania_list_orders: { method: "POST", roles: ["admin", "sales"] },
  urania_create_order: { method: "POST", roles: ["admin", "sales"] },
  urania_create_profit_scenario: { method: "POST", roles: ["admin", "researcher", "sales"] },
  urania_create_product_score: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_create_project: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_list_projects: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_create_opportunity: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_list_opportunities: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_create_finding: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_create_evidence_source: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_create_evidence_record: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_list_evidence: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_list_evidence_sources: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_save_financial_model: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_list_financial_models: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_create_risk: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_list_risks: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_review_risk: { method: "POST", roles: ["admin"] },
  urania_research_verify_evidence: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_list_findings: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_submit_decision: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_approve_decision: { method: "POST", roles: ["admin"] },
  urania_research_list_decisions: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_save_assumption: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_list_assumptions: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_list_audit_events: { method: "POST", roles: ["admin", "researcher"] },
  urania_research_list_search_results: { method: "POST", roles: ["admin", "researcher"] }
};

function isConfiguredValue(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return Boolean(normalized && !/^(CONFIGURE_IN_CLOUDFLARE_DASHBOARD|CHANGE_ME|TODO|PLACEHOLDER)$/i.test(normalized));
}

function backendConfigured(env) {
  return isConfiguredValue(env.SUPABASE_URL) && isConfiguredValue(env.SUPABASE_PUBLISHABLE_KEY);
}

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

export async function handle(request, env) {
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
      supabaseConfigured: backendConfigured(env),
      timestamp: new Date().toISOString()
    }, 200, headers);
  }
  if (url.pathname === "/api/v1/status" && request.method === "GET") {
    return json({
      service: "urania-api",
      version: "0.2.0",
      endpoints: ["GET /health", "GET /api/v1/status", "POST /api/v1/rpc/:allowlisted_function", "POST /api/v1/jobs"],
      auth: "Supabase access token required for RPC calls",
      dataProviders: "approved server-side providers only; credentials remain in Supabase Vault; AI analysis does not imply live web research"
    }, 200, headers);
  }
  if (url.pathname === "/api/v1/jobs" && request.method === "POST") {
    if (!backendConfigured(env)) return json({ error: "backend_not_configured", message: "Supabase 后端尚未正确配置。请在 Cloudflare Worker 中设置有效的 SUPABASE_URL 和 SUPABASE_PUBLISHABLE_KEY。" }, 503, headers);
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
    const allowedJobTypes = ["research.search", "research.refresh", "research.ai_analysis", "provider.health_check", "product.enrich", "crm.company_discovery", "crm.contact_enrichment"];
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
  if (!backendConfigured(env)) return json({ error: "backend_not_configured", message: "Supabase 后端尚未正确配置。请在 Cloudflare Worker 中设置有效的 SUPABASE_URL 和 SUPABASE_PUBLISHABLE_KEY。" }, 503, headers);

  const functionName = match[1];
  const policy = ALLOWED_RPCS[functionName];
  if (!policy) return json({ error: "rpc_not_allowed" }, 404, headers);
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401, headers);

  let authResponse;
  try {
    authResponse = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authorization }
    });
  } catch {
    return json({ error: "upstream_unavailable", message: "认证服务暂时不可达，请稍后重试。" }, 502, headers);
  }
  if (authResponse.status === 401 || authResponse.status === 403) return json({ error: "invalid_session", message: "登录会话已失效，请重新登录。" }, 401, headers);
  if (!authResponse.ok) return json({ error: "auth_upstream_error", message: "认证服务返回异常，请检查 Supabase 后端配置。" }, 502, headers);
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

  let rpcResponse;
  try {
    rpcResponse = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + functionName, {
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
  } catch {
    return json({ error: "upstream_unavailable", message: "数据库服务暂时不可达，请稍后重试。" }, 502, headers);
  }
  const responseText = await rpcResponse.text();
  let responseBody;
  try { responseBody = JSON.parse(responseText); } catch { responseBody = { error: "invalid_upstream_response" }; }
  if (!rpcResponse.ok && responseBody && typeof responseBody === "object") {
    const code = typeof responseBody.code === "string" ? responseBody.code : undefined;
    const message = typeof responseBody.message === "string" ? responseBody.message : undefined;
    const errorMap = {
      "42501": "权限不足：请确认当前账号已分配正确的 Urania 角色。",
      "P0002": "请求的数据不存在，请刷新页面后重试。",
      "22023": "提交的数据不符合要求，请检查必填项和字段格式。",
      "23505": "记录可能已存在，请检查是否重复创建。"
    };
    responseBody = { error: responseBody.error || "database_request_failed", ...(code ? { code } : {}), message: errorMap[code] || message || "数据库操作失败，请检查字段和后端配置。" };
  }
  return json(responseBody, rpcResponse.status, headers);
}

export default { fetch: handle };
