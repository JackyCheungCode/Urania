import test from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/queue-consumer/src/index.js";

test("AI research jobs call configured model and persist unverified findings",async(t)=>{
 const originalFetch=globalThis.fetch;const actions=[];const requests=[];
 globalThis.fetch=async(url,init={})=>{
  const target=String(url);requests.push({url:target,headers:init.headers,body:init.body});
  if(target.endsWith("/functions/v1/urania-internal-worker")){
   const body=JSON.parse(init.body);actions.push(body.action);
   if(body.action==="urania_worker_claim_job")return new Response(JSON.stringify({claimed:true}),{status:200});
   if(body.action==="urania_worker_get_provider")return new Response(JSON.stringify({provider_key:"openai_api",status:"active",authorization_status:"approved",api_key:"server-only-test-secret"}),{status:200});
   if(body.action==="urania_worker_save_ai_research")return new Response(JSON.stringify({research_run_id:"run-1",finding_count:1}),{status:200});
   if(body.action==="urania_worker_update_job")return new Response(JSON.stringify({status:"succeeded"}),{status:200});
   throw new Error("unexpected internal action "+body.action);
  }
  if(target==="https://api.openai.com/v1/chat/completions"){
   return new Response(JSON.stringify({model:"gpt-4.1-mini",choices:[{message:{content:JSON.stringify({summary:"仅基于用户提供内容的初步分析。",findings:[{stage:"demand",finding_type:"gap",claim:"当前尚无一手客户付费证据。",explanation:"需要访谈与交易数据。",confidence:.4}]})}}]}),{status:200});
  }
  throw new Error("unexpected fetch "+target);
 };
 t.after(()=>{globalThis.fetch=originalFetch;});
 let acked=false,retried=false;
 const message={body:{schema_version:1,job_id:"job-1",job_type:"research.ai_analysis",provider_key:"openai_api",requested_by:"user-1",input_payload:{query:"评估某产品在台湾市场的客户需求",stage:"demand",opportunity_id:"opp-1",context:"暂无交易记录"}},ack(){acked=true;},retry(){retried=true;}};
 await worker.queue({messages:[message]},{SUPABASE_URL:"https://project.supabase.co",URANIA_INTERNAL_TOKEN:"internal-token-test"});
 assert.equal(acked,true);assert.equal(retried,false);
 assert.deepEqual(actions,["urania_worker_claim_job","urania_worker_get_provider","urania_worker_save_ai_research","urania_worker_update_job"]);
 const saved=requests.find(r=>r.body&&JSON.parse(r.body).action==="urania_worker_save_ai_research");
 const payload=JSON.parse(saved.body);
 assert.equal(payload.p_requested_by,"user-1");
 assert.equal(payload.p_findings[0].stage,"demand");
 assert.equal(payload.p_findings[0].claim,"当前尚无一手客户付费证据。");
 assert.equal(JSON.stringify(requests).includes("server-only-test-secret"),true);
});

test("AI research job without an authorized provider is safely failed",async(t)=>{
 const originalFetch=globalThis.fetch;const actions=[];
 globalThis.fetch=async(url,init={})=>{
  const body=JSON.parse(init.body);actions.push(body.action);
  if(body.action==="urania_worker_claim_job")return new Response(JSON.stringify({claimed:true}),{status:200});
  if(body.action==="urania_worker_get_provider")return new Response(JSON.stringify({status:"planned",authorization_status:"unknown"}),{status:200});
  if(body.action==="urania_worker_update_job")return new Response(JSON.stringify({status:"failed"}),{status:200});
  throw new Error("unexpected action");
 };
 t.after(()=>{globalThis.fetch=originalFetch;});
 let acked=false;
 await worker.queue({messages:[{body:{schema_version:1,job_id:"job-2",job_type:"research.ai_analysis",provider_key:"openai_api",input_payload:{query:"research query"}},ack(){acked=true;},retry(){}}]},{SUPABASE_URL:"https://project.supabase.co",URANIA_INTERNAL_TOKEN:"internal-token-test"});
 assert.equal(acked,true);
 assert.deepEqual(actions,["urania_worker_claim_job","urania_worker_get_provider","urania_worker_update_job"]);
});
