const INTERNAL_RPC = new Set([
  "urania_worker_claim_job",
  "urania_worker_get_provider",
  "urania_worker_update_job",
  "urania_worker_store_search_results"
]);

function json(body, status=200) {
  return new Response(JSON.stringify(body), {status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
}

async function rpc(env, name, args) {
  if (!INTERNAL_RPC.has(name)) throw new Error("rpc_not_allowed");
  if (!env.SUPABASE_URL || !env.URANIA_INTERNAL_TOKEN) throw new Error("worker_backend_not_configured");
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/urania-internal-worker", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-urania-internal-token":env.URANIA_INTERNAL_TOKEN
    },
    body:JSON.stringify({action:name,...args})
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {error:"invalid_rpc_response"}; }
  if (!response.ok) throw new Error("rpc_" + name + "_http_" + response.status);
  return data;
}

async function setJobStatus(env, jobId, status, code=null, message=null) {
  return rpc(env,"urania_worker_update_job",{
    p_job_id:jobId,p_status:status,p_error_code:code,p_error_message:message
  });
}

async function failAndAck(message, env, code, description) {
  try { await setJobStatus(env,message.body.job_id,"failed",code,description); }
  catch (e) { console.error("failed_to_record_job_failure",String(e)); message.retry({delaySeconds:60}); return; }
  message.ack();
}

async function processMessage(message, env) {
  const job = message.body;
  if (!job || job.schema_version !== 1 || typeof job.job_id !== "string" || typeof job.job_type !== "string") {
    console.error("invalid_queue_message");
    message.ack();
    return;
  }
  let claim;
  try {
    claim = await rpc(env,"urania_worker_claim_job",{p_job_id:job.job_id});
  } catch (e) {
    console.error("job_claim_failed",String(e));
    message.retry({delaySeconds:60});
    return;
  }
  if (!claim?.claimed) {
    message.ack();
    return;
  }

  const providerKey = job.provider_key || "serpapi";
  let provider;
  try {
    provider = await rpc(env,"urania_worker_get_provider",{p_provider_key:providerKey});
  } catch (e) {
    await retryOrFail(message,env,job,"provider_lookup_failed","Provider lookup failed; inspect worker logs for details.");
    return;
  }
  if (provider?.status !== "active" || provider?.authorization_status !== "approved") {
    await failAndAck(message,env,"provider_not_authorized","Provider must be marked active and approved after API permission and license review.");
    return;
  }
  if (providerKey !== "serpapi") {
    await failAndAck(message,env,"provider_adapter_not_implemented","This provider has no worker adapter in the current release.");
    return;
  }
  const providerApiKey = provider?.api_key || env.SERPAPI_API_KEY;
  if (!providerApiKey) {
    await failAndAck(message,env,"provider_not_configured","Configure this provider credential in the Urania API Integration Center or set the server-side SERPAPI_API_KEY fallback.");
    return;
  }
  if (job.job_type !== "research.search" && job.job_type !== "research.refresh") {
    await failAndAck(message,env,"job_type_not_implemented","The current collector only supports research.search and research.refresh.");
    return;
  }

  const query = job.input_payload?.query;
  if (typeof query !== "string" || query.trim().length < 2 || query.length > 500) {
    await failAndAck(message,env,"invalid_search_query","A search query between 2 and 500 characters is required.");
    return;
  }

  const started = Date.now();
  try {
    const params = new URLSearchParams({
      engine:"google",
      q:query.trim(),
      api_key:providerApiKey,
      num:"10",
      hl:"en"
    });
    const market = String(job.market_country || "").toLowerCase();
    if (/^[a-z]{2}$/.test(market) && market !== "eu") params.set("gl",market);
    const response = await fetch("https://serpapi.com/search.json?" + params.toString(), {
      headers:{"accept":"application/json"},
      signal:AbortSignal.timeout(20000)
    });
    if (response.status === 401 || response.status === 403) {
      await failAndAck(message,env,"provider_auth_error","SerpApi rejected the configured credential. Verify the key and account status.");
      return;
    }
    if (response.status === 429 || response.status >= 500) {
      await retryOrFail(message,env,job,"provider_transient_error","SerpApi returned a retryable HTTP status " + response.status);
      return;
    }
    const payload = await response.json();
    if (!response.ok || payload.error) {
      await failAndAck(message,env,"provider_request_error","Search provider rejected the request; inspect worker logs for details.");
      return;
    }
    const results = Array.isArray(payload.organic_results) ? payload.organic_results.slice(0,10).map((r) => ({
      position:r.position,
      title:r.title,
      link:r.link,
      snippet:r.snippet,
      displayed_link:r.displayed_link
    })) : [];
    await rpc(env,"urania_worker_store_search_results",{
      p_job_id:job.job_id,
      p_provider_key:providerKey,
      p_query:query.trim(),
      p_market_country:job.market_country || null,
      p_results:results,
      p_latency_ms:Date.now()-started
    });
    message.ack();
  } catch (e) {
    await retryOrFail(message,env,job,"provider_or_storage_error","Provider request or result storage failed; inspect worker logs for details.");
  }
}

async function retryOrFail(message, env, job, code, description) {
  try {
    const result = await setJobStatus(env,job.job_id,"retry",code,description);
    if (result?.status === "dead_letter") {
      if (!env.URANIA_DLQ) throw new Error("dead_letter_queue_binding_missing");
      await env.URANIA_DLQ.send({...job, dead_lettered_at:new Date().toISOString(), error_code:code, error_message:description});
      message.ack();
      return;
    }
    message.retry({delaySeconds:60});
  } catch (e) {
    console.error("retry_state_update_failed",String(e));
    message.retry({delaySeconds:60});
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({status:"ok",service:"urania-queue-consumer",version:"0.2.0",serpapiConfigured:Boolean(env.SERPAPI_API_KEY),internalTokenConfigured:Boolean(env.URANIA_INTERNAL_TOKEN)});
    }
    return json({error:"not_found"},404);
  },
  async queue(batch, env) {
    await Promise.all(batch.messages.map(message => processMessage(message,env)));
  }
};
