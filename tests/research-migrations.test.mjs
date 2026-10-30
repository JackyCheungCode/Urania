import test from "node:test";
import assert from "node:assert/strict";
import {readdir,readFile} from "node:fs/promises";
const directory=new URL("../supabase/migrations/",import.meta.url);
const files=(await readdir(directory)).filter(name=>/^20261030.*research|^20261030.*ai|^20261030.*openai/.test(name)&&name.endsWith(".sql"));
test("new Urania research migrations have balanced SQL dollar-quote delimiters",async()=>{
 assert.ok(files.length>=10,"expected research migration set");
 for(const name of files){
  const sql=await readFile(new URL(name,directory),"utf8");
  for(const delimiter of ["$$","$function$"]){
   const count=sql.split(delimiter).length-1;
   assert.equal(count%2,0,name+" has unbalanced "+delimiter);
  }
 }
});
test("new research tables have restrictive server-managed role gates",async()=>{
 const sql=await readFile(new URL("20261030220000_research_role_rls_guard.sql",directory),"utf8");
 assert.match(sql,/as restrictive for all to authenticated/i);
 assert.match(sql,/urania_role/);
 assert.match(sql,/admin/);
 assert.match(sql,/researcher/);
});
test("AI persistence always stores findings as evidence-insufficient",async()=>{
 const sql=await readFile(new URL("20261030200000_ai_research_persistence_rpc.sql",directory),"utf8");
 assert.match(sql,/'insufficient'/);
 assert.match(sql,/model_generated/);
 assert.match(sql,/queue_job_id/);
 assert.match(sql,/job_replay_scope_mismatch/);
});
test("investment approval checks active hard veto in the database",async()=>{
 const sql=await readFile(new URL("20261030170000_research_investment_decision_workflow.sql",directory),"utf8");
 assert.match(sql,/active_hard_veto_blocks_approval/);
 assert.match(sql,/r\.hard_veto and r\.status in \('open','mitigating'\)/);
});
