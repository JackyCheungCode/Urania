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


const AI_PROVIDERS = {
  openai_api: { model: "gpt-4.1-mini" },
  anthropic_api: { model: "claude-sonnet-4-5" },
  google_gemini_api: { model: "gemini-2.5-flash" }
};
const VALID_STAGES = new Set(["discovery","standardization","demand","competition","customer","supply_chain","compliance","financial","investment","monitoring"]);
function researchPrompt(job) {
  const stage = VALID_STAGES.has(job.input_payload?.stage) ? job.input_payload.stage : "discovery";
  const context = typeof job.input_payload?.context === "string" ? job.input_payload.context.slice(0,12000) : "";
  return {
    stage, system: "You are a rigorous commercial research analyst. Analyze only the user-provided query and context. Never invent facts, market sizes, named sources, citations, URLs, interviews, customer behavior, or observed transactions. Explicitly state uncertainty and data gaps. Do not present estimates as observations. Return only valid JSON with keys summary and findings. findings is an array of at most 8 objects with stage, finding_type (claim|observation|estimate|contradiction|gap), claim, explanation, confidence (0..1 or null). Every generated finding must remain unverified and evidence-insufficient. No investment approval or recommendation.",
    user: JSON.stringify({ research_question: String(job.input_payload?.query||"").slice(0,500), stage, provided_context: context,
      required_output: { summary: "brief analysis and limitations", findings: [{stage, finding_type:"claim", claim:"...", explanation:"...", confidence:null}] } })
  };
}
async function requestAI(providerKey, apiKey, job) {
  const config=AI_PROVIDERS[providerKey];
  if(!config) throw new Error("ai_provider_not_supported");
  const prompt=researchPrompt(job);
  let response, raw;
  if(providerKey==="openai_api") {
    response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"authorization":"Bearer "+apiKey,"content-type":"application/json"},body:JSON.stringify({model:config.model,temperature:0.1,response_format:{type:"json_object"},messages:[{role:"system",content:prompt.system},{role:"user",content:prompt.user}]}),signal:AbortSignal.timeout(45000)});
    raw=await response.json();
    if(!response.ok) throw new Error(response.status===429?"ai_rate_limited":response.status>=500?"ai_provider_unavailable":"ai_auth_or_request_error");
    return {model:raw.model||config.model,content:raw.choices?.[0]?.message?.content};
  }
  if(providerKey==="anthropic_api") {
    response=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:config.model,max_tokens:3000,temperature:0.1,system:prompt.system,messages:[{role:"user",content:prompt.user}]}),signal:AbortSignal.timeout(45000)});
    raw=await response.json();
    if(!response.ok) throw new Error(response.status===429?"ai_rate_limited":response.status>=500?"ai_provider_unavailable":"ai_auth_or_request_error");
    return {model:raw.model||config.model,content:(raw.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n")};
  }
  response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+config.model+":generateContent?key="+encodeURIComponent(apiKey),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:prompt.system}]},contents:[{role:"user",parts:[{text:prompt.user}]}],generationConfig:{temperature:0.1,responseMimeType:"application/json",maxOutputTokens:3000}}),signal:AbortSignal.timeout(45000)});
  raw=await response.json();
  if(!response.ok) throw new Error(response.status===429?"ai_rate_limited":response.status>=500?"ai_provider_unavailable":"ai_auth_or_request_error");
  return {model:config.model,content:raw.candidates?.[0]?.content?.parts?.map(x=>x.text||"").join("\n")};
}
function parseResearchOutput(content) {
  if(typeof content!=="string"||content.length>30000) throw new Error("ai_output_invalid");
  let parsed;
  try { parsed=JSON.parse(content); } catch { throw new Error("ai_output_not_json"); }
  if(!parsed||typeof parsed!=="object"||!Array.isArray(parsed.findings)||parsed.findings.length>8) throw new Error("ai_output_schema_invalid");
  const findings=parsed.findings.map(item=>({
    stage:VALID_STAGES.has(item.stage)?item.stage:"discovery",
    finding_type:["claim","observation","estimate","contradiction","gap"].includes(item.finding_type)?item.finding_type:"claim",
    claim:String(item.claim||"").slice(0,2000),
    explanation:String(item.explanation||"").slice(0,4000),
    confidence:typeof item.confidence==="number"&&item.confidence>=0&&item.confidence<=1?item.confidence:null
  })).filter(item=>item.claim.trim().length>=5);
  return {summary:String(parsed.summary||"AI analysis completed; evidence is not verified.").slice(0,4000),findings};
}
async function processAIResearch(env,job,providerKey,provider,started) {
  if(!AI_PROVIDERS[providerKey]) throw new Error("ai_provider_not_supported");
  if(!job.requested_by||!job.input_payload?.opportunity_id) throw new Error("ai_research_scope_required");
  const apiKey=provider?.api_key;
  if(!apiKey) throw new Error("provider_not_configured");
  const answer=await requestAI(providerKey,apiKey,job);
  const output=parseResearchOutput(answer.content);
  const saved=await rpc(env,"urania_worker_save_ai_research",{
    p_opportunity_id:job.input_payload.opportunity_id,p_requested_by:job.requested_by,
    p_provider_key:providerKey,p_model_name:answer.model,p_prompt_version:"urania-research-prompt-v1",
    p_input_scope:{query:job.input_payload.query,stage:job.input_payload.stage||"discovery",context_included:Boolean(job.input_payload.context)},
    p_output_summary:{summary:output.summary,generated_findings:output.findings.length,latency_ms:Date.now()-started},
    p_findings:output.findings
  });
  await setJobStatus(env,job.job_id,"succeeded");
  return saved;
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

  const query = job.input_payload?.query;
  if (typeof query !== "string" || query.trim().length < 2 || query.length > 500) {
    await failAndAck(message,env,"invalid_search_query","A search query between 2 and 500 characters is required.");
    return;
  }

  const started = Date.now();
  try {
    if(job.job_type==="research.ai_analysis") {
      const saved=await processAIResearch(env,job,providerKey,provider,started);
      console.log("ai_research_saved",JSON.stringify({job_id:job.job_id,research_run_id:saved?.research_run_id,finding_count:saved?.finding_count}));
      message.ack();
      return;
    }
    let results = [];
    let providerCost = null;

    if (providerKey === "serpapi" && (job.job_type === "research.search" || job.job_type === "research.refresh")) {
      const providerApiKey = provider?.api_key || env.SERPAPI_API_KEY;
      if (!providerApiKey) {
        await failAndAck(message,env,"provider_not_configured","Configure the SerpApi credential in the Integration Center.");
        return;
      }
      const params = new URLSearchParams({engine:"google",q:query.trim(),api_key:providerApiKey,num:"10",hl:"en"});
      const market = String(job.market_country || "").toLowerCase();
      if (/^[a-z]{2}$/.test(market) && market !== "eu") params.set("gl",market);
      const response = await fetch("https://serpapi.com/search.json?" + params.toString(), {
        headers:{"accept":"application/json"},signal:AbortSignal.timeout(20000)
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
      results = Array.isArray(payload.organic_results) ? payload.organic_results.slice(0,10).map(r=>({
        position:r.position,title:r.title,link:r.link,snippet:r.snippet,displayed_link:r.displayed_link
      })) : [];
    } else if (providerKey === "apollo" && job.job_type === "crm.company_discovery") {
      const providerApiKey = provider?.api_key;
      if (!providerApiKey) {
        await failAndAck(message,env,"provider_not_configured","Configure the Apollo API key in the Integration Center.");
        return;
      }
      const params = new URLSearchParams({q_organization_name:query.trim(),page:"1",per_page:"10"});
      const response = await fetch("https://api.apollo.io/api/v1/mixed_companies/search?"+params.toString(),{
        method:"POST",
        headers:{"accept":"application/json","content-type":"application/json","x-api-key":providerApiKey},
        body:"{}",
        signal:AbortSignal.timeout(20000)
      });
      if(response.status===401||response.status===403){
        await failAndAck(message,env,"provider_auth_error","Apollo rejected the configured credential or endpoint scope.");
        return;
      }
      if(response.status===429||response.status>=500){
        await retryOrFail(message,env,job,"provider_transient_error","Apollo returned a retryable HTTP status "+response.status);
        return;
      }
      const payload=await response.json();
      if(!response.ok||payload.error){
        await failAndAck(message,env,"provider_request_error","Apollo rejected the company search request; inspect worker logs for details.");
        return;
      }
      const companies=Array.isArray(payload.organizations)?payload.organizations:[];
      results=companies.slice(0,10).map(org=>({
        title:org.name||org.organization_name||"(unnamed organization)",
        link:org.website_url||org.primary_domain||org.linkedin_url||null,
        snippet:[org.industry,org.estimated_num_employees?String(org.estimated_num_employees)+" employees":null,org.city,org.country].filter(Boolean).join(" · "),
        displayed_link:org.primary_domain||org.website_url||null,
        organization_id:org.id||null,
        linkedin_url:org.linkedin_url||null
      }));
    } else if (providerKey === "hunter" && job.job_type === "crm.contact_enrichment") {
      const providerApiKey=provider?.api_key;
      const domain=String(job.input_payload?.domain||"").trim().toLowerCase();
      const lawfulBasis=String(job.input_payload?.lawful_basis||"");
      const purpose=String(job.input_payload?.purpose||"").trim();
      if(!providerApiKey){
        await failAndAck(message,env,"provider_not_configured","Configure the Hunter API key in the Integration Center.");
        return;
      }
      if(!/^(?=.{4,253}$)[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)||!["consent","contract","legitimate_interest","legal_obligation","public_task"].includes(lawfulBasis)||purpose.length<20||!job.market_country){
        await failAndAck(message,env,"contact_enrichment_compliance_required","A valid domain, market country, documented purpose, and lawful basis are required for contact enrichment.");
        return;
      }
      const params=new URLSearchParams({domain,limit:"10"});
      const response=await fetch("https://api.hunter.io/v2/domain-search?"+params.toString(),{
        headers:{"accept":"application/json","X-API-KEY":providerApiKey},
        signal:AbortSignal.timeout(20000)
      });
      if(response.status===401||response.status===403){
        await failAndAck(message,env,"provider_auth_error","Hunter rejected the configured credential or request scope.");
        return;
      }
      if(response.status===429||response.status>=500){
        await retryOrFail(message,env,job,"provider_transient_error","Hunter returned a retryable HTTP status "+response.status);
        return;
      }
      const payload=await response.json();
      if(!response.ok||payload.errors){
        await failAndAck(message,env,"provider_request_error","Hunter rejected the domain search request; inspect worker logs for details.");
        return;
      }
      const emails=Array.isArray(payload.data?.emails)?payload.data.emails:[];
      results=emails.slice(0,10).map(person=>({
        title:[person.first_name,person.last_name].filter(Boolean).join(" ")||person.position||"Contact",
        link:person.linkedin||person.sources?.[0]?.uri||null,
        snippet:[person.value,person.position,person.department,person.type,person.confidence!=null?"confidence "+person.confidence:null].filter(Boolean).join(" · "),
        displayed_link:domain,
        email:person.value||null,
        verification_status:person.verification?.status||null
      }));
    } else {
      await failAndAck(message,env,"provider_job_not_supported","The selected provider does not support this job type in the current release.");
      return;
    }

    await rpc(env,"urania_worker_store_search_results",{
      p_job_id:job.job_id,p_provider_key:providerKey,p_query:query.trim(),
      p_market_country:job.market_country||null,p_results:results,
      p_latency_ms:Date.now()-started,p_provider_cost:providerCost
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
