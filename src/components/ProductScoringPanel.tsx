import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Gauge, ShieldCheck, Sparkles } from "lucide-react";
import { createProductScore, type ProductRecord, type ProductScoreRecord } from "../lib/api";
import { supabase } from "../lib/supabase";

type Props={products:ProductRecord[];toast:(message:string)=>void};
const weights={demand_growth:0.20,market_size:0.15,competition:0.15,profit_potential:0.20,supply_chain:0.10,durability:0.10,differentiation:0.10};
const labels:Record<keyof typeof weights,string>={demand_growth:"需求增长",market_size:"市场规模",competition:"竞争空间",profit_potential:"利润潜力",supply_chain:"供应链可行性",durability:"趋势持续性",differentiation:"差异化空间"};
const riskOptions=[["regulatory_prohibition","监管禁止"],["product_safety_block","产品安全未解决"],["ip_infringement","知识产权风险"],["sanctions_block","制裁风险"],["high_return_rate","高退货风险"],["seasonality_risk","季节性风险"],["supplier_concentration","供应商集中"],["data_quality_low","数据质量低"],["margin_risk","利润率风险"],["other","其他风险"]] as const;
const hardStops=new Set(["regulatory_prohibition","product_safety_block","ip_infringement","sanctions_block"]);

export default function ProductScoringPanel({products,toast}:Props){
  const [role,setRole]=useState<string|null>(null);
  const [productId,setProductId]=useState("");
  const [scores,setScores]=useState<Record<keyof typeof weights,number>>({demand_growth:50,market_size:50,competition:50,profit_potential:50,supply_chain:50,durability:50,differentiation:50});
  const [risks,setRisks]=useState<string[]>([]);
  const [confidence,setConfidence]=useState(0.65);
  const [notes,setNotes]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState<ProductScoreRecord|null>(null);

  useEffect(()=>{if(!supabase)return;supabase.auth.getUser().then(({data})=>setRole((data.user?.app_metadata?.urania_role as string|undefined)??null)).catch(()=>setRole(null));},[]);
  const score=useMemo(()=>risks.some(r=>hardStops.has(r))?0:Number(Object.entries(scores).reduce((sum,[key,value])=>sum+value*weights[key as keyof typeof weights],0).toFixed(2)),[scores,risks]);
  const coverage=Object.values(weights).reduce((a,b)=>a+b,0);
  if(role!=="admin"&&role!=="researcher") return null;

  async function save(e:FormEvent){
    e.preventDefault();if(!productId){setError("请选择要评分的产品。");return;}
    setSaving(true);setError("");setSaved(null);
    try{
      const result=await createProductScore({product_id:productId,component_scores:scores,risk_flags:risks,confidence,notes,score_version:"v1.0"});
      setSaved(result);toast(result.hard_stop?"已保存评分：存在硬性风险拦截":"产品机会评分已保存");
    }catch(x){setError(x instanceof Error?x.message:"保存评分失败。");}
    finally{setSaving(false);}
  }
  return <section className="panel product-scoring">
    <div className="crm-toolbar"><div className="profit-title"><span className="profit-icon"><Gauge size={18}/></span><div><h3>产品机会评分</h3><p className="panel-subtitle">固定权重、可解释评分；分数是研究判断，不是实际销量或 AI 预测。</p></div></div><span className="score-version">权重版本 v1.0</span></div>
    <form onSubmit={save}>
      <label className="profit-product">待评分产品 *<select required value={productId} onChange={e=>setProductId(e.target.value)}><option value="">选择产品…</option>{products.map(p=><option key={p.id} value={p.id}>{p.canonical_name}</option>)}</select></label>
      <div className="score-components">{(Object.keys(weights) as Array<keyof typeof weights>).map(key=><label className="score-slider" key={key}><span><strong>{labels[key]}</strong><b>{scores[key]}</b></span><input type="range" min="0" max="100" step="1" value={scores[key]} onChange={e=>setScores(prev=>({...prev,[key]:Number(e.target.value)}))}/><small>权重 {Math.round(weights[key]*100)}%</small></label>)}</div>
      <div className="score-confidence"><label>证据置信度 <strong>{Math.round(confidence*100)}%</strong><input type="range" min="0" max="1" step="0.05" value={confidence} onChange={e=>setConfidence(Number(e.target.value))}/></label><div className={risks.some(r=>hardStops.has(r))?"score-hard-stop":"score-preview"}><span>{risks.some(r=>hardStops.has(r))?<AlertTriangle size={15}/>:<Sparkles size={15}/>}评分预览</span><strong>{score.toFixed(1)} / 100</strong><small>评分覆盖权重 {Math.round(coverage*100)}%</small></div></div>
      <div className="score-risk-list"><div className="score-section-label">风险标记 <small>以下四项为硬性否决风险</small></div><div className="score-risk-grid">{riskOptions.map(([key,label])=><label key={key}><input type="checkbox" checked={risks.includes(key)} onChange={e=>setRisks(prev=>e.target.checked?[...prev,key]:prev.filter(x=>x!==key))}/><span>{label}{hardStops.has(key)&&<b>硬性拦截</b>}</span></label>)}</div></div>
      <label className="profit-assumptions">证据说明 / 主要不确定性<textarea rows={3} maxLength={4000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="记录支撑分数的来源、日期、市场范围与缺失数据。"/></label>
      {error&&<p className="auth-error" role="alert">{error}</p>}
      {saved&&<p className="auth-info" role="status"><CheckCircle2 size={14}/>已保存评分 {saved.score.toFixed(1)}；覆盖权重 {Math.round(saved.coverage_weight*100)}%。{saved.hard_stop?"存在硬性风险，分数强制归零。":""}</p>}
      <div className="profit-actions"><span><ShieldCheck size={14}/>数据库重算权重并记录风险、置信度、评分版本与审计事件。</span><button type="submit" className="button button--primary" disabled={saving||!productId}>{saving?"保存中…":"保存评分"}</button></div>
    </form>
  </section>;
}
