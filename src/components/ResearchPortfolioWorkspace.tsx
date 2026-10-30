import { useEffect, useState, type FormEvent } from "react";
import InvestmentModelPanel from "./InvestmentModelPanel";
import { Button, Checkbox, InlineNotification, Select, SelectItem, TextArea, TextInput, Tile } from "@carbon/react";
import {
  createResearchProject, listResearchProjects, createResearchOpportunity, listResearchOpportunities,
  createResearchEvidenceSource, createResearchEvidence, listResearchEvidence, listResearchEvidenceSources, createResearchFinding, createResearchRisk, listResearchRisks, verifyResearchEvidence, type ResearchRiskRecord,
  type ResearchProjectRecord, type ResearchOpportunityRecord, type ResearchEvidenceRecord
} from "../lib/api";

export default function ResearchPortfolioWorkspace() {
  const [projects,setProjects]=useState<ResearchProjectRecord[]>([]);
  const [opportunities,setOpportunities]=useState<ResearchOpportunityRecord[]>([]);
  const [evidence,setEvidence]=useState<ResearchEvidenceRecord[]>([]);
  const [projectId,setProjectId]=useState("");
  const [opportunityId,setOpportunityId]=useState("");
  const [projectName,setProjectName]=useState("");
  const [objective,setObjective]=useState("");
  const [oppTitle,setOppTitle]=useState("");
  const [oppType,setOppType]=useState("product");
  const [publisher,setPublisher]=useState("");
  const [sourceType,setSourceType]=useState("web");
  const [sourceUrl,setSourceUrl]=useState("");
  const [license,setLicense]=useState("");
  const [claim,setClaim]=useState("");
  const [evidenceClass,setEvidenceClass]=useState("proxy_indicator");
  const [methodology,setMethodology]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [sourceId,setSourceId]=useState("");
  const [sourceIds,setSourceIds]=useState<Array<{id:string;label:string}>>([]);
  const [findingStage,setFindingStage]=useState("discovery");
  const [findingType,setFindingType]=useState("claim");
  const [findingClaim,setFindingClaim]=useState("");
  const [findingExplanation,setFindingExplanation]=useState("");
  const [risks,setRisks]=useState<ResearchRiskRecord[]>([]);
  const [riskCategory,setRiskCategory]=useState("regulatory");
  const [riskSeverity,setRiskSeverity]=useState("high");
  const [riskLikelihood,setRiskLikelihood]=useState("medium");
  const [riskDescription,setRiskDescription]=useState("");
  const [riskMitigation,setRiskMitigation]=useState("");
  const [riskVeto,setRiskVeto]=useState(false);
  const [verificationStatus,setVerificationStatus]=useState<"human_verified"|"disputed"|"rejected">("human_verified");
  const [verificationNote,setVerificationNote]=useState("");

  async function loadProjects() {
    const rows=await listResearchProjects();setProjects(rows);
    if(!projectId&&rows[0])setProjectId(rows[0].id);
  }
  async function loadOpportunities(id:string) {
    if(!id){setOpportunities([]);return;}
    const rows=await listResearchOpportunities(id);setOpportunities(rows);
    if(rows[0])setOpportunityId(rows[0].id);else setOpportunityId("");
  }
  async function loadEvidence(id:string) {
    if(!id){setEvidence([]);return;}
    setEvidence(await listResearchEvidence(id));
  }
  useEffect(()=>{void loadProjects().catch(e=>setError(e instanceof Error?e.message:"无法读取研究项目。"));void listResearchEvidenceSources().then(rows=>{setSourceIds(rows.map(s=>({id:s.id,label:s.publisher+(s.title?" · "+s.title:"")})));if(rows[0])setSourceId(rows[0].id);}).catch(e=>setError(e instanceof Error?e.message:"无法读取来源目录。"));},[]);
  useEffect(()=>{void loadOpportunities(projectId).catch(e=>setError(e instanceof Error?e.message:"无法读取机会。"));},[projectId]);
  useEffect(()=>{void loadEvidence(opportunityId).catch(e=>setError(e instanceof Error?e.message:"无法读取证据。"));if(opportunityId)void listResearchRisks(opportunityId).then(setRisks).catch(e=>setError(e instanceof Error?e.message:"无法读取风险登记簿。"));else setRisks([]);},[opportunityId]);

  async function saveProject(e:FormEvent) {
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try {const row=await createResearchProject({name:projectName,objective,geographies:["global"],investment_horizon:"1_3y",approval_policy:"tiered"});setProjectName("");setObjective("");await loadProjects();setProjectId(row.id);setNotice("研究项目已建立。");}
    catch(err){setError(err instanceof Error?err.message:"创建项目失败。");}finally{setBusy(false);}
  }
  async function saveOpportunity(e:FormEvent) {
    e.preventDefault();if(!projectId)return;setBusy(true);setError("");setNotice("");
    try {await createResearchOpportunity({project_id:projectId,title:oppTitle,opportunity_type:oppType});setOppTitle("");await loadOpportunities(projectId);setNotice("机会已加入项目。");}
    catch(err){setError(err instanceof Error?err.message:"创建机会失败。");}finally{setBusy(false);}
  }
  async function saveSource(e:FormEvent) {
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try {const row=await createResearchEvidenceSource({publisher,source_type:sourceType,source_url:sourceUrl||undefined,license_name:license||undefined});const id=String(row.id||"");setSourceId(id);setSourceIds(v=>[{id,label:publisher},...v.filter(x=>x.id!==id)]);setPublisher("");setSourceUrl("");setLicense("");setNotice("来源登记完成；接下来可将具体证据记录关联到该来源。");}
    catch(err){setError(err instanceof Error?err.message:"来源登记失败。");}finally{setBusy(false);}
  }
  async function saveFinding(e:FormEvent) {
    e.preventDefault();if(!opportunityId)return;setBusy(true);setError("");setNotice("");
    try {await createResearchFinding({opportunity_id:opportunityId,stage:findingStage,claim:findingClaim,explanation:findingExplanation||undefined,finding_type:findingType as "claim"|"observation"|"estimate"|"contradiction"|"gap"});setFindingClaim("");setFindingExplanation("");setNotice("研究阶段结论已保存；未关联证据的结论仍保持证据不足。");}
    catch(err){setError(err instanceof Error?err.message:"保存研究结论失败。");}finally{setBusy(false);}
  }
  async function verifyEvidence(id:string) {
    if(!verificationNote.trim())return;setBusy(true);setError("");setNotice("");
    try {await verifyResearchEvidence({evidence_id:id,status:verificationStatus,note:verificationNote});setVerificationNote("");if(opportunityId)await loadEvidence(opportunityId);setNotice("证据核验状态已更新，并写入审计历史。");}
    catch(err){setError(err instanceof Error?err.message:"证据核验失败。");}finally{setBusy(false);}
  }
  async function saveRisk(e:FormEvent) {
    e.preventDefault();if(!opportunityId)return;setBusy(true);setError("");setNotice("");
    try {await createResearchRisk({opportunity_id:opportunityId,risk_category:riskCategory,description:riskDescription,severity:riskSeverity,likelihood:riskLikelihood,hard_veto:riskVeto,mitigation_plan:riskMitigation||undefined});setRiskDescription("");setRiskMitigation("");setRiskVeto(false);setRisks(await listResearchRisks(opportunityId));setNotice("风险记录已保存；未解决的硬性否决项将阻止进入投资批准流程。");}
    catch(err){setError(err instanceof Error?err.message:"风险记录保存失败。");}finally{setBusy(false);}
  }
  async function saveEvidence(e:FormEvent) {
    e.preventDefault();if(!opportunityId||!sourceId)return;setBusy(true);setError("");setNotice("");
    try {await createResearchEvidence({opportunity_id:opportunityId,evidence_source_id:sourceId,evidence_class:evidenceClass,claim_supported:claim,methodology:methodology||undefined});setClaim("");setMethodology("");await loadEvidence(opportunityId);setNotice("证据记录已保存，当前状态为未验证。");}
    catch(err){setError(err instanceof Error?err.message:"保存证据失败。");}finally{setBusy(false);}
  }
  return <Tile className="panel research-portfolio-workspace">
    <div className="section-title"><h2>投资研究项目与证据库</h2><span className="muted">真实数据库 · 人工验证</span></div>
    <p className="panel-note">项目、机会、来源和证据均按账号归属隔离。登记来源不代表数据已核验；代理指标、观察数据与模型估计分别标记。</p>
    {error&&<InlineNotification kind="error" lowContrast title="操作未完成" subtitle={error} onCloseButtonClick={()=>setError("")}/>}
    {notice&&<InlineNotification kind="success" lowContrast title="已保存" subtitle={notice} onCloseButtonClick={()=>setNotice("")}/>}
    <div className="research-portfolio-grid">
      <section className="research-portfolio-section">
        <h3>01 · 研究项目</h3>
        <form onSubmit={saveProject} className="research-portfolio-form">
          <TextInput id="research-project-name" labelText="项目名称" value={projectName} onChange={e=>setProjectName(e.target.value)} required />
          <TextArea id="research-project-objective" labelText="研究目标（至少 10 个字符）" value={objective} onChange={e=>setObjective(e.target.value)} required rows={2}/>
          <Button type="submit" size="sm" disabled={busy}>创建项目</Button>
        </form>
        <Select id="research-project-select" labelText="当前项目" value={projectId} onChange={e=>setProjectId(e.target.value)}>
          {projects.map(p=><SelectItem key={p.id} value={p.id} text={p.name}/>)}
        </Select>
        <div className="research-portfolio-list">{projects.map(p=><div key={p.id} className="research-portfolio-row"><strong>{p.name}</strong><span>{p.status} · {p.investment_horizon}</span></div>)}{projects.length===0&&<p className="muted">尚无研究项目。</p>}</div>
      </section>
      <section className="research-portfolio-section">
        <h3>02 · 机会池</h3>
        <form onSubmit={saveOpportunity} className="research-portfolio-form">
          <TextInput id="research-opportunity-title" labelText="机会名称" value={oppTitle} onChange={e=>setOppTitle(e.target.value)} required/>
          <Select id="research-opportunity-type" labelText="机会类型" value={oppType} onChange={e=>setOppType(e.target.value)}>
            <SelectItem value="product" text="实体产品"/><SelectItem value="software" text="软件"/><SelectItem value="service" text="服务"/><SelectItem value="technology" text="技术"/><SelectItem value="industry" text="行业"/><SelectItem value="business_model" text="商业模式"/><SelectItem value="other" text="其他"/>
          </Select>
          <Button type="submit" size="sm" disabled={busy||!projectId}>新增机会</Button>
        </form>
        <Select id="research-opportunity-select" labelText="当前机会" value={opportunityId} onChange={e=>setOpportunityId(e.target.value)}>
          {opportunities.map(o=><SelectItem key={o.id} value={o.id} text={o.title}/>)}
        </Select>
        <div className="research-portfolio-list">{opportunities.map(o=><div key={o.id} className="research-portfolio-row"><strong>{o.title}</strong><span>{o.stage} · {o.decision_status}</span></div>)}{opportunities.length===0&&<p className="muted">当前项目尚无机会。</p>}</div>
      </section>
    </div>
    <div className="research-portfolio-grid">
      <section className="research-portfolio-section">
        <h3>03 · 数据来源登记</h3>
        <form onSubmit={saveSource} className="research-portfolio-form">
          <TextInput id="research-source-publisher" labelText="发布者 / 机构" value={publisher} onChange={e=>setPublisher(e.target.value)} required/>
          <Select id="research-source-type" labelText="来源类型" value={sourceType} onChange={e=>setSourceType(e.target.value)}>
            <SelectItem value="transaction" text="交易数据"/><SelectItem value="government" text="政府数据"/><SelectItem value="industry_report" text="行业报告"/><SelectItem value="academic" text="学术研究"/><SelectItem value="web" text="网页"/><SelectItem value="interview" text="访谈"/><SelectItem value="survey" text="问卷"/><SelectItem value="supplier_document" text="供应商文件"/><SelectItem value="financial_filing" text="财报"/><SelectItem value="other" text="其他"/>
          </Select>
          <TextInput id="research-source-url" labelText="来源 URL（可选）" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://"/>
          <TextInput id="research-source-license" labelText="许可 / 使用范围" value={license} onChange={e=>setLicense(e.target.value)}/>
          <Button type="submit" size="sm" disabled={busy}>登记来源</Button>
        </form>
        {sourceId&&<p className="panel-note">最近登记来源：{sourceIds[0]?.label||"已登记"}</p>}
      </section>
      <section className="research-portfolio-section">
        <h3>04 · 证据记录</h3>
        <form onSubmit={saveEvidence} className="research-portfolio-form">
          <Select id="research-evidence-source" labelText="关联来源" value={sourceId} onChange={e=>setSourceId(e.target.value)}>
            {sourceIds.map(s=><SelectItem key={s.id} value={s.id} text={s.label}/>)}
          </Select>
          <Select id="research-evidence-class" labelText="证据类别" value={evidenceClass} onChange={e=>setEvidenceClass(e.target.value)}>
            <SelectItem value="observed_transaction" text="观察到的交易"/><SelectItem value="observed_behavior" text="观察到的行为"/><SelectItem value="proxy_indicator" text="代理指标"/><SelectItem value="model_estimate" text="模型估计"/><SelectItem value="expert_opinion" text="专家意见"/><SelectItem value="primary_research" text="一手调研"/>
          </Select>
          <TextArea id="research-evidence-claim" labelText="该证据支持的具体主张" value={claim} onChange={e=>setClaim(e.target.value)} required rows={2}/>
          <TextArea id="research-evidence-method" labelText="方法、口径与限制" value={methodology} onChange={e=>setMethodology(e.target.value)} rows={2}/>
          <Button type="submit" size="sm" disabled={busy||!opportunityId||!sourceId}>保存证据</Button>
        </form>
      </section>
    </div>
    <div className="research-portfolio-grid">
      <section className="research-portfolio-section">
        <h3>05 · 阶段研究结论</h3>
        <p className="panel-note">按九阶段研究流程记录主张、观察、估计、矛盾与数据缺口。当前接口不自动将主张标记为已验证。</p>
        <form onSubmit={saveFinding} className="research-portfolio-form">
          <Select id="research-finding-stage" labelText="研究阶段" value={findingStage} onChange={e=>setFindingStage(e.target.value)}>
            <SelectItem value="discovery" text="机会发现"/><SelectItem value="standardization" text="定义与标准化"/><SelectItem value="demand" text="市场需求"/><SelectItem value="competition" text="竞争分析"/><SelectItem value="customer" text="客户研究"/><SelectItem value="supply_chain" text="供应链"/><SelectItem value="compliance" text="合规与风险"/><SelectItem value="financial" text="财务模型"/><SelectItem value="investment" text="投资评估"/><SelectItem value="monitoring" text="投后监测"/>
          </Select>
          <Select id="research-finding-type" labelText="结论类型" value={findingType} onChange={e=>setFindingType(e.target.value)}>
            <SelectItem value="claim" text="研究主张"/><SelectItem value="observation" text="观察事实"/><SelectItem value="estimate" text="模型估计"/><SelectItem value="contradiction" text="相互矛盾"/><SelectItem value="gap" text="证据缺口"/>
          </Select>
          <TextArea id="research-finding-claim" labelText="结论 / 主张" value={findingClaim} onChange={e=>setFindingClaim(e.target.value)} required rows={2}/>
          <TextArea id="research-finding-explanation" labelText="解释、边界与待验证事项" value={findingExplanation} onChange={e=>setFindingExplanation(e.target.value)} rows={2}/>
          <Button type="submit" size="sm" disabled={busy||!opportunityId}>保存阶段结论</Button>
        </form>
      </section>
      <InvestmentModelPanel opportunityId={opportunityId} />
    </div>
    {risks.some(r=>r.hard_veto&&["open","mitigating"].includes(r.status))&&<InlineNotification kind="error" lowContrast title="存在未解除的硬性否决风险" subtitle="当前机会不得进入投资批准；必须先完成风险核验并由授权人员关闭风险。" hideCloseButton/>}
    <div className="research-portfolio-grid">
      <section className="research-portfolio-section">
        <h3>06 · 合规风险与硬性否决</h3>
        <p className="panel-note">硬性否决是独立约束，不会被商业评分或财务回报抵消。录入风险不代表风险已解决；当前版本只支持登记与查看。</p>
        <form onSubmit={saveRisk} className="research-portfolio-form">
          <Select id="research-risk-category" labelText="风险类别" value={riskCategory} onChange={e=>setRiskCategory(e.target.value)}>{["legal","regulatory","sanctions","ip","safety","environmental","labor","supplier","market","financial","execution","reputation","other"].map(v=><SelectItem key={v} value={v} text={v}/>)}</Select>
          <Select id="research-risk-severity" labelText="严重程度" value={riskSeverity} onChange={e=>setRiskSeverity(e.target.value)}><SelectItem value="low" text="低"/><SelectItem value="medium" text="中"/><SelectItem value="high" text="高"/><SelectItem value="critical" text="严重"/></Select>
          <Select id="research-risk-likelihood" labelText="发生可能性" value={riskLikelihood} onChange={e=>setRiskLikelihood(e.target.value)}><SelectItem value="unknown" text="未知"/><SelectItem value="low" text="低"/><SelectItem value="medium" text="中"/><SelectItem value="high" text="高"/></Select>
          <TextArea id="research-risk-description" labelText="风险描述" value={riskDescription} onChange={e=>setRiskDescription(e.target.value)} required rows={2}/>
          <TextArea id="research-risk-mitigation" labelText="缓解措施 / 核验计划" value={riskMitigation} onChange={e=>setRiskMitigation(e.target.value)} rows={2}/>
          <Checkbox id="research-risk-veto" labelText="设为硬性否决项（未解除前不得批准投资）" checked={riskVeto} onChange={(_,data)=>setRiskVeto(data.checked)}/>
          <Button type="submit" size="sm" disabled={busy||!opportunityId}>登记风险</Button>
        </form>
        <div className="research-portfolio-list">{risks.map(r=><div key={r.id} className="research-portfolio-row"><strong>{r.description}</strong><span>{r.risk_category} · {r.severity} · {r.status} {r.hard_veto?" · 硬性否决":""}</span></div>)}{risks.length===0&&<p className="muted">当前机会尚无风险记录。</p>}</div>
      </section>
    </div>
    <section className="research-portfolio-evidence">
      <h3>证据时间线 <span className="muted">· {evidence.length} 条</span></h3>
      {evidence.length===0?<p className="muted">选择一个机会并登记证据后，证据将显示在此处。</p>:evidence.map(e=><article className="research-evidence-row" key={e.id}>
        <div><strong>{e.claim_supported}</strong><p>{e.publisher||"来源未命名"} · {e.source_url||"未提供 URL"}</p><small>{e.evidence_class} · 收集于 {new Date(e.collected_at).toLocaleString()}</small></div>
        <div className="research-evidence-actions"><span className="badge badge--amber">{e.verification_status}</span><Button size="sm" kind="tertiary" disabled={busy||verificationNote.trim().length<8} onClick={()=>void verifyEvidence(e.id)}>提交核验</Button></div>
      </article>)}
    </section>
  </Tile>;
}
