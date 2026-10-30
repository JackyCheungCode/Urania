import { useEffect, useState, type FormEvent } from "react";
import InvestmentModelPanel from "./InvestmentModelPanel";
import MarketSizingPanel from "./MarketSizingPanel";
import ResearchScorePanel from "./ResearchScorePanel";
import { Button, Checkbox, InlineNotification, Select, SelectItem, TextArea, TextInput, Tile } from "@carbon/react";
import {
  createResearchProject, listResearchProjects, createResearchOpportunity, listResearchOpportunities,
  createResearchEvidenceSource, createResearchEvidence, listResearchEvidence, listResearchEvidenceSources, createResearchFinding, createResearchRisk, listResearchRisks, verifyResearchEvidence, type ResearchRiskRecord, listResearchFindings, type ResearchFindingRecord, submitResearchDecision, approveResearchDecision, listResearchDecisions, type ResearchDecisionRecord, reviewResearchRisk, createAIResearchJob, listResearchAuditEvents, type ResearchAuditEvent, listResearchFinancialModels, createResearchSearchJob, listResearchSearchResults, type ResearchSearchResultRecord,
  type ResearchProjectRecord, type ResearchOpportunityRecord, type ResearchEvidenceRecord
} from "../lib/api";

export default function ResearchPortfolioWorkspace() {
  const [projects,setProjects]=useState<ResearchProjectRecord[]>([]);
  const [opportunities,setOpportunities]=useState<ResearchOpportunityRecord[]>([]);
  const [evidence,setEvidence]=useState<ResearchEvidenceRecord[]>([]);
  const [searchResults,setSearchResults]=useState<ResearchSearchResultRecord[]>([]);
  const [searchQuery,setSearchQuery]=useState("");
  const [searchCountry,setSearchCountry]=useState("");
  const [importedSearchIds,setImportedSearchIds]=useState<string[]>([]);
  const [projectId,setProjectId]=useState("");
  const [opportunityId,setOpportunityId]=useState("");
  const [projectName,setProjectName]=useState("");
  const [objective,setObjective]=useState("");
  const [budgetAmount,setBudgetAmount]=useState("");
  const [budgetCurrency,setBudgetCurrency]=useState("USD");
  const [projectHorizon,setProjectHorizon]=useState<"under_1y"|"1_3y"|"3_5y"|"over_5y">("1_3y");
  const [approvalPolicy,setApprovalPolicy]=useState<"owner"|"committee"|"tiered">("tiered");
  const [oppTitle,setOppTitle]=useState("");
  const [oppType,setOppType]=useState<"product"|"software"|"service"|"technology"|"industry"|"business_model"|"other">("product");
  const [publisher,setPublisher]=useState("");
  const [sourceTitle,setSourceTitle]=useState("");
  const [licenseScope,setLicenseScope]=useState("");
  const [sourceType,setSourceType]=useState("web");
  const [sourceUrl,setSourceUrl]=useState("");
  const [license,setLicense]=useState("");
  const [claim,setClaim]=useState("");
  const [evidenceClass,setEvidenceClass]=useState("proxy_indicator");
  const [methodology,setMethodology]=useState("");
  const [metricName,setMetricName]=useState("");
  const [metricValue,setMetricValue]=useState("");
  const [metricUnit,setMetricUnit]=useState("");
  const [evidenceGeography,setEvidenceGeography]=useState("");
  const [publishedAt,setPublishedAt]=useState("");
  const [observedAt,setObservedAt]=useState("");
  const [evidenceConfidence,setEvidenceConfidence]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [sourceId,setSourceId]=useState("");
  const [sourceIds,setSourceIds]=useState<Array<{id:string;label:string}>>([]);
  const [findingStage,setFindingStage]=useState("discovery");
  const [findingType,setFindingType]=useState("claim");
  const [findingClaim,setFindingClaim]=useState("");
  const [findingExplanation,setFindingExplanation]=useState("");
  const [evidenceFindingId,setEvidenceFindingId]=useState("");
  const [risks,setRisks]=useState<ResearchRiskRecord[]>([]);
  const [findings,setFindings]=useState<ResearchFindingRecord[]>([]);
  const [riskCategory,setRiskCategory]=useState("regulatory");
  const [riskSeverity,setRiskSeverity]=useState("high");
  const [riskLikelihood,setRiskLikelihood]=useState("medium");
  const [riskDescription,setRiskDescription]=useState("");
  const [riskMitigation,setRiskMitigation]=useState("");
  const [riskVeto,setRiskVeto]=useState(false);
  const [riskReviewStatus,setRiskReviewStatus]=useState<"open"|"mitigating"|"accepted"|"resolved"|"false_positive">("resolved");
  const [riskReviewNote,setRiskReviewNote]=useState("");
  const [verificationStatus,setVerificationStatus]=useState<"human_verified"|"disputed"|"rejected">("human_verified");
  const [verificationNote,setVerificationNote]=useState("");
  const [decisions,setDecisions]=useState<ResearchDecisionRecord[]>([]);
  const [auditEvents,setAuditEvents]=useState<ResearchAuditEvent[]>([]);
  const [decisionChoice,setDecisionChoice]=useState<"invest"|"validate_more"|"defer"|"reject">("validate_more");
  const [decisionRationale,setDecisionRationale]=useState("");
  const [scoreSnapshot,setScoreSnapshot]=useState<{commercialScore:number;evidenceCoverage:number;evidenceReadiness:number}|null>(null);
  const [aiProvider,setAiProvider]=useState<"openai_api"|"anthropic_api"|"google_gemini_api">("openai_api");
  const [aiQuery,setAiQuery]=useState("");
  const [aiContext,setAiContext]=useState("");

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
  useEffect(()=>{void loadEvidence(opportunityId).catch(e=>setError(e instanceof Error?e.message:"无法读取证据。"));if(opportunityId){void listResearchRisks(opportunityId).then(setRisks).catch(e=>setError(e instanceof Error?e.message:"无法读取风险登记簿。"));void listResearchFindings(opportunityId).then(setFindings).catch(e=>setError(e instanceof Error?e.message:"无法读取阶段结论。"));void listResearchDecisions(opportunityId).then(setDecisions).catch(e=>setError(e instanceof Error?e.message:"无法读取投资决策历史。"));void listResearchAuditEvents(opportunityId).then(setAuditEvents).catch(e=>setError(e instanceof Error?e.message:"无法读取审计时间线。"));void listResearchSearchResults(opportunityId).then(setSearchResults).catch(e=>setError(e instanceof Error?e.message:"无法读取搜索结果。"));setImportedSearchIds([]);}else{setRisks([]);setFindings([]);setDecisions([]);setAuditEvents([]);setSearchResults([]);setImportedSearchIds([]);}},[opportunityId]);

  async function refreshAudit(){if(opportunityId)setAuditEvents(await listResearchAuditEvents(opportunityId));}
  async function saveProject(e:FormEvent) {
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try {const row=await createResearchProject({name:projectName,objective,geographies:["global"],investment_horizon:projectHorizon,investment_budget:budgetAmount.trim()?{amount:Number(budgetAmount),currency:budgetCurrency}: {},approval_policy:approvalPolicy});setProjectName("");setObjective("");setBudgetAmount("");await loadProjects();setProjectId(row.id);setNotice("研究项目已建立。");}
    catch(err){setError(err instanceof Error?err.message:"创建项目失败。");}finally{setBusy(false);}
  }
  async function saveOpportunity(e:FormEvent) {
    e.preventDefault();if(!projectId)return;setBusy(true);setError("");setNotice("");
    try {await createResearchOpportunity({project_id:projectId,title:oppTitle,opportunity_type:oppType});setOppTitle("");await loadOpportunities(projectId);setNotice("机会已加入项目。");}
    catch(err){setError(err instanceof Error?err.message:"创建机会失败。");}finally{setBusy(false);}
  }
  async function saveSource(e:FormEvent) {
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try {const row=await createResearchEvidenceSource({publisher,source_type:sourceType,source_url:sourceUrl||undefined,title:sourceTitle||undefined,license_name:license||undefined,license_scope:licenseScope||undefined});const id=String(row.id||"");setSourceId(id);setSourceIds(v=>[{id,label:publisher},...v.filter(x=>x.id!==id)]);setPublisher("");setSourceTitle("");setSourceUrl("");setLicense("");setLicenseScope("");setNotice("来源登记完成；接下来可将具体证据记录关联到该来源。");}
    catch(err){setError(err instanceof Error?err.message:"来源登记失败。");}finally{setBusy(false);}
  }
  async function saveFinding(e:FormEvent) {
    e.preventDefault();if(!opportunityId)return;setBusy(true);setError("");setNotice("");
    try {await createResearchFinding({opportunity_id:opportunityId,stage:findingStage,claim:findingClaim,explanation:findingExplanation||undefined,finding_type:findingType as "claim"|"observation"|"estimate"|"contradiction"|"gap"});setFindings(await listResearchFindings(opportunityId));setFindingClaim("");setFindingExplanation("");setNotice("研究阶段结论已保存；未关联证据的结论仍保持证据不足。");}
    catch(err){setError(err instanceof Error?err.message:"保存研究结论失败。");}finally{setBusy(false);}
  }
  async function reviewRisk(id:string) {
    if(riskReviewNote.trim().length<8)return;setBusy(true);setError("");setNotice("");
    try {await reviewResearchRisk({risk_id:id,status:riskReviewStatus,note:riskReviewNote});setRiskReviewNote("");if(opportunityId)setRisks(await listResearchRisks(opportunityId));await refreshAudit();setNotice("风险状态已更新，审查说明已写入审计历史。");}
    catch(err){setError(err instanceof Error?err.message:"风险审查失败；请确认管理员权限。");}finally{setBusy(false);}
  }
  async function queueResearchSearch(e:FormEvent) {
    e.preventDefault();if(!opportunityId)return;setBusy(true);setError("");setNotice("");
    try {const job=await createResearchSearchJob({opportunity_id:opportunityId,query:searchQuery,market_country:searchCountry||undefined,idempotency_key:crypto.randomUUID()});setNotice("网页搜索任务已加入队列（"+job.id+"）。任务完成后点击刷新搜索结果。");}
    catch(err){setError(err instanceof Error?err.message:"搜索任务提交失败；请检查 SerpApi 凭证、授权状态和队列配置。");}finally{setBusy(false);}
  }
  async function refreshSearchResults(){if(!opportunityId)return;setBusy(true);setError("");try{setSearchResults(await listResearchSearchResults(opportunityId));}catch(err){setError(err instanceof Error?err.message:"刷新搜索结果失败。");}finally{setBusy(false);}}
  async function importSearchEvidence(result:ResearchSearchResultRecord){if(!opportunityId||importedSearchIds.includes(result.id))return;setBusy(true);setError("");setNotice("");try{const publisher=result.displayed_url||"Web search result";const source=await createResearchEvidenceSource({publisher,source_type:"web",source_url:result.url||undefined,title:result.title,license_scope:"搜索摘要仅作发现线索；引用或决策前须打开原文核验并确认许可。"});const sourceId=String(source.id||"");await createResearchEvidence({opportunity_id:opportunityId,evidence_source_id:sourceId,evidence_class:"proxy_indicator",claim_supported:"搜索结果线索："+result.title+(result.snippet?" — "+result.snippet:""),methodology:"SerpApi 搜索结果摘要；仅为网页存在性 / 主题相关性代理线索，不构成销量、客户需求或市场规模证据。需核验原始页面。",raw_excerpt:result.snippet||undefined,geography:result.market_country||undefined});setSourceIds(current=>[{id:sourceId,label:publisher+" · "+result.title},...current]);setEvidence(await listResearchEvidence(opportunityId));setImportedSearchIds(current=>[...current,result.id]);setNotice("搜索线索已转为未核验代理证据；它不能单独证明需求或交易。");}catch(err){setError(err instanceof Error?err.message:"搜索线索导入证据失败。");}finally{setBusy(false);}}
  async function queueAIResearch(e:FormEvent) {
    e.preventDefault();if(!opportunityId)return;setBusy(true);setError("");setNotice("");
    try {const job=await createAIResearchJob({opportunity_id:opportunityId,query:aiQuery,stage:findingStage,context:aiContext,provider_key:aiProvider,idempotency_key:crypto.randomUUID()});setAiQuery("");setAiContext("");setNotice("AI 研究任务已加入队列（"+job.id+"）。输出会保存为证据不足的模型生成结论，必须人工补充证据与核验。");}
    catch(err){setError(err instanceof Error?err.message:"AI 研究任务提交失败；请检查供应商凭证、授权状态和队列配置。");}finally{setBusy(false);}
  }
  async function submitDecision(e:FormEvent) {
    e.preventDefault();if(!opportunityId)return;setBusy(true);setError("");setNotice("");
    try {const models=await listResearchFinancialModels(opportunityId);const latestModel=models[0];await submitResearchDecision({opportunity_id:opportunityId,decision:decisionChoice,rationale:decisionRationale,model_version:"urania-decision-v1",financial_model_id:latestModel?.id||null,commercial_score:scoreSnapshot?.commercialScore??null,evidence_coverage:scoreSnapshot?.evidenceCoverage??null});setDecisionRationale("");setDecisions(await listResearchDecisions(opportunityId));await refreshAudit();setNotice("投资建议已提交审批队列；提交不代表批准。");}
    catch(err){setError(err instanceof Error?err.message:"投资建议提交失败。");}finally{setBusy(false);}
  }
  async function approveDecision(id:string) {
    setBusy(true);setError("");setNotice("");
    try {await approveResearchDecision(id,"管理员人工审批");if(opportunityId)setDecisions(await listResearchDecisions(opportunityId));await refreshAudit();setNotice("投资决策已批准并写入审计记录。");}
    catch(err){setError(err instanceof Error?err.message:"审批失败；请确认管理员权限且不存在未解除硬性否决风险。");}finally{setBusy(false);}
  }
  async function verifyEvidence(id:string) {
    if(!verificationNote.trim())return;setBusy(true);setError("");setNotice("");
    try {await verifyResearchEvidence({evidence_id:id,status:verificationStatus,note:verificationNote});setVerificationNote("");if(opportunityId)await loadEvidence(opportunityId);await refreshAudit();setNotice("证据核验状态已更新，并写入审计历史。");}
    catch(err){setError(err instanceof Error?err.message:"证据核验失败。");}finally{setBusy(false);}
  }
  async function saveRisk(e:FormEvent) {
    e.preventDefault();if(!opportunityId)return;setBusy(true);setError("");setNotice("");
    try {await createResearchRisk({opportunity_id:opportunityId,risk_category:riskCategory,description:riskDescription,severity:riskSeverity,likelihood:riskLikelihood,hard_veto:riskVeto,mitigation_plan:riskMitigation||undefined});setRiskDescription("");setRiskMitigation("");setRiskVeto(false);setRisks(await listResearchRisks(opportunityId));setNotice("风险记录已保存；未解决的硬性否决项将阻止进入投资批准流程。");}
    catch(err){setError(err instanceof Error?err.message:"风险记录保存失败。");}finally{setBusy(false);}
  }
  async function saveEvidence(e:FormEvent) {
    e.preventDefault();if(!opportunityId||!sourceId)return;setBusy(true);setError("");setNotice("");
    try {await createResearchEvidence({opportunity_id:opportunityId,evidence_source_id:sourceId,evidence_class:evidenceClass,claim_supported:claim,finding_id:evidenceFindingId||null,methodology:methodology||undefined,metric_name:metricName||undefined,metric_value:metricValue.trim()?Number(metricValue):null,metric_unit:metricUnit||undefined,geography:evidenceGeography||undefined,published_at:publishedAt||null,observed_at:observedAt||null,confidence:evidenceConfidence.trim()?Number(evidenceConfidence):null});setClaim("");setMethodology("");setEvidenceFindingId("");setMetricName("");setMetricValue("");setMetricUnit("");setEvidenceGeography("");setPublishedAt("");setObservedAt("");setEvidenceConfidence("");await loadEvidence(opportunityId);setNotice("证据记录已保存，当前状态为未验证。");}
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
          <TextInput id="research-project-budget" labelText="项目预算（可选）" type="number" min="0" value={budgetAmount} onChange={e=>setBudgetAmount(e.target.value)} />
          <Select id="research-project-budget-currency" labelText="预算币种" value={budgetCurrency} onChange={e=>setBudgetCurrency(e.target.value)}>{["USD","EUR","GBP","CNY","TWD","JPY"].map(v=><SelectItem key={v} value={v} text={v}/>)}</Select>
          <Select id="research-project-horizon" labelText="投资回报周期目标" value={projectHorizon} onChange={e=>setProjectHorizon(e.target.value as "under_1y"|"1_3y"|"3_5y"|"over_5y")}><SelectItem value="under_1y" text="1 年以内"/><SelectItem value="1_3y" text="1–3 年（默认）"/><SelectItem value="3_5y" text="3–5 年"/><SelectItem value="over_5y" text="5 年以上"/></Select>
          <Select id="research-project-approval-policy" labelText="投资审批制度" value={approvalPolicy} onChange={e=>setApprovalPolicy(e.target.value as "owner"|"committee"|"tiered")}><SelectItem value="tiered" text="分级审批（默认）"/><SelectItem value="committee" text="委员会审批"/><SelectItem value="owner" text="项目负责人审批"/></Select>
          <Button type="submit" size="sm" disabled={busy||!projectName.trim()||objective.trim().length<10||(budgetAmount.trim().length>0&&(!Number.isFinite(Number(budgetAmount))||Number(budgetAmount)<0))}>创建项目</Button>
        </form>
        <Select id="research-project-select" labelText="当前项目" value={projectId} onChange={e=>setProjectId(e.target.value)}>
          {projects.map(p=><SelectItem key={p.id} value={p.id} text={p.name}/>)}
        </Select>
        <div className="research-portfolio-list">{projects.map(p=><div key={p.id} className="research-portfolio-row"><strong>{p.name}</strong><span>{p.status} · {p.investment_horizon} · {p.approval_policy} · {p.investment_budget?.amount!==undefined?String(p.investment_budget.amount)+" "+String(p.investment_budget.currency||"USD"):"未设预算"}</span></div>)}{projects.length===0&&<p className="muted">尚无研究项目。</p>}</div>
      </section>
      <section className="research-portfolio-section">
        <h3>02 · 机会池</h3>
        <form onSubmit={saveOpportunity} className="research-portfolio-form">
          <TextInput id="research-opportunity-title" labelText="机会名称" value={oppTitle} onChange={e=>setOppTitle(e.target.value)} required/>
          <Select id="research-opportunity-type" labelText="机会类型" value={oppType} onChange={e=>setOppType(e.target.value as "product"|"software"|"service"|"technology"|"industry"|"business_model"|"other")}>
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
          <TextInput id="research-source-title" labelText="来源标题" value={sourceTitle} onChange={e=>setSourceTitle(e.target.value)}/>
          <Select id="research-source-type" labelText="来源类型" value={sourceType} onChange={e=>setSourceType(e.target.value)}>
            <SelectItem value="transaction" text="交易数据"/><SelectItem value="government" text="政府数据"/><SelectItem value="industry_report" text="行业报告"/><SelectItem value="academic" text="学术研究"/><SelectItem value="web" text="网页"/><SelectItem value="interview" text="访谈"/><SelectItem value="survey" text="问卷"/><SelectItem value="supplier_document" text="供应商文件"/><SelectItem value="financial_filing" text="财报"/><SelectItem value="other" text="其他"/>
          </Select>
          <TextInput id="research-source-url" labelText="来源 URL（可选）" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://"/>
          <TextInput id="research-source-license" labelText="许可名称" value={license} onChange={e=>setLicense(e.target.value)}/>
          <TextInput id="research-source-license-scope" labelText="许可范围 / 保存期限限制" value={licenseScope} onChange={e=>setLicenseScope(e.target.value)}/>
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
          <Select id="research-evidence-finding" labelText="关联研究结论（可选）" value={evidenceFindingId} onChange={e=>setEvidenceFindingId(e.target.value)}><SelectItem value="" text="不关联特定结论"/>{findings.map(f=><SelectItem key={f.id} value={f.id} text={f.claim.slice(0,80)}/>)}</Select>
          <Select id="research-evidence-class" labelText="证据类别" value={evidenceClass} onChange={e=>setEvidenceClass(e.target.value)}>
            <SelectItem value="observed_transaction" text="观察到的交易"/><SelectItem value="observed_behavior" text="观察到的行为"/><SelectItem value="proxy_indicator" text="代理指标"/><SelectItem value="model_estimate" text="模型估计"/><SelectItem value="expert_opinion" text="专家意见"/><SelectItem value="primary_research" text="一手调研"/>
          </Select>
          <TextArea id="research-evidence-claim" labelText="该证据支持的具体主张" value={claim} onChange={e=>setClaim(e.target.value)} required rows={2}/>
          <TextArea id="research-evidence-method" labelText="方法、口径与限制" value={methodology} onChange={e=>setMethodology(e.target.value)} rows={2}/>
          <TextInput id="research-evidence-metric" labelText="指标名称（可选）" value={metricName} onChange={e=>setMetricName(e.target.value)}/>
          <TextInput id="research-evidence-value" labelText="指标数值" type="number" value={metricValue} onChange={e=>setMetricValue(e.target.value)}/>
          <TextInput id="research-evidence-unit" labelText="指标单位" value={metricUnit} onChange={e=>setMetricUnit(e.target.value)}/>
          <TextInput id="research-evidence-geography" labelText="地域 / 市场" value={evidenceGeography} onChange={e=>setEvidenceGeography(e.target.value)}/>
          <TextInput id="research-evidence-published" labelText="发布日期" type="date" value={publishedAt} onChange={e=>setPublishedAt(e.target.value)}/>
          <TextInput id="research-evidence-observed" labelText="观察日期" type="date" value={observedAt} onChange={e=>setObservedAt(e.target.value)}/>
          <TextInput id="research-evidence-confidence" labelText="研究人员置信度（0–1）" type="number" min="0" max="1" step="0.05" value={evidenceConfidence} onChange={e=>setEvidenceConfidence(e.target.value)}/>
          <Button type="submit" size="sm" disabled={busy||!opportunityId||!sourceId||(metricValue.trim().length>0&&!Number.isFinite(Number(metricValue)))||(evidenceConfidence.trim().length>0&&(!Number.isFinite(Number(evidenceConfidence))||Number(evidenceConfidence)<0||Number(evidenceConfidence)>1))}>保存证据</Button>
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
        <div className="research-portfolio-list">{findings.map(f=><div key={f.id} className="research-portfolio-row"><strong>{f.claim}</strong><span>{f.stage} · {f.finding_type} · {f.evidence_status}</span></div>)}{findings.length===0&&<p className="muted">尚无阶段结论。</p>}</div>
      </section>
      <MarketSizingPanel opportunityId={opportunityId} evidence={evidence} />
      <ResearchScorePanel opportunityId={opportunityId} evidenceRecords={evidence} findings={findings} activeHardVeto={risks.some(r=>r.hard_veto&&["open","mitigating"].includes(r.status))} onScoreChange={setScoreSnapshot} />
      <section className="research-portfolio-section">
        <h3>05A · AI 研究任务</h3>
        <p className="panel-note">AI 仅生成待核验研究结论，不会自动产生事实证据、来源引用或投资批准。请先在集成中心配置 API 密钥，并将供应商状态与授权审核设为有效。</p>
        <form onSubmit={queueAIResearch} className="research-portfolio-form">
          <Select id="research-ai-provider" labelText="研究模型" value={aiProvider} onChange={e=>setAiProvider(e.target.value as "openai_api"|"anthropic_api"|"google_gemini_api")}><SelectItem value="openai_api" text="OpenAI（主研究引擎）"/><SelectItem value="anthropic_api" text="Claude（独立复核）"/><SelectItem value="google_gemini_api" text="Gemini（补充分析）"/></Select>
          <TextArea id="research-ai-query" labelText="研究问题" value={aiQuery} onChange={e=>setAiQuery(e.target.value)} maxLength={500} required rows={2}/>
          <TextArea id="research-ai-context" labelText="已掌握的背景资料（可选；不要粘贴秘密或个人敏感数据）" value={aiContext} onChange={e=>setAiContext(e.target.value)} maxLength={12000} rows={3}/>
          <Button type="submit" size="sm" disabled={busy||!opportunityId||aiQuery.trim().length<5||aiQuery.trim().length>500}>提交 AI 研究任务</Button>
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
        <div className="research-portfolio-list">{risks.map(r=><div key={r.id} className="research-portfolio-row"><strong>{r.description}</strong><span>{r.risk_category} · {r.severity} · {r.status} {r.hard_veto?" · 硬性否决":""}</span><div className="research-risk-review"><Select id={`risk-review-${r.id}`} labelText="管理员复核状态" value={riskReviewStatus} onChange={e=>setRiskReviewStatus(e.target.value as "open"|"mitigating"|"accepted"|"resolved"|"false_positive")}><SelectItem value="open" text="重新打开"/><SelectItem value="mitigating" text="缓解中"/><SelectItem value="accepted" text="接受风险"/><SelectItem value="resolved" text="已解决"/><SelectItem value="false_positive" text="误报"/></Select><TextInput id={`risk-review-note-${r.id}`} labelText="复核说明（至少 8 字）" value={riskReviewNote} onChange={e=>setRiskReviewNote(e.target.value)}/><Button size="sm" kind="tertiary" disabled={busy||riskReviewNote.trim().length<8} onClick={()=>void reviewRisk(r.id)}>管理员复核</Button></div></div>)}{risks.length===0&&<p className="muted">当前机会尚无风险记录。</p>}</div>
      </section>
    </div>
    <div className="research-portfolio-grid">
      <section className="research-portfolio-section">
        <h3>07 · 投资审批</h3>
        <p className="panel-note">研究员只能提交建议。最终批准由管理员执行；服务端会重新检查未解除的硬性否决风险，任何评分都不能绕过该检查。</p>
        <form onSubmit={submitDecision} className="research-portfolio-form">
          <Select id="research-decision-choice" labelText="建议决策" value={decisionChoice} onChange={e=>setDecisionChoice(e.target.value as "invest"|"validate_more"|"defer"|"reject")}><SelectItem value="invest" text="建议投资"/><SelectItem value="validate_more" text="继续验证"/><SelectItem value="defer" text="暂缓"/><SelectItem value="reject" text="拒绝"/></Select>
          <TextArea id="research-decision-rationale" labelText="决策依据（至少 10 字）" value={decisionRationale} onChange={e=>setDecisionRationale(e.target.value)} required rows={3}/>
          <Button type="submit" size="sm" disabled={busy||!opportunityId||decisionRationale.trim().length<10}>提交审批</Button>
        </form>
        <div className="research-portfolio-list">{decisions.map(d=><div key={d.id} className="research-portfolio-row"><strong>{d.decision} · {d.status}{d.hard_veto_triggered?" · 曾触发硬性否决":""}</strong><span>{d.rationale}</span>{d.status==="pending"&&<Button size="sm" kind="tertiary" disabled={busy} onClick={()=>void approveDecision(d.id)}>管理员批准</Button>}</div>)}{decisions.length===0&&<p className="muted">尚无投资审批记录。</p>}</div>
      </section>
    </div>
    <section className="research-portfolio-evidence">
      <h3>审计时间线 <span className="muted">· {auditEvents.length} 条</span></h3>
      {auditEvents.length===0?<p className="muted">尚无证据核验、风险复核或投资审批事件。</p>:auditEvents.map(event=><article className="research-evidence-row" key={event.event_type+"-"+event.entity_id+"-"+event.created_at}><div><strong>{event.event_type} · {event.action}</strong><p>{event.previous_status||"—"} → {event.new_status||"—"}</p><small>{event.note||"无附加说明"}</small></div><span>{new Date(event.created_at).toLocaleString()}</span></article>)}
    </section>
    <section className="research-portfolio-evidence">
      <h3>证据时间线 <span className="muted">· {evidence.length} 条</span></h3>
      <div className="research-verification-tools"><Select id="research-verification-status" labelText="核验结果" value={verificationStatus} onChange={e=>setVerificationStatus(e.target.value as "human_verified"|"disputed"|"rejected")}><SelectItem value="human_verified" text="人工核验通过"/><SelectItem value="disputed" text="存在争议"/><SelectItem value="rejected" text="证据驳回"/></Select><TextInput id="research-verification-note" labelText="核验说明（至少 8 字）" value={verificationNote} onChange={e=>setVerificationNote(e.target.value)}/></div>
      {evidence.length===0?<p className="muted">选择一个机会并登记证据后，证据将显示在此处。</p>:evidence.map(e=><article className="research-evidence-row" key={e.id}>
        <div><strong>{e.claim_supported}</strong><p>{e.publisher||"来源未命名"} · {e.source_url||"未提供 URL"}</p><small>{e.evidence_class} · 收集于 {new Date(e.collected_at).toLocaleString()}{e.geography?" · "+e.geography:""}{e.metric_name?" · "+e.metric_name+": "+(e.metric_value??"未录入")+(e.metric_unit?" "+e.metric_unit:""):""}</small></div>
        <div className="research-evidence-actions"><span className="badge badge--amber">{e.verification_status}</span><Button size="sm" kind="tertiary" disabled={busy||verificationNote.trim().length<8} onClick={()=>void verifyEvidence(e.id)}>提交核验</Button></div>
      </article>)}
    </section>
  </Tile>;
}
