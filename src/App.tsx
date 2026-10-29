import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "./lib/supabase";
import { createAccount, listDataSources, type AccountRecord, type LeadRecord } from "./lib/api";
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, Bell, Boxes,
  Building2, Check, ChevronDown, CircleHelp, Clock3, Command, Compass, Database,
  Download, FileSearch, Filter, Globe2, LayoutDashboard, ListTodo,
  Mail, Menu, MoreHorizontal, Plus, Search, Settings2, ShieldCheck, Sparkles,
  Target, TrendingUp, Users, Workflow, X, Zap,
} from "lucide-react";

type Page = "overview" | "research" | "crm" | "intelligence" | "automation" | "integrations" | "settings";
type NavItem = { id: Page; label: string; icon: typeof LayoutDashboard; badge?: string };

const primaryNav: NavItem[] = [
  { id: "overview", label: "工作台", icon: LayoutDashboard },
  { id: "research", label: "产品研究", icon: Compass, badge: "12" },
  { id: "crm", label: "CRM 客户", icon: Users },
  { id: "intelligence", label: "数据情报", icon: Globe2 },
  { id: "automation", label: "自动化中心", icon: Workflow },
];
const systemNav: NavItem[] = [
  { id: "integrations", label: "API 集成中心", icon: Database },
  { id: "settings", label: "系统设置", icon: Settings2 },
];

const opportunities = [
  { name: "便携式储能配件", category: "户外与能源", market: "美国 · 欧盟", score: 87, trend: "+24.8%", margin: "32.4%", status: "值得验证" },
  { name: "宠物智能饮水器", category: "宠物用品", market: "美国 · 英国", score: 82, trend: "+18.2%", margin: "28.7%", status: "研究中" },
  { name: "可重复使用食品容器", category: "家居与厨房", market: "欧盟 · 英国", score: 79, trend: "+13.6%", margin: "26.1%", status: "值得验证" },
  { name: "人体工学办公配件", category: "办公用品", market: "美国 · 德国", score: 76, trend: "+9.4%", margin: "24.8%", status: "待补充数据" },
];
const leads = [
  { company: "Nordlicht Trading GmbH", country: "德国", type: "进口商 / 分销商", fit: 92, stage: "新线索", product: "家居与厨房", initials: "NT", color: "violet" },
  { company: "BrightPath Retail Ltd.", country: "英国", type: "零售采购", fit: 86, stage: "待联系", product: "户外与能源", initials: "BR", color: "blue" },
  { company: "Pacific Meridian Supply", country: "美国", type: "批发商", fit: 81, stage: "研究中", product: "宠物用品", initials: "PM", color: "orange" },
  { company: "Maison Verde SAS", country: "法国", type: "品牌 / 零售", fit: 78, stage: "待验证", product: "可持续家居", initials: "MV", color: "green" },
];
const connectors = [
  { name: "SerpApi", category: "搜索与 SERP", detail: "Google Search、Shopping、Maps 等搜索结果", state: "待配置", initials: "S", tone: "purple" },
  { name: "DataForSEO", category: "搜索与趋势", detail: "关键词、SERP、趋势与商品搜索数据", state: "待配置", initials: "D", tone: "blue" },
  { name: "Keepa", category: "电商商品数据", detail: "Amazon 商品、价格历史与排名代理指标", state: "待配置", initials: "K", tone: "orange" },
  { name: "eBay Browse API", category: "电商商品数据", detail: "授权范围内的在售商品与商品目录", state: "待授权", initials: "e", tone: "green" },
  { name: "Google Trends", category: "市场趋势", detail: "趋势指数；官方 API 访问需确认资格", state: "待核验", initials: "G", tone: "teal" },
  { name: "Supabase", category: "数据库", detail: "Postgres、认证与业务数据存储", state: "已连接", initials: "Sb", tone: "green" },
];

const pageMeta: Record<Page, { title: string; eyebrow: string; description: string }> = {
  overview: { title: "工作台", eyebrow: "MONDAY, OCT 29", description: "全球产品机会与客户开发进度，一目了然。" },
  research: { title: "产品研究", eyebrow: "PRODUCT INTELLIGENCE", description: "从全球需求信号到可验证的产品机会。" },
  crm: { title: "CRM 客户", eyebrow: "CUSTOMER RELATIONSHIPS", description: "管理企业、联系人、线索与销售跟进。" },
  intelligence: { title: "数据情报", eyebrow: "GLOBAL DATA INTELLIGENCE", description: "把多来源数据转化为可追溯的业务证据。" },
  automation: { title: "自动化中心", eyebrow: "WORKFLOWS & OPERATIONS", description: "管理 AI 任务、人工审批与数据处理队列。" },
  integrations: { title: "API 集成中心", eyebrow: "CONNECTORS & DATA SOURCES", description: "统一管理连接器、授权、调用量与数据质量。" },
  settings: { title: "系统设置", eyebrow: "WORKSPACE ADMIN", description: "管理工作区、安全策略、权限与审计。" },
};

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "blue" | "purple" }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="section-title"><h2>{title}</h2>{action && <button className="text-action" onClick={onAction}>{action}<ArrowRight size={14} /></button>}</div>;
}
function MetricCard({ label, value, change, icon: Icon, tone, note }: { label: string; value: string; change: string; icon: typeof TrendingUp; tone: string; note: string }) {
  return <article className="metric-card">
    <div className="metric-top"><span>{label}</span><span className={`metric-icon metric-icon--${tone}`}><Icon size={17} /></span></div>
    <div className="metric-value">{value}</div>
    <div className="metric-foot"><span className="positive"><ArrowUpRight size={13} />{change}</span><span className="muted">{note}</span></div>
  </article>;
}

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("全部市场");
  const [approved, setApproved] = useState<string[]>([]);

  const current = pageMeta[page];
  const filteredOpportunities = useMemo(() => {
    const q = query.trim().toLowerCase();
    return opportunities.filter((item) => (!q || `${item.name} ${item.category} ${item.market}`.toLowerCase().includes(q)) &&
      (filter === "全部市场" || item.market.includes(filter)));
  }, [query, filter]);
  const visibleLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => !q || `${lead.company} ${lead.country} ${lead.type} ${lead.product}`.toLowerCase().includes(q));
  }, [query]);

  const go = (next: Page) => { setPage(next); setMobileNav(false); setQuery(""); setSearchOpen(false); };
  const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2800); };
  const handleSearch = (value: string) => { setQuery(value); setSearchOpen(true); };

  return <div className="app-shell">
    {mobileNav && <button className="mobile-scrim" aria-label="关闭菜单" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? "sidebar--open" : ""}`}>
      <div className="brand">
        <div className="brand-mark"><Sparkles size={20} strokeWidth={2.2} /></div>
        <div><div className="brand-name">urania<span>.</span></div><div className="brand-sub">GLOBAL INTELLIGENCE</div></div>
        <button className="icon-button sidebar-close" aria-label="关闭菜单" onClick={() => setMobileNav(false)}><X size={17} /></button>
      </div>
      <div className="workspace-switch">
        <div className="workspace-avatar">U</div><div className="workspace-copy"><strong>Urania Workspace</strong><span>内部工作区</span></div><ChevronDown size={15} className="muted" />
      </div>
      <div className="nav-label">工作空间</div>
      <nav className="nav-list">
        {primaryNav.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? "nav-item--active" : ""}`} onClick={() => go(item.id)}>
          <item.icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.badge && <span className="nav-count">{item.badge}</span>}
        </button>)}
      </nav>
      <div className="nav-label nav-label--system">系统管理</div>
      <nav className="nav-list">
        {systemNav.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? "nav-item--active" : ""}`} onClick={() => go(item.id)}>
          <item.icon size={17} strokeWidth={1.8} /><span>{item.label}</span>
        </button>)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-status"><span className="status-dot" /><div><strong>系统运行正常</strong><span>数据源状态需要配置</span></div><MoreHorizontal size={16} /></div>
      <div className="profile">
        <div className="profile-avatar">Y</div><div className="profile-copy"><strong>Workspace Admin</strong><span>管理员</span></div><MoreHorizontal size={17} />
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="打开菜单" onClick={() => setMobileNav(true)}><Menu size={19} /></button>
        <div className="breadcrumbs"><span>Urania</span><span className="crumb-slash">/</span><strong>{current.title}</strong></div>
        <div className="topbar-actions">
          <div className={`global-search ${searchOpen ? "global-search--active" : ""}`}>
            <Search size={16} /><input value={query} onChange={(e) => handleSearch(e.target.value)} onFocus={() => setSearchOpen(true)} onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); }} placeholder="搜索产品、企业、联系人…" aria-label="全局搜索" />
            {query && <button className="clear-search" onClick={() => setQuery("")} aria-label="清除搜索"><X size={13} /></button>}
            <kbd><Command size={11} /> K</kbd>
            {searchOpen && query && <div className="search-popover"><div className="search-popover-label">快速结果</div><button onClick={() => go("research")}><Compass size={15} /><span><strong>产品研究</strong><small>在产品机会中搜索 “{query}”</small></span><ArrowRight size={14} /></button><button onClick={() => go("crm")}><Users size={15} /><span><strong>CRM 客户</strong><small>在企业与线索中搜索 “{query}”</small></span><ArrowRight size={14} /></button></div>}
          </div>
          <button className="icon-button notification-button" aria-label="通知" onClick={() => toast("目前没有新的通知")}><Bell size={18} /><i /></button>
          <div className="topbar-divider" />
          <button className="help-button" onClick={() => toast("帮助中心将在后续版本开放")}><CircleHelp size={17} /><span>帮助</span></button>
        </div>
      </header>

      <div className="page-content">
        <div className="page-heading">
          <div><div className="eyebrow">{current.eyebrow}</div><h1>{current.title}</h1><p>{current.description}</p></div>
          <div className="heading-actions">
            <button className="button button--secondary" onClick={() => toast("报告导出将在接入真实数据后开放")}><Download size={15} />导出报告</button>
            <button className="button button--primary" onClick={() => page === "crm" ? toast("新建客户表单将在 CRM 数据模型完成后启用") : page === "integrations" ? toast("连接器设置需要先配置服务端密钥") : go("research")}><Plus size={16} />{page === "crm" ? "新建客户" : page === "integrations" ? "添加连接器" : "新建研究"}</button>
          </div>
        </div>

        {page === "overview" && <Overview go={go} toast={toast} />}
        {page === "research" && <Research filter={filter} setFilter={setFilter} data={filteredOpportunities} toast={toast} />}
        {page === "crm" && <CRM data={visibleLeads} toast={toast} />}
        {page === "intelligence" && <Intelligence toast={toast} />}
        {page === "automation" && <Automation approved={approved} setApproved={setApproved} toast={toast} />}
        {page === "integrations" && <Integrations toast={toast} />}
        {page === "settings" && <Settings toast={toast} />}
        <footer className="page-footer"><span>© 2026 Urania Intelligence</span><span><span className="status-dot" />演示界面 · 尚未连接实时业务数据</span><button onClick={() => toast("当前版本 0.1.0 · Foundation")}><ShieldCheck size={13} />版本 0.1.0</button></footer>
      </div>
    </main>
    {notice && <div className="toast"><Check size={16} />{notice}</div>}
  </div>;
}

function Overview({ go, toast }: { go: (p: Page) => void; toast: (s: string) => void }) {
  return <>
    <div className="welcome-banner"><div className="welcome-orb"><Sparkles size={22} /></div><div className="welcome-copy"><span>AI INTELLIGENCE BRIEFING</span><h2>把市场信号，变成下一步行动。</h2><p>Urania 正在搭建统一的数据与工作流底座。连接数据源后，这里将汇总最新机会与客户行动。</p></div><button className="welcome-link" onClick={() => go("integrations")}>配置数据源<ArrowRight size={15} /></button><div className="banner-decoration" /></div>
    <div className="metric-grid">
      <MetricCard label="产品机会" value="12" change="+3" icon={Boxes} tone="purple" note="本周新增" />
      <MetricCard label="待验证线索" value="248" change="+18.6%" icon={Users} tone="blue" note="较上周" />
      <MetricCard label="活跃商机" value="36" change="+8.2%" icon={Target} tone="green" note="较上周" />
      <MetricCard label="数据源连接" value="1 / 6" change="需配置" icon={Database} tone="orange" note="首期连接器" />
    </div>
    <div className="dashboard-grid">
      <section className="panel opportunities-panel"><SectionTitle title="高潜力产品机会" action="查看全部" onAction={() => go("research")} /><div className="table-wrap"><table><thead><tr><th>产品机会</th><th>目标市场</th><th>机会评分</th><th>趋势变化</th><th>状态</th></tr></thead><tbody>{opportunities.slice(0,3).map((item) => <tr key={item.name} onClick={() => go("research")} className="clickable-row"><td><div className="product-name"><span className="product-symbol"><Boxes size={15} /></span><span><strong>{item.name}</strong><small>{item.category}</small></span></div></td><td>{item.market}</td><td><div className="score-cell"><span>{item.score}</span><div className="score-track"><i style={{width:`${item.score}%`}} /></div></div></td><td className="positive">{item.trend}</td><td><Badge tone={item.status === "值得验证" ? "green" : "amber"}>{item.status}</Badge></td></tr>)}</tbody></table></div><div className="panel-note"><Activity size={14} />评分为演示样例，真实评分需基于可追溯数据计算。</div></section>
      <section className="panel activity-panel"><SectionTitle title="待处理事项" action="查看任务" onAction={() => go("automation")} /><div className="task-list">
        <Task icon={Mail} tone="purple" title="首次开发邮件待审批" meta="6 封草稿 · CRM" action="前往审批" onClick={() => go("automation")} />
        <Task icon={FileSearch} tone="blue" title="补充产品市场证据" meta="4 个产品 · 产品研究" action="继续研究" onClick={() => go("research")} />
        <Task icon={Database} tone="orange" title="配置搜索数据源" meta="SerpApi · API 集成" action="去配置" onClick={() => go("integrations")} />
        <Task icon={Clock3} tone="green" title="更新客户企业画像" meta="18 条记录 · CRM" action="查看线索" onClick={() => go("crm")} />
      </div></section>
    </div>
    <div className="lower-grid">
      <section className="panel pipeline-panel"><SectionTitle title="销售管道概览" action="打开 CRM" onAction={() => go("crm")} /><div className="pipeline-total"><strong>€184,500</strong><Badge tone="green"><ArrowUpRight size={12} />12.4%</Badge><span>演示金额 · 非真实销售数据</span></div><div className="pipeline-bars">{[{label:"新线索",value:100,color:"var(--blue)"},{label:"已联系",value:74,color:"var(--purple)"},{label:"需求确认",value:49,color:"var(--teal)"},{label:"报价中",value:28,color:"var(--orange)"}].map(x=><div className="pipeline-row" key={x.label}><span>{x.label}</span><div className="pipeline-track"><i style={{width:`${x.value}%`,background:x.color}} /></div><b>{x.value===100?"124":x.value===74?"86":x.value===49?"43":"21"}</b></div>)}</div></section>
      <section className="panel source-panel"><SectionTitle title="数据源健康状态" action="管理连接器" onAction={() => go("integrations")} /><div className="source-list"><SourceRow name="Supabase" detail="业务数据库" state="已连接" tone="green" /><SourceRow name="SerpApi" detail="搜索结果与商品发现" state="待配置" tone="amber" /><SourceRow name="DataForSEO" detail="关键词与搜索趋势" state="待配置" tone="amber" /><SourceRow name="Keepa" detail="Amazon 商品历史数据" state="待配置" tone="amber" /></div></section>
    </div>
    <div className="demo-disclaimer"><ShieldCheck size={15} /><span>演示数据提示：当前数字、评分和企业均为界面样例，不代表真实市场、客户或销售数据。</span><button onClick={() => toast("数据接入后将显示来源、抓取时间和证据类型")}>了解数据规范<ArrowRight size={13} /></button></div>
  </>;
}

function Task({ icon: Icon, tone, title, meta, action, onClick }: { icon: typeof Mail; tone: string; title: string; meta: string; action: string; onClick: () => void }) {
  return <div className="task-item"><span className={`task-icon task-icon--${tone}`}><Icon size={16} /></span><div className="task-copy"><strong>{title}</strong><small>{meta}</small></div><button className="task-action" onClick={onClick}>{action}<ArrowRight size={12} /></button></div>;
}
function SourceRow({ name, detail, state, tone }: { name: string; detail: string; state: string; tone: string }) {
  return <div className="source-row"><span className={`source-dot source-dot--${tone}`} /><div><strong>{name}</strong><small>{detail}</small></div><Badge tone={tone === "green" ? "green" : "amber"}>{state}</Badge></div>;
}

function Research({ filter, setFilter, data, toast }: { filter: string; setFilter: (v: string) => void; data: typeof opportunities; toast: (s: string) => void }) {
  return <>
    <div className="research-summary"><div><span className="summary-label">研究工作区</span><strong>12 个候选机会</strong><span className="muted">· 样例数据</span></div><div className="summary-actions"><select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="筛选目标市场"><option>全部市场</option><option>美国</option><option>欧盟</option><option>英国</option></select><button className="button button--secondary" onClick={() => toast("高级筛选将在真实数据接入后启用")}><Filter size={15} />高级筛选</button><button className="button button--primary" onClick={() => toast("研究任务队列尚未连接真实数据源")}><Plus size={15} />创建研究任务</button></div></div>
    <div className="metric-grid metric-grid--research"><MetricCard label="平均机会评分" value="81 / 100" change="+4.2" icon={TrendingUp} tone="purple" note="样例评分" /><MetricCard label="需求增长信号" value="8" change="3 个市场" icon={Activity} tone="blue" note="需来源验证" /><MetricCard label="利润率达标" value="6" change="目标 ≥ 25%" icon={BarChart3} tone="green" note="估算情景" /><MetricCard label="数据缺口" value="14" change="待补证据" icon={FileSearch} tone="orange" note="样例记录" /></div>
    <section className="panel"><SectionTitle title="产品机会列表" action="评分说明" onAction={() => toast("评分由需求、竞争、利润、供应链、趋势与风险构成；真实评分必须记录模型版本和证据。")} /><div className="table-wrap"><table><thead><tr><th>产品</th><th>目标市场</th><th>机会评分</th><th>趋势变化</th><th>预估利润率</th><th>研究状态</th><th /></tr></thead><tbody>{data.map((item) => <tr key={item.name}><td><div className="product-name"><span className="product-symbol"><Boxes size={15} /></span><span><strong>{item.name}</strong><small>{item.category}</small></span></div></td><td>{item.market}</td><td><div className="score-cell"><span>{item.score}</span><div className="score-track"><i style={{width:`${item.score}%`}} /></div></div></td><td className="positive">{item.trend}</td><td>{item.margin}</td><td><Badge tone={item.status === "值得验证" ? "green" : "amber"}>{item.status}</Badge></td><td><button className="icon-button table-more" onClick={() => toast(`${item.name}：详情页将在研究数据模型接入后开放`)} aria-label="查看详情"><ArrowRight size={15} /></button></td></tr>)}</tbody></table>{data.length===0 && <div className="empty-state"><FileSearch size={28} /><strong>没有符合条件的产品</strong><span>调整搜索词或市场筛选后重试。</span></div>}</div><div className="panel-note"><ShieldCheck size={14} />所有趋势、利润率与评分目前均为演示数据；正式版本将显示证据来源、观测时间和估算方法。</div></section>
    <div className="research-cards"><article className="panel mini-feature"><span className="feature-icon feature-icon--purple"><Sparkles size={18} /></span><div><h3>AI 研究简报</h3><p>自动归纳需求信号、竞争情况、供应链风险与下一步验证动作。</p><button className="text-action" onClick={() => toast("AI 报告将在模型与证据层接入后启用")}>了解报告结构<ArrowRight size={13} /></button></div></article><article className="panel mini-feature"><span className="feature-icon feature-icon--green"><BarChart3 size={18} /></span><div><h3>利润情景计算器</h3><p>对比采购、物流、关税、平台费用、广告与退货后的贡献利润。</p><button className="text-action" onClick={() => toast("利润计算器进入下一阶段开发")}>查看计算规则<ArrowRight size={13} /></button></div></article></div>
  </>;
}

function CRM({ data, toast }: { data: typeof leads; toast: (s: string) => void }) {
  const [stage, setStage] = useState("全部阶段");
  const [tab, setTab] = useState<"accounts" | "leads">("accounts");
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [liveLeads, setLiveLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");
  const [accountType, setAccountType] = useState("importer");
  const [role, setRole] = useState<string | null>(null);
  const isLive = Boolean(supabase);

  async function reload() {
    if (!supabase) return;
    setLoading(true); setError("");
    try {
      const [{ data: accountData }, { data: leadData }, { data: userData }] = await Promise.all([
        supabase.rpc("urania_list_accounts", { p_search: null, p_limit: 100 }),
        supabase.rpc("urania_list_leads", { p_search: null, p_limit: 100 }),
        supabase.auth.getUser(),
      ]);
      if (accountData && typeof accountData === "object" && "data" in accountData) setAccounts((accountData as {data: AccountRecord[]}).data || []);
      if (leadData && typeof leadData === "object" && "data" in leadData) setLiveLeads((leadData as {data: LeadRecord[]}).data || []);
      setRole((userData.user?.app_metadata?.urania_role as string | undefined) ?? null);
      const firstError = (accountData as {message?:string}|null)?.message || (leadData as {message?:string}|null)?.message;
      if (firstError) setError(firstError);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取 CRM 数据失败。");
    } finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, []);

  async function saveAccount(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      await createAccount({company_name:companyName,website_url:website || null,country_code:country || null,industry:industry || null,account_type:accountType});
      setCompanyName(""); setWebsite(""); setCountry(""); setIndustry(""); setFormOpen(false);
      toast("企业已保存到 Urania CRM");
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "保存企业失败。"); }
    finally { setSaving(false); }
  }

  const demoRows = data.filter((x) => stage === "全部阶段" || x.stage === stage);
  const liveRows = liveLeads.filter((x) => stage === "全部阶段" || x.status === stage);
  const stages = ["全部阶段","new","researching","qualified","contacted","converted","disqualified"];

  return <>
    <div className="crm-metrics"><MetricCard label="企业账户" value={isLive ? String(accounts.length) : "248"} change={isLive ? "实时数据库" : "+18"} icon={Building2} tone="blue" note={isLive ? "真实记录" : "演示数据"} /><MetricCard label="销售线索" value={isLive ? String(liveLeads.length) : "32"} change={isLive ? "数据库记录" : "8 个逾期"} icon={ListTodo} tone="orange" note={isLive ? "真实记录" : "需要处理"} /><MetricCard label="已验证账户" value={isLive ? String(accounts.filter(x=>x.verification_status==="human_verified").length) : "84 / 100"} change={isLive ? "人工验证" : "+5.1"} icon={Target} tone="purple" note={isLive ? "来源可追溯" : "样例评分"} /></div>
    <section className="panel">
      <div className="crm-toolbar"><div><SectionTitle title="CRM 工作区" /><p className="panel-subtitle">{isLive ? "已连接 Supabase RPC；记录来自当前 Urania 数据库。" : "集中管理企业账户、联系人和销售线索。"}</p></div><div className="summary-actions">{isLive && <button className="button button--secondary" onClick={()=>void reload()}><Activity size={14}/>刷新</button>}{(!isLive || role==="admin" || role==="sales") && <button className="button button--primary" onClick={()=>setFormOpen(v=>!v)}><Plus size={15}/>{formOpen?"关闭表单":"新建企业"}</button>}</div></div>
      <div className="crm-tabs"><button className={tab==="accounts"?"crm-tab crm-tab--active":"crm-tab"} onClick={()=>setTab("accounts")}>企业账户 <span>{isLive?accounts.length:"4"}</span></button><button className={tab==="leads"?"crm-tab crm-tab--active":"crm-tab"} onClick={()=>setTab("leads")}>销售线索 <span>{isLive?liveLeads.length:"4"}</span></button></div>
      {formOpen && <form className="account-form" onSubmit={saveAccount}><div className="account-form-heading"><strong>新建企业账户</strong><span>必填字段将写入 CRM，并记录审计事件。</span></div><div className="account-form-grid"><label>企业名称 *<input required minLength={2} maxLength={200} value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Company name"/></label><label>官网<input type="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://example.com"/></label><label>国家代码<input maxLength={2} pattern="[A-Za-z]{2}" value={country} onChange={e=>setCountry(e.target.value.toUpperCase())} placeholder="DE / US / GB"/></label><label>行业<input value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="Import / Retail / ..."/></label><label>企业类型<select value={accountType} onChange={e=>setAccountType(e.target.value)}><option value="importer">进口商</option><option value="distributor">分销商</option><option value="retailer">零售商</option><option value="brand">品牌</option><option value="manufacturer">制造商</option><option value="wholesaler">批发商</option><option value="service_provider">服务商</option><option value="unknown">未知</option></select></label></div>{error&&<p className="auth-error" role="alert">{error}</p>}<div className="account-form-actions"><button type="button" className="button button--secondary" onClick={()=>setFormOpen(false)}>取消</button><button type="submit" className="button button--primary" disabled={saving}>{saving?"保存中…":"保存企业"}</button></div></form>}
      {error && !formOpen && <div className="inline-error" role="alert"><ShieldCheck size={15}/><span>{error}</span><button onClick={()=>void reload()}>重试</button></div>}
      {loading ? <div className="empty-state"><Activity size={24}/><strong>正在读取 CRM 数据…</strong></div> : tab==="accounts" ? <div className="table-wrap"><table><thead><tr><th>企业</th><th>国家</th><th>行业</th><th>企业类型</th><th>验证状态</th><th>生命周期</th></tr></thead><tbody>{(isLive?accounts:demoRows.map((x,i)=>({id:String(i),company_name:x.company,website_url:null,domain:null,country_code:null,industry:x.product,account_type:x.type.split(" / ")[0],lifecycle_stage:"prospect",verification_status:"unverified",owner_id:null,created_at:"",updated_at:""} as AccountRecord))).map((account)=> <tr key={account.id}><td><div className="company-cell"><span className="company-avatar company-avatar--blue">{account.company_name.slice(0,2).toUpperCase()}</span><span><strong>{account.company_name}</strong><small>{account.domain || account.website_url || "尚未验证官网"}</small></span></div></td><td>{account.country_code || "—"}</td><td>{account.industry || "—"}</td><td>{account.account_type}</td><td><Badge tone={account.verification_status==="human_verified"?"green":"amber"}>{account.verification_status}</Badge></td><td><Badge>{account.lifecycle_stage}</Badge></td></tr>)}</tbody></table>{(isLive?accounts.length:demoRows.length)===0&&<div className="empty-state"><Building2 size={26}/><strong>还没有企业账户</strong><span>创建第一条企业记录，数据将保存到 Supabase。</span></div>}</div> : <div className="table-wrap"><table><thead><tr><th>线索</th><th>关联企业</th><th>国家</th><th>状态</th><th>匹配评分</th><th>下一步</th></tr></thead><tbody>{(isLive?liveRows:demoRows.map((x,i)=>({id:String(i),lead_name:x.company,status:x.stage,score:x.fit,source_url:null,next_action_at:null,created_at:"",company_name:x.company,country_code:null,contact_name:null} as LeadRecord))).map((lead)=> <tr key={lead.id}><td><strong>{lead.lead_name}</strong><small className="table-secondary">{lead.contact_name || "无联系人"}</small></td><td>{lead.company_name || "—"}</td><td>{lead.country_code || "—"}</td><td><Badge tone={lead.status==="qualified"||lead.status==="converted"?"green":"amber"}>{lead.status}</Badge></td><td>{lead.score===null?"—":lead.score}</td><td>{lead.next_action_at ? new Date(lead.next_action_at).toLocaleDateString() : "未安排"}</td></tr>)}</tbody></table>{(isLive?liveRows.length:demoRows.length)===0&&<div className="empty-state"><Users size={26}/><strong>还没有销售线索</strong><span>先添加企业账户，再开始线索开发。</span></div>}</div>}
      <div className="panel-note"><ShieldCheck size={14}/>{isLive?"数据通过角色受限的 Supabase RPC 读取；写操作需后端角色验证并写入审计日志。":"演示企业仅用于预览，不代表真实客户。连接数据库后将显示真实记录。"}</div>
    </section>
  </>;
}

function Intelligence({ toast }: { toast: (s: string) => void }) {
  const cards = [
    {icon:Search,title:"全球搜索",desc:"搜索企业、官网、商品、行业与公开市场信息。",tag:"SERP"},
    {icon:Building2,title:"企业情报",desc:"企业画像、业务分类、地点与来源证据。",tag:"B2B"},
    {icon:Users,title:"联系人情报",desc:"管理经授权的联系人信息、验证状态与时效。",tag:"CRM"},
    {icon:Globe2,title:"市场情报",desc:"关键词、趋势、地区热度与竞争格局。",tag:"MARKET"},
    {icon:Boxes,title:"平台情报",desc:"授权范围内的商品目录、卖家与价格变化。",tag:"COMMERCE"},
    {icon:ShieldCheck,title:"数据质量中心",desc:"去重、冲突字段、过期信息与许可范围检查。",tag:"QUALITY"},
  ];
  return <>
    <div className="welcome-banner welcome-banner--simple"><div className="welcome-orb"><Globe2 size={22} /></div><div className="welcome-copy"><span>ONE EVIDENCE LAYER</span><h2>每条结论，都能回到它的来源。</h2><p>标准化连接器、实体解析与证据记录将支撑产品研究和 CRM，不把搜索代理指标误当作实际交易。</p></div></div>
    <div className="intelligence-grid">{cards.map((card) => <article className="panel intelligence-card" key={card.title}><div className="intelligence-card-top"><span className="feature-icon feature-icon--blue"><card.icon size={19} /></span><Badge>{card.tag}</Badge></div><h3>{card.title}</h3><p>{card.desc}</p><button className="text-action" onClick={() => toast(`${card.title} 的数据管线将在连接器与证据层完成后启用`)}>打开模块<ArrowRight size={13} /></button></article>)}</div>
    <section className="panel"><SectionTitle title="数据证据规范" /><div className="evidence-grid"><div><span className="evidence-mark evidence-mark--green">T1</span><strong>直接观测 / 交易数据</strong><p>已授权的订单、实际交易记录、经确认的供应商报价。</p></div><div><span className="evidence-mark evidence-mark--blue">T2</span><strong>代理指标</strong><p>排名、评论数、搜索趋势、在售商品数等信号。</p></div><div><span className="evidence-mark evidence-mark--amber">T3</span><strong>模型估算</strong><p>估算销量、市场规模、利润预测，必须记录方法和区间。</p></div></div></section>
  </>;
}

function Automation({ approved, setApproved, toast }: { approved: string[]; setApproved: (v: string[]) => void; toast: (s: string) => void }) {
  const tasks = [
    {id:"email-1",title:"Nordlicht Trading · 产品引荐邮件",meta:"首次开发 · 英国英语 · 目标产品：可持续家居",type:"邮件审批",status:"待审核"},
    {id:"email-2",title:"BrightPath Retail · 采购需求跟进",meta:"首次开发 · 英语 · 目标产品：户外与能源",type:"邮件审批",status:"待审核"},
    {id:"data-1",title:"刷新关键词趋势数据",meta:"市场：美国、德国、英国 · 搜索连接器待配置",type:"数据任务",status:"等待连接器"},
  ];
  return <>
    <div className="metric-grid"><MetricCard label="运行中的工作流" value="4" change="2 个待配置" icon={Workflow} tone="purple" note="演示状态" /><MetricCard label="待人工审批" value={String(Math.max(0,2-approved.length))} change="首次开发邮件" icon={ShieldCheck} tone="orange" note="需人工审核" /><MetricCard label="队列失败任务" value="0" change="尚未启用" icon={Activity} tone="green" note="无真实队列" /><MetricCard label="本月 API 成本" value="$0.00" change="未启用调用" icon={Database} tone="blue" note="真实账单待接入" /></div>
    <section className="panel"><SectionTitle title="任务与审批队列" action="刷新" onAction={() => toast("任务列表已刷新（演示数据）")} /><div className="workflow-list">{tasks.map((task) => <div className="workflow-row" key={task.id}><span className={`workflow-icon ${task.type==="邮件审批"?"workflow-icon--mail":"workflow-icon--data"}`}>{task.type==="邮件审批"?<Mail size={17}/>:<Database size={17}/>}</span><div className="workflow-copy"><strong>{task.title}</strong><small>{task.meta}</small></div><Badge tone={approved.includes(task.id)?"green":task.type==="邮件审批"?"amber":"neutral"}>{approved.includes(task.id)?"已批准":task.status}</Badge><div className="workflow-actions">{task.type==="邮件审批"&&!approved.includes(task.id)?<><button className="button button--secondary button--small" onClick={() => toast("请先完成邮件内容、收件人和合规审查")} >查看草稿</button><button className="button button--primary button--small" onClick={() => {setApproved([...approved,task.id]);toast("已在演示界面记录审批状态；未发送邮件")}}>批准</button></>:<button className="icon-button" onClick={() => toast("此任务将在连接真实队列后运行")}><ArrowRight size={15}/></button>}</div></div>)}</div><div className="panel-note"><ShieldCheck size={14}/>演示批准仅改变本地界面状态，不会发送邮件。生产环境必须由服务端执行授权校验、审批审计与退订检查。</div></section>
    <section className="panel"><SectionTitle title="工作流目录" /><div className="workflow-catalog">{[{name:"全球产品发现",desc:"关键词 → 搜索数据 → 去重 → 机会评分",icon:Compass},{name:"企业线索发现",desc:"目标市场 → 企业搜索 → 画像丰富 → 人工复核",icon:Building2},{name:"产品与客户匹配",desc:"产品画像 → 企业需求 → 匹配分数 → CRM 线索",icon:Target},{name:"研究报告生成",desc:"证据聚合 → 风险检查 → AI 报告",icon:Sparkles}].map(x=><div className="catalog-row" key={x.name}><span className="feature-icon feature-icon--purple"><x.icon size={17}/></span><div><strong>{x.name}</strong><small>{x.desc}</small></div><Badge>规划中</Badge><button className="icon-button" onClick={() => toast(`${x.name} 将在工作流引擎开发后启用")}><ArrowRight size={15}/></button></div>)}</div></section>
  </>;
}

function Integrations({ toast }: { toast: (s: string) => void }) {
  const [category, setCategory] = useState("全部类别");
  const [liveConnectors, setLiveConnectors] = useState<Array<{provider_key:string;display_name:string;category:string;status:string;authorization_status:string;regions:string[];capabilities:string[]}>>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const isLive = Boolean(supabase);
  useEffect(() => {
    if (!supabase) return;
    listDataSources().then((rows) => setLiveConnectors(rows as typeof liveConnectors))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "无法读取连接器目录。"))
      .finally(() => setLoading(false));
  }, []);
  const categories = ["全部类别","search","trends","marketplace","company_data","contact_data","supplier_data","ai","database","other"];
  const filteredLive = liveConnectors.filter((x) => category==="全部类别" || x.category===category);
  const filteredDemo = connectors.filter((x) => category==="全部类别" || x.category===category);
  const stateLabel = (s:string) => ({planned:"待配置",pending_authorization:"待授权",configured:"已配置",active:"已启用",paused:"已暂停",disabled:"已禁用",error:"异常"}[s] || s);
  const authLabel = (s:string) => ({unknown:"权限待核验",pending:"申请中",approved:"已授权",restricted:"受限",rejected:"未通过"}[s] || s);
  return <>
    <div className="integration-banner"><div className="integration-banner-icon"><Database size={21}/></div><div><h2>统一连接器目录</h2><p>所有数据源通过统一接口接入。密钥只存放在服务端，不写入前端代码或仓库。</p></div><Badge tone="blue">{isLive?liveConnectors.length:connectors.length} 个目录条目</Badge></div>
    <div className="integration-summary"><MetricCard label="连接器目录" value={String(isLive?liveConnectors.length:connectors.length)} change="可扩展" icon={Database} tone="purple" note={isLive?"数据库记录":"演示清单"} /><MetricCard label="已启用" value={String(isLive?liveConnectors.filter(x=>x.status==="active").length:1)} change="真实连接需验证" icon={Check} tone="green" note="仅统计 active" /><MetricCard label="待配置 / 授权" value={String(isLive?liveConnectors.filter(x=>x.status==="planned"||x.authorization_status!=="approved").length:4)} change="需要凭证与许可" icon={Settings2} tone="orange" note="第三方数据源" /><MetricCard label="本月调用成本" value="—" change="账单未接入" icon={BarChart3} tone="blue" note="不会虚报费用" /></div>
    <section className="panel"><div className="integration-toolbar"><SectionTitle title={isLive?"数据源注册表":"数据源连接器"} /><select value={category} onChange={(e)=>setCategory(e.target.value)} aria-label="筛选连接器类别">{categories.map(c=><option key={c} value={c}>{c==="全部类别"?"全部类别":c}</option>)}</select></div>
      {error&&<div className="inline-error"><ShieldCheck size={15}/><span>{error}</span></div>}
      {loading?<div className="empty-state"><Activity size={24}/><strong>正在读取连接器目录…</strong></div>:<div className="connector-list">{isLive?filteredLive.map((x) => <div className="connector-row" key={x.provider_key}><span className="connector-logo connector-logo--blue">{x.display_name.slice(0,2)}</span><div className="connector-copy"><div><strong>{x.display_name}</strong><Badge>{x.category}</Badge></div><p>{(x.capabilities||[]).join(" · ") || "能力范围待定义"}{x.regions?.length ? " · " + x.regions.join(", ") : ""}</p><small className="table-secondary">授权：{authLabel(x.authorization_status)}</small></div><Badge tone={x.status==="active"||x.status==="configured"?"green":x.status==="error"?"amber":"neutral"}>{stateLabel(x.status)}</Badge><button className="button button--secondary button--small" onClick={() => toast(x.display_name+"：请在服务端密钥管理中配置凭证，并先核验 API 许可。")}>管理<ArrowRight size={13}/></button></div>):filteredDemo.map((x) => <div className={"connector-row"} key={x.name}><span className={"connector-logo connector-logo--"+x.tone}>{x.initials}</span><div className="connector-copy"><div><strong>{x.name}</strong><Badge>{x.category}</Badge></div><p>{x.detail}</p></div><Badge tone={x.state==="已连接"?"green":x.state==="待授权"?"amber":"neutral"}>{x.state}</Badge><button className="button button--secondary button--small" onClick={() => toast(x.name+" 需先确认账户授权、API 权限、价格与数据条款")}>查看状态<ArrowRight size={13}/></button></div>)}</div>}
      <div className="panel-note"><ShieldCheck size={14}/>连接器目录不代表 API 已接通。第三方来源必须先核验权限、数据用途、价格、保留周期和商业使用范围；真实调用费用会记录在 usage_events。</div></section>
    <section className="panel"><SectionTitle title="连接器接入原则" /><div className="evidence-grid"><div><span className="evidence-mark evidence-mark--green">01</span><strong>许可先行</strong><p>确认 API 权限、数据用途、保留周期和商业使用范围。</p></div><div><span className="evidence-mark evidence-mark--blue">02</span><strong>统一标准</strong><p>映射为标准记录，并保留供应商原始响应和来源时间。</p></div><div><span className="evidence-mark evidence-mark--amber">03</span><strong>成本可控</strong><p>设置缓存、速率限制、预算上限和失败重试策略。</p></div></div></section>
  </>;
}

function Settings({ toast }: { toast: (s: string) => void }) {
  const settings = [
    {title:"工作区与成员",desc:"用户、角色、团队和资源访问范围",icon:Users,state:"基础框架"},
    {title:"安全与权限",desc:"RBAC、服务端密钥、RLS 与敏感操作审批",icon:ShieldCheck,state:"待实施"},
    {title:"数据治理",desc:"来源许可、保留期限、删除请求与数据质量",icon:Database,state:"待实施"},
    {title:"预算与成本",desc:"供应商额度、月度预算、任务成本和告警",icon:BarChart3,state:"待实施"},
    {title:"审计日志",desc:"登录、数据变更、审批和连接器配置记录",icon:Activity,state:"待实施"},
    {title:"系统健康",desc:"部署版本、队列、失败率和服务状态",icon:Zap,state:"待实施"},
  ];
  return <><div className="settings-grid">{settings.map((s)=><button className="panel settings-card" key={s.title} onClick={() => toast(`${s.title} 设置将在后续版本接入`)}><span className="feature-icon feature-icon--blue"><s.icon size={18}/></span><span className="settings-copy"><strong>{s.title}</strong><small>{s.desc}</small><Badge>{s.state}</Badge></span><ArrowRight size={16} className="muted"/></button>)}</div><div className="demo-disclaimer"><ShieldCheck size={15}/><span>生产环境必须启用认证、最小权限、服务端密钥、数据库 RLS 与完整审计；当前版本不接入真实用户身份。</span></div></>;
}
