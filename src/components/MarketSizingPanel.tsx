import { useEffect, useMemo, useState } from "react";
import { Button, InlineNotification, NumberInput, Select, SelectItem, Tile } from "@carbon/react";
import { listResearchAssumptions, saveResearchAssumption, type ResearchAssumptionRecord } from "../lib/api";
import { calculateMarketSizing, validateMarketSizingInputs, type MarketSizingInputs } from "../lib/market-sizing";

const initial:MarketSizingInputs={
 currency:"USD",topDownTotalMarket:100000000,topDownAddressableShare:.2,
 bottomUpTotalCustomers:10000,bottomUpAnnualSpendPerCustomer:8000,bottomUpAddressableCustomers:2000,
 salesReps:5,qualifiedLeadsPerRepPerMonth:40,leadToCustomerConversionRate:.08,
 annualRevenuePerCustomer:8000,annualDeliveryCapacityCustomers:150
};
const money=(value:number,currency:string)=>new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:0}).format(value);
export default function MarketSizingPanel({opportunityId}:{opportunityId:string}){
 const [inputs,setInputs]=useState<MarketSizingInputs>(initial);
 const [saving,setSaving]=useState(false);
 const [saveError,setSaveError]=useState("");
 const [savedVersion,setSavedVersion]=useState<number|null>(null);
 const [history,setHistory]=useState<ResearchAssumptionRecord[]>([]);
 useEffect(()=>{if(!opportunityId){setHistory([]);return;}void listResearchAssumptions(opportunityId).then(rows=>setHistory(rows.filter(r=>r.assumption_key==="market_sizing")));},[opportunityId]);
 const update=<K extends keyof MarketSizingInputs>(key:K,value:MarketSizingInputs[K])=>setInputs(current=>({...current,[key]:value}));
 const errors=useMemo(()=>validateMarketSizingInputs(inputs),[inputs]);
 const result=useMemo(()=>{if(errors.length)return null;try{return calculateMarketSizing(inputs);}catch{return null;}},[inputs,errors]);
 const save=async()=>{if(!opportunityId||!result)return;setSaving(true);setSaveError("");try{const row=await saveResearchAssumption({opportunity_id:opportunityId,assumption_key:"market_sizing",assumption_value:{inputs,outputs:result,engine_version:"urania-market-sizing-v1"},rationale:"双路径 TAM/SAM 核对与销售/交付能力约束 SOM；录入值需关联证据后方可验证。",sensitivity:"high"});setSavedVersion(row.version);setHistory(await listResearchAssumptions(opportunityId).then(rows=>rows.filter(r=>r.assumption_key==="market_sizing")));}catch(error){setSaveError(error instanceof Error?error.message:"市场规模假设保存失败。");}finally{setSaving(false);}};
 return <Tile className="research-market-sizing">
  <h3>市场规模 · TAM / SAM / SOM</h3>
  <p className="panel-note">TAM/SAM 采用自上而下与自下而上双路径核对；SOM 根据销售获客、交付产能和可服务市场的最小约束计算，不使用 SAM 固定百分比。</p>
  <div className="research-market-input-grid">
   <Select id="market-sizing-currency" labelText="报告币种" value={inputs.currency} onChange={e=>update("currency",e.target.value)}><SelectItem value="USD" text="USD"/><SelectItem value="EUR" text="EUR"/><SelectItem value="GBP" text="GBP"/><SelectItem value="TWD" text="TWD"/><SelectItem value="JPY" text="JPY"/></Select>
   <NumberInput id="market-topdown-tam" label="自上而下总市场 TAM" min={0} step={1000000} value={inputs.topDownTotalMarket} onChange={(_,data)=>update("topDownTotalMarket",data.value)}/>
   <NumberInput id="market-topdown-share" label="可服务市场占比 (0–1)" min={0} max={1} step={.01} value={inputs.topDownAddressableShare} onChange={(_,data)=>update("topDownAddressableShare",data.value)}/>
   <NumberInput id="market-bottomup-customers" label="自下而上总客户数" min={0} step={100} value={inputs.bottomUpTotalCustomers} onChange={(_,data)=>update("bottomUpTotalCustomers",data.value)}/>
   <NumberInput id="market-bottomup-spend" label="每客户年支出" min={0} step={100} value={inputs.bottomUpAnnualSpendPerCustomer} onChange={(_,data)=>update("bottomUpAnnualSpendPerCustomer",data.value)}/>
   <NumberInput id="market-bottomup-addressable" label="可服务客户数" min={0} step={100} value={inputs.bottomUpAddressableCustomers} onChange={(_,data)=>update("bottomUpAddressableCustomers",data.value)}/>
   <NumberInput id="market-sales-reps" label="销售人员数量" min={0} value={inputs.salesReps} onChange={(_,data)=>update("salesReps",data.value)}/>
   <NumberInput id="market-leads" label="每位销售每月合格线索" min={0} value={inputs.qualifiedLeadsPerRepPerMonth} onChange={(_,data)=>update("qualifiedLeadsPerRepPerMonth",data.value)}/>
   <NumberInput id="market-conversion" label="线索转客户转化率 (0–1)" min={0} max={1} step={.01} value={inputs.leadToCustomerConversionRate} onChange={(_,data)=>update("leadToCustomerConversionRate",data.value)}/>
   <NumberInput id="market-arpc" label="每客户年收入" min={0} value={inputs.annualRevenuePerCustomer} onChange={(_,data)=>update("annualRevenuePerCustomer",data.value)}/>
   <NumberInput id="market-capacity" label="年交付客户容量" min={0} value={inputs.annualDeliveryCapacityCustomers} onChange={(_,data)=>update("annualDeliveryCapacityCustomers",data.value)}/>
  </div>
  {errors.length>0&&<InlineNotification kind="error" lowContrast title="请修正输入" subtitle={errors.join(" ")} hideCloseButton/>}
  {saveError&&<InlineNotification kind="error" lowContrast title="保存失败" subtitle={saveError} hideCloseButton/>}
  {result&&<><div className="research-market-results">
   <div><span>自上而下 TAM</span><strong>{money(result.topDownTAM,inputs.currency)}</strong></div>
   <div><span>自下而上 TAM</span><strong>{money(result.bottomUpTAM,inputs.currency)}</strong></div>
   <div><span>核对 TAM（简单平均）</span><strong>{money(result.reconciledTAM,inputs.currency)}</strong></div>
   <div><span>核对 SAM</span><strong>{money(result.reconciledSAM,inputs.currency)}</strong></div>
   <div><span>销售能力上限</span><strong>{money(result.annualSalesCapacityRevenue,inputs.currency)}</strong></div>
   <div><span>交付能力上限</span><strong>{money(result.deliveryCapacityRevenue,inputs.currency)}</strong></div>
   <div className="research-market-som"><span>SOM（受 {result.somConstraint==="sales_capacity"?"销售能力":result.somConstraint==="delivery_capacity"?"交付能力":"可服务市场"} 约束）</span><strong>{money(result.som,inputs.currency)}</strong></div>
   <p className="panel-note">两条 TAM 路径差异率：{result.topDownBottomUpGapRate===null?"—":(result.topDownBottomUpGapRate*100).toFixed(1)+"%"}。请为每个输入补充来源、地域、统计年份和证据等级；差异较大时不得直接采用平均值作为最终结论。</p>
  </div>}
 </Tile>;
}
