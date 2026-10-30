import { useMemo, useState, type FormEvent } from "react";
import { Calculator, Save, Security } from "@carbon/icons-react";
import { Button, InlineNotification, Select, SelectItem, TextInput, TextArea } from "@carbon/react";
import { createProfitScenario, type ProductRecord } from "../lib/api";
import { isSupabaseConfigured } from "../lib/supabase";

type Props={products:ProductRecord[];toast:(message:string)=>void};
type Scenario="b2c"|"b2b";
const initialB2C={unit_price:"29.99",sourcing_cost:"7.50",freight:"2.40",duties:"0.50",fulfillment:"4.00",other_costs:"0.40",platform_fee_pct:"15",ad_cost_pct:"12",expected_returns_pct:"3"};
const initialB2B={unit_price:"8.50",quantity:"1000",sourcing_cost:"4.20",freight_per_unit:"0.30",duties_per_unit:"0.20",packaging_per_unit:"0.15",inspection_total:"250",setup_cost:"500",fx_reserve_pct:"2",other_costs:"0.10"};
const number=(v:string)=>Number.isFinite(Number(v))?Number(v):0;
const money=(v:number,currency:string)=>new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:2}).format(v);

export default function ProfitCalculator({products,toast}:Props){
  const [scenario,setScenario]=useState<Scenario>("b2c");
  const [currency,setCurrency]=useState("USD");
  const [productId,setProductId]=useState("");
  const [b2c,setB2c]=useState(initialB2C);
  const [b2b,setB2b]=useState(initialB2B);
  const [assumptions,setAssumptions]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [savedId,setSavedId]=useState("");

  const inputs=useMemo(()=>scenario==="b2c"
    ? Object.fromEntries(Object.entries(b2c).map(([k,v])=>[k,number(v)]))
    : Object.fromEntries(Object.entries(b2b).map(([k,v])=>[k,number(v)])),[scenario,b2c,b2b]);
  const result=useMemo(()=>{
    const p=number(scenario==="b2c"?b2c.unit_price:b2b.unit_price);
    if(scenario==="b2c"){
      const platform=p*number(b2c.platform_fee_pct)/100;
      const ads=p*number(b2c.ad_cost_pct)/100;
      const returns=p*number(b2c.expected_returns_pct)/100;
      const costs=number(b2c.sourcing_cost)+number(b2c.freight)+number(b2c.duties)+number(b2c.fulfillment)+number(b2c.other_costs)+platform+ads+returns;
      return {revenue:p,costs,profit:p-costs,margin:p>0?(p-costs)/p*100:0,breakEven:null,platform,ads,returns};
    }
    const qty=number(b2b.quantity);
    const revenue=p*qty;
    const fx=revenue*number(b2b.fx_reserve_pct)/100;
    const variable=number(b2b.sourcing_cost)+number(b2b.freight_per_unit)+number(b2b.duties_per_unit)+number(b2b.packaging_per_unit)+number(b2b.other_costs);
    const costs=variable*qty+number(b2b.inspection_total)+number(b2b.setup_cost)+fx;
    const unitContribution=p-variable-p*number(b2b.fx_reserve_pct)/100;
    return {revenue,costs,profit:revenue-costs,margin:revenue>0?(revenue-costs)/revenue*100:0,breakEven:unitContribution>0?Math.ceil((number(b2b.inspection_total)+number(b2b.setup_cost))/unitContribution):null,platform:0,ads:0,returns:0,fx};
  },[scenario,b2c,b2b]);
  const valid=useMemo(()=>scenario==="b2c"
    ? number(b2c.unit_price)>0 && ["platform_fee_pct","ad_cost_pct","expected_returns_pct"].every(k=>number(b2c[k as keyof typeof b2c])>=0&&number(b2c[k as keyof typeof b2c])<=100)
    : number(b2b.unit_price)>0&&Number.isInteger(number(b2b.quantity))&&number(b2b.quantity)>0&&number(b2b.fx_reserve_pct)>=0&&number(b2b.fx_reserve_pct)<=100,[scenario,b2c,b2b]);

  async function save(e:FormEvent){
    e.preventDefault();if(!valid){setError("请检查价格、数量与百分比范围。");return;}
    setSaving(true);setError("");setSavedId("");
    try{
      const saved=await createProfitScenario({scenario_type:scenario,currency,inputs,product_id:productId||null,assumptions:assumptions||undefined});
      setSavedId(saved.id);toast("利润情景已保存；计算结果由数据库重新计算。");
    }catch(x){setError(x instanceof Error?x.message:"保存利润情景失败。");}
    finally{setSaving(false);}
  }
  const setB2C=(key:keyof typeof initialB2C,value:string)=>setB2c(prev=>({...prev,[key]:value}));
  const setB2B=(key:keyof typeof initialB2B,value:string)=>setB2b(prev=>({...prev,[key]:value}));
  const field=(label:string,key:string,value:string,onChange:(v:string)=>void,unit?:string,step="0.01")=><TextInput key={key} id={`profit-${key}`} className="profit-field" labelText={unit?`${label} (${unit})`:label} type="number" min="0" step={step} value={value} onChange={e=>onChange(e.target.value)} required/>;

  return <section className="panel profit-calculator">
    <div className="crm-toolbar"><div><div className="profit-title"><span className="profit-icon"><Calculator size={18}/></span><div><h3>利润情景计算器</h3><p className="panel-subtitle">按输入假设进行确定性计算；不是供应商报价、税务意见或实际销售数据。</p></div></div></div><div className="summary-actions"><Select id="profit-currency" labelText="币种" value={currency} onChange={e=>setCurrency(e.target.value)}><SelectItem value="USD" text="USD"/><SelectItem value="EUR" text="EUR"/><SelectItem value="GBP" text="GBP"/><SelectItem value="CNY" text="CNY"/><SelectItem value="PLN" text="PLN"/></Select></div></div>
    <div className="profit-tabs"><Button type="button" kind={scenario==="b2c"?"primary":"tertiary"} onClick={()=>setScenario("b2c")}>B2C 单件贡献利润</Button><Button type="button" kind={scenario==="b2b"?"primary":"tertiary"} onClick={()=>setScenario("b2b")}>B2B 订单利润</Button></div>
    <form onSubmit={save}>
      {products.length>0&&<Select id="profit-product" labelText="关联产品（可选）" value={productId} onChange={e=>setProductId(e.target.value)}><SelectItem value="" text="不关联产品"/>{products.map(p=><SelectItem key={p.id} value={p.id} text={p.canonical_name}/>)}</Select>}
      {scenario==="b2c"?<div className="profit-input-grid">
        {field("零售价","unit_price",b2c.unit_price,v=>setB2C("unit_price",v),currency)}
        {field("采购成本","sourcing_cost",b2c.sourcing_cost,v=>setB2C("sourcing_cost",v),currency)}
        {field("单件物流","freight",b2c.freight,v=>setB2C("freight",v),currency)}
        {field("关税 / 税费","duties",b2c.duties,v=>setB2C("duties",v),currency)}
        {field("履约成本","fulfillment",b2c.fulfillment,v=>setB2C("fulfillment",v),currency)}
        {field("其他单件成本","other_costs",b2c.other_costs,v=>setB2C("other_costs",v),currency)}
        {field("平台费率","platform_fee_pct",b2c.platform_fee_pct,v=>setB2C("platform_fee_pct",v),"%")}
        {field("广告占比","ad_cost_pct",b2c.ad_cost_pct,v=>setB2C("ad_cost_pct",v),"%")}
        {field("预期退货损失率","expected_returns_pct",b2c.expected_returns_pct,v=>setB2C("expected_returns_pct",v),"%")}
      </div>:<div className="profit-input-grid">
        {field("批发单价","unit_price",b2b.unit_price,v=>setB2B("unit_price",v),currency)}
        {field("订货数量","quantity",b2b.quantity,v=>setB2B("quantity",v),"件","1")}
        {field("采购单价","sourcing_cost",b2b.sourcing_cost,v=>setB2B("sourcing_cost",v),currency)}
        {field("单件运费","freight_per_unit",b2b.freight_per_unit,v=>setB2B("freight_per_unit",v),currency)}
        {field("单件关税","duties_per_unit",b2b.duties_per_unit,v=>setB2B("duties_per_unit",v),currency)}
        {field("单件包装","packaging_per_unit",b2b.packaging_per_unit,v=>setB2B("packaging_per_unit",v),currency)}
        {field("验货总成本","inspection_total",b2b.inspection_total,v=>setB2B("inspection_total",v),currency)}
        {field("模具 / 开发费","setup_cost",b2b.setup_cost,v=>setB2B("setup_cost",v),currency)}
        {field("汇率风险准备","fx_reserve_pct",b2b.fx_reserve_pct,v=>setB2B("fx_reserve_pct",v),"%")}
        {field("其他单件成本","other_costs",b2b.other_costs,v=>setB2B("other_costs",v),currency)}
      </div>}
      <TextArea id="profit-assumptions" labelText="假设 / 来源说明" rows={2} maxLength={4000} value={assumptions} onChange={e=>setAssumptions(e.target.value)} placeholder="例如：供应商报价日期、物流估算来源、平台费率依据、目标市场…"/>
      <div className="profit-results"><div><span>收入</span><strong>{money(result.revenue,currency)}</strong></div><div><span>总成本</span><strong>{money(result.costs,currency)}</strong></div><div className={result.profit>=0?"profit-positive":"profit-negative"}><span>贡献利润</span><strong>{money(result.profit,currency)}</strong></div><div><span>贡献利润率</span><strong>{result.margin.toFixed(2)}%</strong></div>{scenario==="b2b"&&<div><span>盈亏平衡数量</span><strong>{result.breakEven===null?"无法达到":result.breakEven.toLocaleString()+" 件"}</strong></div>}</div>
      {error&&<InlineNotification kind="error" lowContrast title="计算器错误" subtitle={error} hideCloseButton/>}{savedId&&<InlineNotification kind="success" lowContrast title="已保存利润情景" subtitle={`情景 ID：${savedId}`} hideCloseButton/>}
      <div className="profit-actions"><span><Security size={14}/>前端实时预览；保存时由数据库独立复算。</span><Button kind="primary" type="submit" disabled={saving||!valid||!isSupabaseConfigured}><Save size={14}/>{saving?"保存中…":"保存利润情景"}</Button></div>
    </form>
  </section>;
}
