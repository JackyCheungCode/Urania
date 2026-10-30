import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ACTIONS = new Set([
  "urania_worker_claim_job",
  "urania_worker_get_provider",
  "urania_worker_update_job",
  "urania_worker_store_search_results",
  "urania_worker_save_ai_research",
]);

const corsHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
  const token = request.headers.get("x-urania-internal-token");
  if (!token || token.length < 32) return respond({ error: "authentication_required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return respond({ error: "internal_backend_not_configured" }, 503);

  let payload: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 16_384) return respond({ error: "payload_too_large" }, 413);
    payload = JSON.parse(raw);
    if (!payload || Array.isArray(payload) || typeof payload !== "object") throw new Error("invalid_payload");
  } catch {
    return respond({ error: "invalid_json" }, 400);
  }

  const action = payload.action;
  if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) return respond({ error: "action_not_allowed" }, 404);
  const { action: _ignored, ...args } = payload;
  const upstream = await fetch(supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/" + action, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: "Bearer " + serviceRoleKey,
      "content-type": "application/json",
      "accept-profile": "public",
      "content-profile": "public",
    },
    body: JSON.stringify({ p_internal_token: token, ...args }),
  });

  const bodyText = await upstream.text();
  let result: unknown = {};
  try { result = JSON.parse(bodyText); } catch { result = { error: "invalid_database_response" }; }
  if (upstream.ok) return respond(result, 200);
  if (upstream.status === 401 || upstream.status === 403) return respond({ error: "forbidden" }, 403);
  if (upstream.status === 404) return respond({ error: "not_found" }, 404);
  return respond({ error: "internal_rpc_failed", upstream_status: upstream.status }, 502);
});
