import { useEffect, useState, type FormEvent } from "react";
import { Button, Column, Grid, InlineNotification, Select, SelectItem, TextInput, Tile, Tag, ProgressIndicator, ProgressStep } from "@carbon/react";
import { Add, ArrowRight, Search, Renew, Document, WarningAlt, CheckmarkOutline, ChartLine, Globe, Delivery, Security, Calculator, UserMultiple, Task } from "@carbon/react/icons";
import { createProduct, listProducts, type ProductRecord } from "../lib/api";

const stages = [
  { id:"discovery", title:"机会发现", detail:"全球趋势、搜索与行业信号", icon:Search, outputs:["候选机会","信号来源","市场范围"] },
  { id:"normalize", title:"机会标准化", detail:"产品实体、分类、地区与去重", icon:Globe, outputs:["标准产品实体","市场细分","匹配置信度"] },
  { id:"demand", title:"需求验证", detail:"真实行为、代理指标与市场规模", icon:ChartLine, outputs:["需求证据","TAM / SAM / SOM","不确定性"] },
  { id:"competition", title:"竞争与客户", detail:"竞争格局、客户痛点与支付意愿", icon:UserMultiple, outputs:["竞品矩阵","客户证据","价格定位"] },
  { id:"supply", title:"供应链研究", detail:"供应商身份、报价、产能与交付", icon:Delivery, outputs:["供应商档案","有效报价","执行风险"] },
  { id:"risk", title:"合规与风险", detail:"法规、知识产权、贸易与安全", icon:Security, outputs:["风险登记册","硬性准入门槛","人工审查"] },
  { id:"finance", title:"财务与投资模型", detail:"三情景现金流、单位经济与敏感性", icon:Calculator, outputs:["财务假设","情景结果","模型版本"] },
  { id:"assessment", title:"投资评估", detail:"确定性评分、证据覆盖与建议", icon:Task, outputs:["加权评分","证据质量","投资建议"] },
  { id:"decision", title:"人工决策与监控", detail:"审批、决议记录与持续跟踪", icon:CheckmarkOutline, outputs:["审批记录","决策理由","监控计划"] }
] as const;

type Props = { toast:(message:string)=>void };
export default function ResearchWorkspace({toast}:Props) {
  const [products,setProducts]=useState<ProductRecord[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState("");
  const [stage,setStage]=useState(0);
  const [showCreate,setShowCreate]=useState(false);
  const [name,setName]=useState("");
  const [brand,setBrand]=useState("");
  const [category,setCategory]=useState("");
  const [saving,setSaving]=useState(false);
  const [market,setMarket]=useState("global");
  const [researchMode,setResearchMode]=useState("hybrid");
  const active=products.find(p=>p.id===selected)??products[0];
  const current=stages[stage];
  const reload=async()=>{setLoading(true);setError("");try{const rows=await listProducts();setProducts(rows);if(!selected&&rows[0])setSelected(rows[0].id);}catch(e){setError(e instanceof Error?e.message:"读取研究产品失败");}finally{setLoading(false);}};
  useEffect(()=>{void reload();},[]);
  async function save(e:FormEvent){e.preventDefault();setSaving(true);setError("");try{const p=await createProduct({canonical_name:name.trim(),brand:brand.trim(),category_path:category.split("/").map(x=>x.trim()).filter(Boolean)});setName("");setBrand("");setCategory("");setShowCreate(false);await reload();setSelected(p.id);toast("研究产品主档已创建。请从机会发现阶段开始补充证据。");}catch(x){setError(x instanceof Error?x.message:"创建研究产品失败");}finally{setSaving(false);}}
  const stageStatus=(index:number)=>index===0?"进行中":"未开始";
  return <div className="ur-research">
    <div className="ur-research-lead">
      <div><div className="ur-eyebrow">GLOBAL PRODUCT INVESTMENT INTELLIGENCE</div><h2>从市场信号，到可审查的投资决策。</h2><p>九阶段研究流程。每个结论都需要证据，每个关键判断都保留人工验证。</p></div>
      <div className="ur-lead-actions"><Button kind="tertiary" renderIcon={Renew} onClick={()=>void reload()}>刷新数据</Button><Button kind="primary" renderIcon={Add} onClick={()=>setShowCreate(v=>!v)}>新建研究对象</Button></div>
    </div>
    <Grid fullWidth className="ur-metrics">
      <Column sm={4} md={4} lg={4}><Tile><span className="ur-metric-label">研究对象</span><strong className="ur-metric-value">{loading?"—":products.length}</strong><span className="ur-muted">Supabase 产品主档</span></Tile></Column>
      <Column sm={4} md={4} lg={4}><Tile><span className="ur-metric-label">研究阶段</span><strong className="ur-metric-value">09</strong><span className="ur-muted">统一阶段门控</span></Tile></Column>
      <Column sm={4} md={4} lg={4}><Tile><span className="ur-metric-label">研究方法</span><strong className="ur-metric-value">Hybrid</strong><span className="ur-muted">AI 分析 + 人工验证</span></Tile></Column>
      <Column sm={4} md={4} lg={4}><Tile><span className="ur-metric-label">证据原则</span><strong className="ur-metric-value">Evidence-first</strong><span className="ur-muted">不以缺失数据默认打分</span></Tile></Column>
    </Grid>
    {showCreate&&<Tile className="ur-create-panel"><form onSubmit={save}><h3>创建产品研究档案</h3><p>只创建产品实体，不会伪造需求、销量、利润或投资评分。</p><div className="ur-form-grid"><TextInput id="ur-new-name" labelText="产品 / 机会名称 *" required value={name} onChange={e=>setName(e.target.value)} placeholder="例如：便携式储能配件"/><TextInput id="ur-new-brand" labelText="品牌（可选）" value={brand} onChange={e=>setBrand(e.target.value)}/><TextInput id="ur-new-category" labelText="分类路径（用 / 分隔）" value={category} onChange={e=>setCategory(e.target.value)} placeholder="能源 / 储能 / 配件"/></div><div className="ur-form-actions"><Button kind="secondary" type="button" onClick={()=>setShowCreate(false)}>取消</Button><Button kind="primary" type="submit" disabled={saving}>{saving?"保存中…":"创建研究档案"}</Button></div></form></Tile>}
    {error&&<InlineNotification kind="error" lowContrast title="研究工作区错误" subtitle={error} onCloseButtonClick={()=>setError("")}/>}
    <Grid fullWidth className="ur-workspace-grid">
      <Column sm={4} md={8} lg={4}><Tile className="ur-object-panel"><div className="ur-panel-head"><div><h3>研究对象</h3><p>产品机会档案</p></div><Button kind="ghost" size="sm" hasIconOnly renderIcon={Add} iconDescription="新建研究对象" onClick={()=>setShowCreate(true)}/></div><TextInput id="ur-object-search" labelText="筛选研究对象" placeholder="搜索产品名称…" size="sm" onChange={e=>{const q=e.target.value.toLowerCase();const hit=products.find(p=>p.canonical_name.toLowerCase().includes(q));if(hit)setSelected(hit.id);}}/><div className="ur-object-list">{products.map(p=><button type="button" key={p.id} className={p.id===active?.id?"ur-object ur-object--active":"ur-object"} onClick={()=>{setSelected(p.id);setStage(0);}}><span className="ur-object-symbol">{p.canonical_name.slice(0,1).toUpperCase()}</span><span><strong>{p.canonical_name}</strong><small>{p.category_path.join(" / ")||"尚未分类"}</small></span><ArrowRight size={14}/></button>)}{!loading&&products.length===0&&<div className="ur-empty">暂无研究对象。创建第一个产品档案以启动研究。</div>}</div></Tile></Column>
      <Column sm={4} md={8} lg={12}><div className="ur-main-research">
        <Tile className="ur-stage-panel"><div className="ur-panel-head ur-stage-heading"><div><span className="ur-eyebrow">RESEARCH WORKFLOW</span><h3>{active?.canonical_name??"选择或创建一个研究对象"}</h3><p>{active?"研究档案 · 全球市场 · 混合研究模式":"研究流程将关联到唯一的产品实体，所有结论保留证据来源。"}</p></div><Tag type="blue">{active?.status??"待创建"}</Tag></div>
          <div className="ur-context-fields"><Select id="ur-market" labelText="研究市场" value={market} onChange={e=>setMarket(e.target.value)}><SelectItem value="global" text="全球市场"/><SelectItem value="north-america" text="北美"/><SelectItem value="europe" text="欧洲"/><SelectItem value="asia-pacific" text="亚太"/></Select><Select id="ur-mode" labelText="研究模式" value={researchMode} onChange={e=>setResearchMode(e.target.value)}><SelectItem value="hybrid" text="AI 自动研究 + 人工验证"/><SelectItem value="assisted" text="人工主导 + AI 辅助"/></Select></div>
          <ProgressIndicator currentIndex={stage} spaceEqually={false} className="ur-progress">{stages.map((s,i)=><ProgressStep key={s.id} label={s.title} description={stageStatus(i)} current={i===stage} complete={false} onClick={()=>setStage(i)}/>)}</ProgressIndicator>
          <div className="ur-stage-detail"><div className="ur-stage-icon"><current.icon size={22}/></div><div className="ur-stage-copy"><span className="ur-eyebrow">STAGE {String(stage+1).padStart(2,"0")} / 09</span><h3>{current.title}</h3><p>{current.detail}</p></div><Tag type={stage===0?"blue":"cool-gray"}>{stage===0?"待启动":"未开始"}</Tag></div>
          <div className="ur-stage-columns"><div><h4>本阶段预期产出</h4><ul>{current.outputs.map(x=><li key={x}>{x}</li>)}</ul></div><div><h4>阶段通过原则</h4><p>必须存在可追溯来源、明确市场范围、记录数据时间与方法。AI 完成任务不代表阶段自动通过；关键结论需人工验证。</p></div></div>
          <div className="ur-stage-nav"><Button kind="tertiary" disabled={stage===0} onClick={()=>setStage(s=>Math.max(0,s-1))}>上一阶段</Button><span>阶段 {stage+1} / 9</span><Button kind="primary" renderIcon={ArrowRight} disabled={stage===8} onClick={()=>setStage(s=>Math.min(8,s+1))}>查看下一阶段</Button></div>
        </Tile>
        <Grid fullWidth className="ur-support-grid"><Column sm={4} md={4} lg={6}><Tile className="ur-support-tile"><div className="ur-panel-head"><div><h4>证据与研究质量</h4><p>来源记录与核验状态</p></div><Document size={20}/></div><div className="ur-empty-state"><WarningAlt size={18}/><span>尚无关联证据。未采集前不展示需求结论或投资评分。</span></div></Tile></Column><Column sm={4} md={4} lg={6}><Tile className="ur-support-tile"><div className="ur-panel-head"><div><h4>AI 研究角色</h4><p>按阶段分配专门 Agent</p></div><Task size={20}/></div><div className="ur-agent-list">{["Market Research Agent","Competitor & Customer Agent","Supply Chain Agent","Risk & Compliance Agent","Investment Analyst Agent"].map((a,i)=><div key={a}><span>{a}</span><Tag type="cool-gray">待接入</Tag></div>)}</div></Tile></Column></Grid>
      </div></Column>
    </Grid>
    <Tile className="ur-principles"><h3>研究可信度规则</h3><div className="ur-principle-grid"><div><strong>Observed</strong><span>真实交易、实际行为与可核查记录</span></div><div><strong>Proxy</strong><span>搜索趋势、评论量等代理指标</span></div><div><strong>Estimated</strong><span>模型估计，必须公开假设与区间</span></div><div><strong>Human verified</strong><span>人工核验，不等同于 AI 自评置信度</span></div></div></Tile>
  </div>;
}
