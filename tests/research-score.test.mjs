import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
const source=await readFile(new URL("../src/lib/research-score.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const model=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const scores={marketDemand:80,growth:70,accessibility:60,competitiveAdvantage:70,willingnessToPay:75,profitabilityCashflow:85,supplyChain:70,scalability:65};
const evidence={coverage:.8,quality:.75,freshness:.9,uncertainty:.2};
test("commercial score uses fixed transparent weights summing to 100",()=>{
 const result=model.calculateResearchScore(scores,evidence,false);
 assert.equal(Object.values(result.weights).reduce((a,b)=>a+b,0),100);
 assert.equal(result.commercialScore,73.5);
 assert.ok(result.evidenceReadiness>0&&result.evidenceReadiness<=100);
});
test("hard veto blocks the decision gate regardless of commercial score",()=>{
 const result=model.calculateResearchScore(Object.fromEntries(Object.keys(scores).map(k=>[k,100])),evidence,true);
 assert.equal(result.commercialScore,100);
 assert.equal(result.decisionGate,"blocked_by_hard_veto");
});
test("low evidence readiness remains separate from commercial score",()=>{
 const result=model.calculateResearchScore(scores,{coverage:.1,quality:.1,freshness:.1,uncertainty:.9},false);
 assert.equal(result.decisionGate,"insufficient_evidence");
 assert.ok(result.commercialScore>0);
});
