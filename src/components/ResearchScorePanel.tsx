import { useEffect, useMemo, useState } from "react";
import { Button, InlineNotification, NumberInput, Tile } from "@carbon/react";
import { listResearchAssumptions, saveResearchAssumption, type ResearchAssumptionRecord } from "../lib/api";
import { calculateResearchScore, validateResearchScoreInputs, type ResearchScoreInputs, type EvidenceQualityInputs } from "../lib/research-score";
const initialScores:ResearchScoreInputs={marketDemand:50,growth:50,accessibility:50,competitiveAdvantage:50,willingnessToPay:50,profitabilityCashflow:50,supplyChain:50,scalability:50};
const initialEvidence:EvidenceQualityInputs={coverage:0,quality:0,freshness:0,uncertainty:1};
const labels:Record<keyof ResearchScoreInputs,string>={marketDemand:"市场需求",growth:"市场增长",accessibility:"市场可进入性",competitiveAdvantage:"竞争优势",willingnessToPay:"支付意愿",profitabilityCashflow:"盈利与现金流",supplyChain:"供应链",scalability:"扩展性"};
export default function ResearchScorePanel({opportunityId,activeHardVeto,onScoreChange}:{opportunityId:string;activeHardVeto:boolean;onScoreChange?:(value:{commercialScore:number;evidenceCoverage:number;evidenceReadiness:number})=>void}){
 const [scores,setScores]=useState(initialScores);const [evidence,setEvidence]=useState(initialEvidence);
 const [saving,setSaving]=useState(false);const [saveError,setSaveError]=useState("");const [savedVersion,setSavedVersion]=useState<number|null>(null);const [history,setHistory]=useState<ResearchAssumptionRecord[]>([]);
 useEffect(()=>{setScores(initialScores);setEvidence(initialEvidence);setSavedVersion(null);setSaveError("");if(!opportunityId){setHistory([]);return;}void listResearchAssumptions(opportunityId).then(rows=>setHistory(rows.filter(r=>r.assumption_key==="commercial_score"))).catch(error=>setSaveError(error instanceof Error?error.message:"无法读取评分版本历史。"));},[opportunityId]);
 const errors=useMemo(()=>validateResearchScoreInputs(scores,evidence),[scores,evidence]);
 const result=useMemo(()=>errors.length?null:calculateResearchScore(scores,evidence,activeHardVeto),[scores,evidence,activeHardVeto,errors]);
 const save=async()=>{if(!opportunityId||!result)return;setSaving(true);setSaveError("");try{const row=await saveResearchAssumption({opportunity_id:opportunityId,assumption_key:"commercial_score",assumption_value:{scores,evidence,result,engine_version:"urania-score-v1"},rationale:"固定权重商业评分；证据准备度独立计算，硬性否决独立阻断。",sensitivity:"high"});setSavedVersion(row.version);setHistory(await listResearchAssumptions(opportunityId).then(rows=>rows.filter(r=>r.assumption_key==="commercial_score")));}catch(error){setSaveError(error instanceof Error?error.message:"评分快照保存失败。");}finally{setSaving(false);}};
 useEffect(()=>{if(result)onScoreChange?.({commercialScore:result.commercialScore,evidenceCoverage:result.evidenceCoverage,evidenceReadiness:result.evidenceReadiness});},[result,onScoreChange]);
 return <Tile className="research-score-panel">
  <h3>商业评分与证据准备度</h3>
  <p className="panel-note">权重固定且可追溯。证据覆盖、质量、时效和不确定性独立显示；评分只用于排序，不构成批准。</p>
  <div className="research-score-input-grid">{(Object.keys(labels) as Array<keyof ResearchScoreInputs>).map(key=><NumberInput key={key} id={"score-"+key} label={labels[key]+" · 权重 "+({marketDemand:15,growth:10,accessibility:10,competitiveAdvantage:15,willingnessToPay:10,profitabilityCashflow:20,supplyChain:10,scalability:10}[key])+"%"} min={0} max={100} value={scores[key]} onChange={(_,data)=>setScores(current=>({...current,[key]:Number(data.value)}))}/>)}</div>
  <div className="research-score-input-grid research-score-evidence">{(Object.keys(evidence) as Array<keyof EvidenceQualityInputs>).map(key=><NumberInput key={key} id={"evidence-"+key} label={{coverage:"证据覆盖度",quality:"证据质量",freshness:"证据时效",uncertainty:"不确定性"}[key]+" · 0–1"} min={0} max={1} step={.05} value={evidence[key]} onChange={(_,data)=>setEvidence(current=>({...current,[key]:Number(data.value)}))}/>)}</div>
  {errors.length>0&&<InlineNotification kind="error" lowContrast title="评分输入无效" subtitle={errors.join(" ")} hideCloseButton/>}
  {saveError&&<InlineNotification kind="error" lowContrast title="评分保存 / 历史读取失败" subtitle={saveError} hideCloseButton/>}
  {result&&<><div className="research-score-results"><div><span>商业评分</span><strong>{result.commercialScore.toFixed(1)} / 100</strong></div><div><span>证据准备度</span><strong>{result.evidenceReadiness.toFixed(1)} / 100</strong></div><div><span>决策门槛</span><strong>{result.decisionGate==="blocked_by_hard_veto"?"硬性否决阻断":result.decisionGate==="insufficient_evidence"?"证据不足":"可进入人工审查"}</strong></div></div><div className="research-market-save"><Button size="sm" disabled={saving||!opportunityId||errors.length>0} onClick={()=>void save()}>{saving?"保存中…":"保存评分快照"}</Button>{savedVersion!==null&&<span>已保存 v{savedVersion}</span>}</div></>}
  {history.length>0&&<div className="research-model-history"><strong>评分历史版本</strong>{history.map(row=><div key={row.id}><span>v{row.version} · {row.status}</span><small>{new Date(row.created_at).toLocaleString()}</small></div>)}</div>}
 </Tile>;
}
