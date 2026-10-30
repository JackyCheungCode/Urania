export const RESEARCH_SCORE_WEIGHTS={
 marketDemand:15,growth:10,accessibility:10,competitiveAdvantage:15,
 willingnessToPay:10,profitabilityCashflow:20,supplyChain:10,scalability:10
} as const;
export type ResearchScoreInputs=Record<keyof typeof RESEARCH_SCORE_WEIGHTS,number>;
export type EvidenceQualityInputs={coverage:number;quality:number;freshness:number;uncertainty:number};
export function validateResearchScoreInputs(scores:ResearchScoreInputs,evidence:EvidenceQualityInputs):string[]{
 const errors:string[]=[];
 for(const [key,value] of Object.entries(scores))if(!Number.isFinite(value)||value<0||value>100)errors.push(key+" 必须介于 0 到 100。");
 for(const [key,value] of Object.entries(evidence))if(!Number.isFinite(value)||value<0||value>1)errors.push(key+" 必须介于 0 到 1。");
 return errors;
}
export function calculateResearchScore(scores:ResearchScoreInputs,evidence:EvidenceQualityInputs,activeHardVeto:boolean){
 const errors=validateResearchScoreInputs(scores,evidence);if(errors.length)throw new Error(errors.join(" "));
 const commercialScore=Object.entries(RESEARCH_SCORE_WEIGHTS).reduce((sum,[key,weight])=>sum+scores[key as keyof ResearchScoreInputs]*weight/100,0);
 const evidenceReadiness=(evidence.coverage*0.35+evidence.quality*0.3+evidence.freshness*0.2+(1-evidence.uncertainty)*0.15)*100;
 return {commercialScore,evidenceReadiness,evidenceCoverage:evidence.coverage,activeHardVeto,decisionGate:activeHardVeto?"blocked_by_hard_veto":evidenceReadiness<50?"insufficient_evidence":"eligible_for_human_review",
  weights:RESEARCH_SCORE_WEIGHTS,warning:"评分只用于排序和辅助审查，不构成投资批准；证据准备度独立显示，硬性否决不可被分数抵消。"};
}
