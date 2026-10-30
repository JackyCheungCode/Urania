import { useMemo, useState, type FormEvent } from "react";
import { InlineNotification, Select, SelectItem, TextInput, Tile } from "@carbon/react";
import { calculateInvestmentCase, validateInvestmentInputs, type InvestmentInputs } from "../lib/investment-model";
import { saveResearchFinancialModel } from "../lib/api";

const initial: InvestmentInputs = { currency: "USD", horizonMonths: 36, initialInvestment: 150000, workingCapital: 30000, yearOneRevenue: 240000, annualGrowthRate: 0.2, grossMarginRate: 0.42, operatingExpenseRate: 0.18, fixedMonthlyCost: 5000, taxRate: 0.2, discountRate: 0.15 };
const money = (value: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

export default function InvestmentModelPanel({ opportunityId }: { opportunityId: string }) {
  const [inputs, setInputs] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState("");
  const [savedVersion,setSavedVersion]=useState<number|null>(null);
  const errors = useMemo(() => validateInvestmentInputs(inputs), [inputs]);
  const results = useMemo(() => errors.length ? null : ({
    downside: calculateInvestmentCase(inputs, "downside"),
    base: calculateInvestmentCase(inputs, "base"),
    upside: calculateInvestmentCase(inputs, "upside")
  }), [inputs, errors]);
  function update<K extends keyof InvestmentInputs>(key: K, value: InvestmentInputs[K]) {
    setInputs(current => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent) { event.preventDefault(); setTouched(true); setSaveError("");setSavedVersion(null);if(errors.length||!results||!opportunityId)return;setSaving(true);try{const saved=await saveResearchFinancialModel({opportunity_id:opportunityId,currency:inputs.currency,horizon_months:inputs.horizonMonths,inputs:inputs as unknown as Record<string,unknown>,outputs:results as unknown as Record<string,unknown>,calculation_engine_version:"urania-investment-v1.0",assumptions_snapshot:{source:"user_entered_assumptions",scenario_method:"deterministic_v1"}});setSavedVersion(saved.model_version);}catch(error){setSaveError(error instanceof Error?error.message:"财务模型保存失败。");}finally{setSaving(false);}}
  const fields: Array<{key: Exclude<keyof InvestmentInputs, "currency">; label: string; rate?: boolean; step?: string}> = [
    {key:"horizonMonths",label:"测算周期（月）",step:"1"},
    {key:"initialInvestment",label:"初始投资额"},{key:"workingCapital",label:"营运资金"},
    {key:"yearOneRevenue",label:"第一年收入假设"},{key:"annualGrowthRate",label:"年收入增长率",rate:true},
    {key:"grossMarginRate",label:"毛利率",rate:true},{key:"operatingExpenseRate",label:"变动运营费用率",rate:true},
    {key:"fixedMonthlyCost",label:"每月固定成本"},{key:"taxRate",label:"所得税率",rate:true},{key:"discountRate",label:"年折现率",rate:true}
  ];
  return <Tile className="panel research-portfolio-section investment-model-panel">
    <div className="section-title"><h3>05 · 确定性投资财务模型</h3><span className="muted">引擎 v1.0 · 确定性计算 · 版本化保存</span></div>
    <p className="panel-note">下行情景、基准情景和上行情景由确定性公式计算，不由 AI 生成。当前版本会保存不可覆盖的财务模型快照；所有输入均为待核实假设，不代表实际业绩或投资建议。</p>
    <form onSubmit={submit}>
      <div className="research-financial-fields">
        <Select id="investment-currency" labelText="报告币种" value={inputs.currency} onChange={e=>update("currency",e.target.value)}>
          {["USD","EUR","GBP","CNY","TWD","JPY"].map(c=><SelectItem key={c} value={c} text={c}/>)}
        </Select>
        {fields.map(field=><TextInput key={field.key} id={"investment-"+field.key} labelText={field.label+(field.rate?" (%)":"")} type="number" min="0" max={field.rate?100:undefined} step={field.step||"any"} value={field.rate?String(Number(inputs[field.key])*100):String(inputs[field.key])} onChange={e=>update(field.key,Number(e.target.value)/(field.rate?100:1))}/>)}
      </div>
      <button className="research-model-recalculate" type="submit" disabled={saving||!opportunityId||errors.length>0}>{saving?"保存中…":"校验、复算并保存版本"}</button>
      {!opportunityId&&<p className="panel-note">请先选择研究机会，才能保存财务模型版本。</p>}
    </form>
    {saveError&&<InlineNotification kind="error" lowContrast title="保存失败" subtitle={saveError} hideCloseButton/>}
    {savedVersion!==null&&<InlineNotification kind="success" lowContrast title="财务模型已保存" subtitle={`已创建第 ${savedVersion} 个不可覆盖的模型版本。`} hideCloseButton/>}
    {errors.length>0&&<InlineNotification kind="error" lowContrast title="输入需要修正" subtitle={errors.join(" ")} hideCloseButton/>}
    {touched&&errors.length===0&&<InlineNotification kind="success" lowContrast title="模型校验通过" subtitle="已按当前假设完成三种情景的确定性复算。" hideCloseButton/>}
    {results&&<div className="research-scenario-grid">
      {(["downside","base","upside"] as const).map(key=>{const result=results[key];const labels={downside:"下行",base:"基准",upside:"上行"};return <article className="research-scenario-card" key={key}>
        <h4>{labels[key]}情景</h4>
        <div><span>累计收入</span><strong>{money(result.revenue,inputs.currency)}</strong></div>
        <div><span>累计经营利润（税前）</span><strong>{money(result.operatingProfit,inputs.currency)}</strong></div>
        <div><span>税后经营现金流</span><strong>{money(result.netOperatingCash,inputs.currency)}</strong></div>
        <div><span>ROI</span><strong>{result.roi.toFixed(1)}%</strong></div>
        <div><span>NPV</span><strong>{money(result.npv,inputs.currency)}</strong></div>
        <div><span>IRR</span><strong>{result.irr===null?"无法求解":(result.irr*100).toFixed(1)+"%"}</strong></div>
        <div><span>回收期</span><strong>{result.paybackMonths===null?"周期内未回收":result.paybackMonths.toFixed(1)+" 个月"}</strong></div>
      </article>;})}
    </div>}
  </Tile>;
}
