import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "./lib/supabase";
import CRMExtras from "./components/CRMExtras";
import ProfitCalculator from "./components/ProfitCalculator";
import ProductScoringPanel from "./components/ProductScoringPanel";
import { createAccount, createCollectionJob, createContact, createLead, createOpportunity, createProduct, listAccounts, listCollectionJobs, listContacts, listDataSources, listLeads, listOpportunities, listProducts, listApprovals, reviewApproval, saveProviderCredential, updateProviderState, type ApprovalRecord, type CollectionJobRecord, type AccountRecord, type ContactRecord, type LeadRecord, type OpportunityRecord, type ProductRecord } from "./lib/api";
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, Bell, Boxes, ClipboardList,
  Building2, Check, ChevronDown, CircleHelp, Clock3, Command, Compass, Database,
  Download, FileSearch, Globe2, LayoutDashboard, ListTodo,
  Mail, Menu, MoreHorizontal, Plus, Search, Settings2, ShieldCheck, Sparkles,
  Target, TrendingUp, Users, Workflow, X, Zap,
} from "lucide-react";

type Page = "overview" | "research" | "crm" | "intelligence" | "automation" | "integrations" | "settings";
type NavItem = { id: Page; label: string; icon: typeof LayoutDashboard; badge?: string };

const primaryNav: NavItem[] = [
  { id: "overview", label: "工作台", icon: LayoutDashboard },
  { id: "research", label: "产品研究", icon: Compass },
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
  { name: "OpenAI API", category: "ai", detail: "模型推理、结构化输出与研究摘要；需服务端 OPENAI_API_KEY", state: "待配置", initials: "AI", tone: "green" },
  { name: "Anthropic API", category: "ai", detail: "Claude 模型推理；需服务端 ANTHROPIC_API_KEY", state: "待配置", initials: "An", tone: "orange" },
  { name: "Google Gemini API", category: "ai", detail: "Gemini 模型推理；需服务端 GEMINI_API_KEY", state: "待配置", initials: "Ge", tone: "blue" },
  { name: "Cloudflare Workers AI", category: "ai", detail: "Cloudflare 托管模型；需启用 AI binding 与权限", state: "待配置", initials: "CF", tone: "orange" },
  { name: "Supabase", category: "database", detail: "Postgres、认证与业务数据存储", state: "已连接", initials: "Sb", tone: "green" },
];

const pageMeta: Record<Page, { title: string; eyebrow: string; description: string }> = {
  overview: { title: "工作台", eyebrow: "THURSDAY, OCT 29", description: "全球产品机会与客户开发进度，一目了然。" },
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

function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try { await onLogin(email.trim(), password); }
    catch (e) { setError(e instanceof Error ? e.message : "登录失败，请检查账号和密码。"); }
    finally { setBusy(false); }
  }
  return <div className="auth-screen"><div className="auth-card">
    <div className="auth-brand"><div className="brand-mark"><Sparkles size={20} strokeWidth={2.2} /></div><div><div className="brand-name">urania<span>.</span></div><div className="brand-sub">GLOBAL INTELLIGENCE</div></div></div>
    <div className="auth-heading"><span>INTERNAL WORKSPACE</span><h1>欢迎回来</h1><p>登录 Urania，继续你的全球产品研究与客户开发。</p></div>
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="urania-email">邮箱地址</label><input id="urania-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" />
      <label htmlFor="urania-password">密码</label><input id="urania-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="输入你的密码" />
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="button button--primary auth-submit" type="submit" disabled={busy}>{busy ? "正在验证…" : "登录工作区"}<ArrowRight size={16}/></button>
    </form>
    <div className="auth-foot"><ShieldCheck size={14}/> 受保护的内部工作区 · Supabase Auth</div>
  </div></div>;
}

export default function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session))).finally(() => setAuthReady(true));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  async function login(email: string, password: string) {
    if (!supabase) throw new Error("认证服务尚未配置，请联系管理员。");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async function logout() {
    if (!supabase) { setSignedIn(false); return; }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSignedIn(false);
  }
  if (!authReady) return <div className="auth-screen"><div className="auth-loading">正在连接 Urania 安全登录…</div></div>;
  if (!signedIn) return <LoginScreen onLogin={login} />;
  return <Dashboard onSignOut={logout} />;
}

function Dashboard({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const [page, setPage] = useState<Page>("overview");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("全部市场");
  const [createCustomerRequest, setCreateCustomerRequest] = useState(0);

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
      <div className="sidebar-status"><span className="status-dot status-dot--warning" /><div><strong>运行状态待核验</strong><span>连接器与部署需检查</span></div><MoreHorizontal size={16} /></div>
      <button className="profile profile-signout" type="button" onClick={() => { void onSignOut().catch(() => { setNotice("退出登录失败，请检查网络后重试。"); }); }} aria-label="退出 Urania 工作区">
        <div className="profile-avatar">U</div><div className="profile-copy"><strong>退出工作区</strong><span>安全退出当前账号</span></div><ArrowRight size={17} />
      </button>
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
            <button className="button button--primary" onClick={() => page === "crm" ? setCreateCustomerRequest((value) => value + 1) : page === "integrations" ? toast("连接器设置需要先配置服务端密钥") : go("research")}><Plus size={16} />{page === "crm" ? "新建客户" : page === "integrations" ? "添加连接器" : "新建研究"}</button>
          </div>
        </div>

        {page === "overview" && <Overview go={go} toast={toast} />}
        {page === "research" && <Research filter={filter} setFilter={setFilter} data={filteredOpportunities} query={query} toast={toast} />}
        {page === "crm" && <CRM data={visibleLeads} toast={toast} createCustomerRequest={createCustomerRequest} />}
        {page === "intelligence" && <Intelligence toast={toast} />}
        {page === "automation" && <Automation toast={toast} />}
        {page === "integrations" && <Integrations toast={toast} />}
        {page === "settings" && <Settings toast={toast} />}
        <footer className="page-footer"><span>© 2026 Urania Intelligence</span><span><span className="status-dot status-dot--warning" />实时模块与演示模块并存 · 请以数据来源标记为准</span><button onClick={() => toast("当前版本 0.1.0 · Foundation；生产部署状态需单独核验。")}><ShieldCheck size={13} />版本 0.1.0</button></footer>
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

function Research({ filter, setFilter, data, query, toast }: { filter: string; setFilter: (v: string) => void; data: typeof opportunities; query: string; toast: (s: string) => void }) {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [saving, setSaving] = useState(false);
  const [jobQuery, setJobQuery] = useState("");
  const [jobBusy, setJobBusy] = useState(false);
  const [jobMessage, setJobMessage] = useState("");
  const [jobs, setJobs] = useState<CollectionJobRecord[]>([]);
  const [jobsLoading, setJobsLoading] = useState(Boolean(supabase));
  const [jobsError, setJobsError] = useState("");
  const isLive = Boolean(supabase);

  async function reloadJobs() {
    if (!supabase) return;
    try {
      setJobsError("");
      const rows = await listCollectionJobs(20);
      setJobs(rows);
    } catch (e) {
      setJobsError(e instanceof Error ? e.message : "读取研究任务失败。");
    } finally {
      setJobsLoading(false);
    }
  }

  useEffect(() => {
    void reloadJobs();
    const timer = window.setInterval(() => { void reloadJobs(); }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  async function reloadProducts() {
    if (!supabase) return;
    setLoading(true); setError("");
    try {
      const [rows, {data:userData}] = await Promise.all([listProducts(), supabase.auth.getUser()]);
      setProducts(rows);
      setRole((userData.user?.app_metadata?.urania_role as string | undefined) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取产品记录失败。");
    } finally { setLoading(false); }
  }
  useEffect(() => { void reloadProducts(); }, []);

  async function saveProduct(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await createProduct({canonical_name:productName,category_path:productCategory.split("/").map(x=>x.trim()).filter(Boolean),brand:productBrand});
      setProductName(""); setProductCategory(""); setProductBrand(""); setProductFormOpen(false);
      toast("产品已保存到研究数据库");
      await reloadProducts();
    } catch (e) { setError(e instanceof Error ? e.message : "保存产品失败。"); }
    finally { setSaving(false); }
  }

  async function startResearch() {
    const q = (jobQuery || query).trim();
    if (!q) { setJobMessage("请先输入一个产品或市场研究关键词。"); return; }
    setJobBusy(true); setJobMessage(""); setError("");
    try {
      const country = filter === "美国" ? "US" : filter === "德国" ? "DE" : filter === "英国" ? "GB" : filter === "欧盟" ? "EU" : null;
      const result = await createCollectionJob({
        job_type:"research.search",
        market_country:country,
        input_payload:{query:q,target_market:filter==="全部市场"?"global":filter,workflow_version:"research-v1"},
        idempotency_key:"research-"+crypto.randomUUID()
      });
      setJobMessage("研究任务已创建："+result.id+" · 状态："+result.status+"。任务已进入队列；第三方数据源仍需完成授权与适配器配置。");
      toast("研究任务已提交");
    } catch (e) { setError(e instanceof Error ? e.message : "提交研究任务失败。"); }
    finally { setJobBusy(false); }
  }

  const demoRows = data.filter((item) => {
    const q = query.trim().toLowerCase();
    return (!q || (item.name+" "+item.category+" "+item.market).toLowerCase().includes(q)) &&
      (filter==="全部市场" || item.market.includes(filter));
  });
  const liveRows = products.filter((p) => !query.trim() || (p.canonical_name+" "+(p.description||"")+" "+(p.brand||"")+" "+p.category_path.join(" ")).toLowerCase().includes(query.trim().toLowerCase()));

  return <>
    <div className="research-summary"><div><span className="summary-label">研究工作区</span><strong>{isLive?products.length:12} 个产品记录</strong><span className="muted">· {isLive?"Supabase 数据":"演示样例"}</span></div><div className="summary-actions"><input className="research-query-input" value={jobQuery} onChange={e=>setJobQuery(e.target.value)} placeholder="研究关键词…" aria-label="研究任务关键词"/><select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="选择研究目标市场"><option>全部市场</option><option>美国</option><option>欧盟</option><option>英国</option><option>德国</option></select>{(!isLive || role==="admin" || role==="researcher")&&<button className="button button--secondary" onClick={() => setProductFormOpen(v=>!v)}><Plus size={15}/>{productFormOpen?"关闭表单":"新增产品"}</button>}<button className="button button--primary" disabled={jobBusy} onClick={() => void startResearch()}><Sparkles size={15}/>{jobBusy?"提交中…":"创建研究任务"}</button></div></div>
    <div className="metric-grid metric-grid--research"><MetricCard label="产品记录" value={String(isLive?products.length:12)} change={isLive?"真实记录":"演示数据"} icon={Boxes} tone="purple" note="候选产品库" /><MetricCard label="有来源证据" value={isLive?"0":"8"} change="等待数据采集" icon={Activity} tone="blue" note={isLive?"证据层尚未接入":"样例数据"}/><MetricCard label="已评分产品" value={isLive?"0":"6"} change="确定性评分引擎待接入" icon={BarChart3} tone="green" note="不虚报市场结论"/><MetricCard label="数据缺口" value={isLive?"全部":"14"} change="待补充证据" icon={FileSearch} tone="orange" note="来源授权后更新"/></div>
    {productFormOpen&&<form className="account-form" onSubmit={saveProduct}><div className="account-form-heading"><strong>新增研究产品</strong><span>当前只建立产品主档，不会自动推断销量或市场需求。</span></div><div className="account-form-grid"><label>产品名称 *<input required minLength={2} maxLength={240} value={productName} onChange={e=>setProductName(e.target.value)} placeholder="Portable power station accessories"/></label><label>品牌<input value={productBrand} onChange={e=>setProductBrand(e.target.value)} placeholder="品牌（可选）"/></label><label>分类路径<input value={productCategory} onChange={e=>setProductCategory(e.target.value)} placeholder="户外 / 能源 / 配件"/></label></div>{error&&<p className="auth-error" role="alert">{error}</p>}<div className="account-form-actions"><button type="button" className="button button--secondary" onClick={()=>setProductFormOpen(false)}>取消</button><button type="submit" className="button button--primary" disabled={saving}>{saving?"保存中…":"保存产品"}</button></div></form>}
    {jobMessage&&<div className="inline-success"><Check size={15}/><span>{jobMessage}</span></div>}
    {isLive&&<section className="panel research-jobs-panel">
      <SectionTitle title="研究任务与来源证据" action="刷新任务" onAction={() => { void reloadJobs(); }}/>
      <div className="panel-note"><Activity size={14}/>每 15 秒刷新一次任务状态。只有已获授权的数据源才会执行采集；失败任务会显示错误码。</div>
      {jobsError&&<div className="inline-error" role="alert"><ShieldCheck size={15}/><span>{jobsError}</span><button onClick={() => void reloadJobs()}>重试</button></div>}
      {jobsLoading?<div className="empty-state"><Activity size={22}/><strong>正在读取研究任务…</strong></div>:jobs.length===0?<div className="empty-state"><FileSearch size={24}/><strong>还没有研究任务</strong><span>输入关键词并创建研究任务后，任务状态和来源链接会显示在这里。</span></div>:
        <div className="research-job-list">{jobs.map(job=><article className="research-job" key={job.id}>
          <div className="research-job-heading"><div><strong>{job.query||job.job_type}</strong><small>{job.provider_key||"等待分配数据源"} · {job.market_country||"全球"} · {new Date(job.created_at).toLocaleString()}</small></div><Badge tone={job.status==="succeeded"?"green":job.status==="failed"||job.status==="dead_letter"?"amber":job.status==="running"?"blue":"amber"}>{job.status}</Badge></div>
          <div className="research-job-meta"><span>{job.result_count} 条结果</span><span>尝试 {job.attempts}/{job.max_attempts}</span><span>{job.finished_at?"完成于 "+new Date(job.finished_at).toLocaleString():"尚未完成"}</span></div>
          {job.error_message&&<p className="research-job-error">{job.error_code||"job_error"}：{job.error_message}</p>}
          {job.results.length>0&&<div className="research-job-results">{job.results.slice(0,5).map((result,index)=><div className="research-job-result" key={job.id+"-"+result.rank}><span className="research-result-rank">{result.rank||index+1}</span><div><strong>{result.url?<a href={result.url} target="_blank" rel="noreferrer">{result.title}</a>:result.title}</strong>{result.snippet&&<p>{result.snippet}</p>}<small>{result.displayed_url||result.url||"无来源 URL"}</small></div></div>)}</div>}
        </article>)}</div>}
    </section>}
    {error&&!productFormOpen&&<div className="inline-error" role="alert"><ShieldCheck size={15}/><span>{error}</span><button onClick={()=>isLive?void reloadProducts():setError("")}>重试</button></div>}
    <section className="panel"><SectionTitle title={isLive?"产品主档与研究状态":"产品机会样例"} action={isLive?"刷新":"评分说明"} onAction={() => isLive?void reloadProducts():toast("正式评分必须记录模型版本、输入证据和风险标记。")}/>{loading?<div className="empty-state"><Activity size={24}/><strong>正在读取产品记录…</strong></div>:<div className="table-wrap"><table><thead><tr><th>产品</th><th>分类 / 品牌</th><th>研究状态</th><th>市场评分</th><th>证据情况</th><th /></tr></thead><tbody>{isLive?liveRows.map(p=><tr key={p.id}><td><div className="product-name"><span className="product-symbol"><Boxes size={15}/></span><span><strong>{p.canonical_name}</strong><small>{p.description||"尚无产品描述"}</small></span></div></td><td>{p.category_path.join(" / ")||"未分类"}{p.brand?" · "+p.brand:""}</td><td><Badge>{p.status}</Badge></td><td>未评分</td><td><Badge tone="amber">等待证据</Badge></td><td><button className="icon-button table-more" onClick={()=>toast("产品详情、证据时间线与评分将在下一阶段接入。")} aria-label="产品详情"><ArrowRight size={15}/></button></td></tr>):demoRows.map((p)=><tr key={p.name}><td><div className="product-name"><span className="product-symbol"><Boxes size={15}/></span><span><strong>{p.name}</strong><small>{p.category}</small></span></div></td><td>{p.market}</td><td><Badge tone={p.status==="值得验证"?"green":"amber"}>{p.status}</Badge></td><td>{p.score} / 100</td><td><Badge tone="amber">演示证据</Badge></td><td><button className="icon-button table-more" onClick={()=>toast(p.name+"：演示数据，不代表已验证市场机会。")} aria-label="产品详情"><ArrowRight size={15}/></button></td></tr>)}</tbody></table>{(isLive?liveRows.length:demoRows.length)===0&&<div className="empty-state"><FileSearch size={28}/><strong>还没有匹配的产品记录</strong><span>新增产品主档，或创建研究任务开始收集证据。</span></div>}</div>}<div className="panel-note"><ShieldCheck size={14}/>{isLive?"真实数据库已连接；市场需求、销量和利润指标在证据源接入前不会显示为已验证。":"演示数据仅用于预览，不代表真实市场、销售额或利润。"}</div></section>
    <ProductScoringPanel products={products} toast={toast}/>
    <ProfitCalculator products={products} toast={toast}/>
    <div className="research-cards"><article className="panel mini-feature"><span className="feature-icon feature-icon--purple"><Sparkles size={18}/></span><div><h3>AI 研究简报</h3><p>证据聚合、来源引用、风险审查与下一步验证动作。</p><button className="text-action" onClick={()=>toast("报告生成将在真实证据与模型调用接入后开放。")}>查看报告规范<ArrowRight size={13}/></button></div></article><article className="panel mini-feature"><span className="feature-icon feature-icon--green"><BarChart3 size={18}/></span><div><h3>利润情景计算器</h3><p>采购、物流、关税、平台费用、广告与退货后的贡献利润。</p><button className="text-action" onClick={()=>toast("利润计算器需供应商报价与费用规则，下一阶段接入。")}>查看计算规则<ArrowRight size={13}/></button></div></article></div>
  </>;
}

function CRM({ data, toast, createCustomerRequest }: { data: typeof leads; toast: (s: string) => void; createCustomerRequest: number }) {
  const [tab, setTab] = useState<"accounts" | "contacts" | "leads" | "opportunities">("accounts");
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [liveLeads, setLiveLeads] = useState<LeadRecord[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const [formKind, setFormKind] = useState<"account" | "contact" | "lead" | "opportunity" | null>(null);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");
  const [accountType, setAccountType] = useState("importer");
  const [contactAccountId, setContactAccountId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactBasis, setContactBasis] = useState("legitimate interest");
  const [contactDnc, setContactDnc] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadAccountId, setLeadAccountId] = useState("");
  const [leadSourceUrl, setLeadSourceUrl] = useState("");
  const [leadNextDate, setLeadNextDate] = useState("");
  const [opportunityName, setOpportunityName] = useState("");
  const [opportunityAccountId, setOpportunityAccountId] = useState("");
  const [opportunityAmount, setOpportunityAmount] = useState("");
  const [opportunityCurrency, setOpportunityCurrency] = useState("USD");
  const [opportunityProbability, setOpportunityProbability] = useState("10");
  const [opportunityCloseDate, setOpportunityCloseDate] = useState("");
  const [opportunityStage, setOpportunityStage] = useState("qualification");
  const isLive = Boolean(supabase);
  const canManageSales = !isLive || role==="admin" || role==="sales";

  useEffect(() => {
    if (createCustomerRequest > 0) {
      setTab("accounts");
      setFormKind("account");
      setError("");
    }
  }, [createCustomerRequest]);

  async function reload() {
    if (!supabase) return;
    setLoading(true); setError("");
    try {
      const {data:userData} = await supabase.auth.getUser();
      const nextRole = (userData.user?.app_metadata?.urania_role as string | undefined) ?? null;
      const [accountRows, leadRows] = await Promise.all([listAccounts(),listLeads()]);
      setAccounts(accountRows); setLiveLeads(leadRows); setRole(nextRole);
      if (nextRole==="admin" || nextRole==="sales") {
        const [contactRows,opportunityRows] = await Promise.all([listContacts(),listOpportunities()]);
        setContacts(contactRows); setOpportunities(opportunityRows);
      } else { setContacts([]); setOpportunities([]); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取 CRM 数据失败。");
    } finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);

  async function saveAccount(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await createAccount({company_name:companyName,website_url:website||null,country_code:country||null,industry:industry||null,account_type:accountType});
      setCompanyName("");setWebsite("");setCountry("");setIndustry("");setFormKind(null);toast("企业已保存到 Urania CRM");await reload();
    } catch(e) { setError(e instanceof Error?e.message:"保存企业失败。"); } finally { setSaving(false); }
  }
  async function saveContact(event: FormEvent) {
    event.preventDefault();setSaving(true);setError("");
    try {
      await createContact({account_id:contactAccountId,full_name:contactName,job_title:contactTitle||undefined,work_email:contactEmail||undefined,phone:contactPhone||undefined,lawful_basis:contactBasis,do_not_contact:contactDnc});
      setContactName("");setContactTitle("");setContactEmail("");setContactPhone("");setContactDnc(false);setFormKind(null);toast("联系人已保存；首次开发仍需单独审批");await reload();
    } catch(e) { setError(e instanceof Error?e.message:"保存联系人失败。"); } finally { setSaving(false); }
  }
  async function saveLead(event: FormEvent) {
    event.preventDefault();setSaving(true);setError("");
    try {
      await createLead({lead_name:leadName,account_id:leadAccountId||null,source_url:leadSourceUrl||null,next_action_at:leadNextDate?new Date(leadNextDate).toISOString():null});
      setLeadName("");setLeadSourceUrl("");setLeadNextDate("");setFormKind(null);toast("销售线索已创建");await reload();
    } catch(e) { setError(e instanceof Error?e.message:"保存线索失败。"); } finally { setSaving(false); }
  }
  async function saveOpportunity(event: FormEvent) {
    event.preventDefault();setSaving(true);setError("");
    try {
      await createOpportunity({account_id:opportunityAccountId,name:opportunityName,amount:opportunityAmount===""?null:Number(opportunityAmount),currency:opportunityCurrency,probability:Number(opportunityProbability)/100,expected_close_date:opportunityCloseDate||null,stage:opportunityStage});
      setOpportunityName("");setOpportunityAmount("");setOpportunityCloseDate("");setFormKind(null);toast("商机已创建");await reload();
    } catch(e) { setError(e instanceof Error?e.message:"保存商机失败。"); } finally { setSaving(false); }
  }

  const demoRows = data;
  const liveRows = liveLeads;
  const newLabel = ({accounts:"新建企业",contacts:"新建联系人",leads:"新建线索",opportunities:"新建商机"} as const)[tab];
  const formForTab = ({accounts:"account",contacts:"contact",leads:"lead",opportunities:"opportunity"} as const)[tab];
  const chooseForm = () => setFormKind(current => current===formForTab?null:formForTab);

  return <>
    <div className="crm-metrics"><MetricCard label="企业账户" value={isLive?String(accounts.length):"248"} change={isLive?"实时数据库":"+18"} icon={Building2} tone="blue" note={isLive?"真实记录":"演示数据"}/><MetricCard label="销售线索" value={isLive?String(liveLeads.length):"32"} change={isLive?"数据库记录":"8 个逾期"} icon={ListTodo} tone="orange" note={isLive?"真实记录":"需要处理"}/><MetricCard label="商机金额" value={isLive?opportunities.filter(o=>o.currency==="USD").reduce((sum,o)=>sum+(Number(o.amount)||0),0).toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}):"$184K"} change={isLive?"仅 USD 近似汇总":"示例金额"} icon={Target} tone="purple" note={isLive?"多币种未换汇":"演示数据"}/></div>
    <section className="panel">
      <div className="crm-toolbar"><div><SectionTitle title="CRM 工作区"/><p className="panel-subtitle">{isLive?"已连接 Supabase RPC；联系人与商机仅对销售和管理员开放。":"集中管理企业、联系人、线索和商机。"}</p></div><div className="summary-actions">{isLive&&<button className="button button--secondary" onClick={()=>void reload()}><Activity size={14}/>刷新</button>}{canManageSales&&<button className="button button--primary" onClick={chooseForm}><Plus size={15}/>{formKind? "关闭表单":newLabel}</button>}</div></div>
      <div className="crm-tabs"><button className={tab==="accounts"?"crm-tab crm-tab--active":"crm-tab"} onClick={()=>{setTab("accounts");setFormKind(null)}}>企业账户 <span>{isLive?accounts.length:"4"}</span></button>{canManageSales&&<button className={tab==="contacts"?"crm-tab crm-tab--active":"crm-tab"} onClick={()=>{setTab("contacts");setFormKind(null)}}>联系人 <span>{isLive?contacts.length:"—"}</span></button>}<button className={tab==="leads"?"crm-tab crm-tab--active":"crm-tab"} onClick={()=>{setTab("leads");setFormKind(null)}}>销售线索 <span>{isLive?liveLeads.length:"4"}</span></button>{canManageSales&&<button className={tab==="opportunities"?"crm-tab crm-tab--active":"crm-tab"} onClick={()=>{setTab("opportunities");setFormKind(null)}}>商机 <span>{isLive?opportunities.length:"—"}</span></button>}</div>
      {formKind==="account"&&<form className="account-form" onSubmit={saveAccount}><div className="account-form-heading"><strong>新建企业账户</strong><span>企业数据写入 CRM 并记录审计事件。</span></div><div className="account-form-grid"><label>企业名称 *<input required minLength={2} maxLength={200} value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Company name"/></label><label>官网<input type="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://example.com"/></label><label>国家代码<input maxLength={2} pattern="[A-Za-z]{2}" value={country} onChange={e=>setCountry(e.target.value.toUpperCase())} placeholder="DE / US / GB"/></label><label>行业<input value={industry} onChange={e=>setIndustry(e.target.value)} placeholder="Import / Retail / ..."/></label><label>企业类型<select value={accountType} onChange={e=>setAccountType(e.target.value)}><option value="importer">进口商</option><option value="distributor">分销商</option><option value="retailer">零售商</option><option value="brand">品牌</option><option value="manufacturer">制造商</option><option value="wholesaler">批发商</option><option value="service_provider">服务商</option><option value="unknown">未知</option></select></label></div><FormActions saving={saving} onCancel={()=>setFormKind(null)} label="保存企业"/></form>}
      {formKind==="contact"&&<form className="account-form" onSubmit={saveContact}><div className="account-form-heading"><strong>新建联系人</strong><span>记录业务联系方式前必须注明处理依据；请勿导入未经授权的个人资料。</span></div><div className="account-form-grid"><label>关联企业 *<select required value={contactAccountId} onChange={e=>setContactAccountId(e.target.value)}><option value="">选择企业…</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.company_name}</option>)}</select></label><label>姓名 *<input required minLength={2} maxLength={200} value={contactName} onChange={e=>setContactName(e.target.value)} placeholder="Full name"/></label><label>职位<input value={contactTitle} onChange={e=>setContactTitle(e.target.value)} placeholder="Purchasing Manager"/></label><label>工作邮箱<input type="email" value={contactEmail} onChange={e=>setContactEmail(e.target.value)} placeholder="name@company.com"/></label><label>电话<input value={contactPhone} onChange={e=>setContactPhone(e.target.value)} placeholder="+1…"/></label><label>处理依据 *<select required value={contactBasis} onChange={e=>setContactBasis(e.target.value)}><option value="legitimate interest">合法利益（需评估）</option><option value="consent">已取得同意</option><option value="contract">合同必要</option><option value="other documented basis">其他已记录依据</option></select></label></div><label className="provider-attestation"><input type="checkbox" checked={contactDnc} onChange={e=>setContactDnc(e.target.checked)}/><span>禁止联系此联系人（Do Not Contact）</span></label><FormActions saving={saving} onCancel={()=>setFormKind(null)} label="保存联系人"/></form>}
      {formKind==="lead"&&<form className="account-form" onSubmit={saveLead}><div className="account-form-heading"><strong>新建销售线索</strong><span>线索可以暂时不关联企业；来源和下一步动作应尽量补全。</span></div><div className="account-form-grid"><label>线索名称 *<input required minLength={2} maxLength={200} value={leadName} onChange={e=>setLeadName(e.target.value)} placeholder="Potential distributor in Germany"/></label><label>关联企业<select value={leadAccountId} onChange={e=>setLeadAccountId(e.target.value)}><option value="">暂不关联</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.company_name}</option>)}</select></label><label>来源网址<input type="url" value={leadSourceUrl} onChange={e=>setLeadSourceUrl(e.target.value)} placeholder="https://…"/></label><label>下一步日期<input type="date" value={leadNextDate} onChange={e=>setLeadNextDate(e.target.value)}/></label></div><FormActions saving={saving} onCancel={()=>setFormKind(null)} label="保存线索"/></form>}
      {formKind==="opportunity"&&<form className="account-form" onSubmit={saveOpportunity}><div className="account-form-heading"><strong>新建商机</strong><span>金额按所选币种保存；汇总不会在未换汇时混合不同币种。</span></div><div className="account-form-grid"><label>关联企业 *<select required value={opportunityAccountId} onChange={e=>setOpportunityAccountId(e.target.value)}><option value="">选择企业…</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.company_name}</option>)}</select></label><label>商机名称 *<input required minLength={2} maxLength={240} value={opportunityName} onChange={e=>setOpportunityName(e.target.value)} placeholder="Q4 wholesale supply"/></label><label>预估金额<input type="number" min="0" step="0.01" value={opportunityAmount} onChange={e=>setOpportunityAmount(e.target.value)} placeholder="0.00"/></label><label>币种<select value={opportunityCurrency} onChange={e=>setOpportunityCurrency(e.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>CNY</option><option>PLN</option></select></label><label>成交概率（%）<input type="number" min="0" max="100" value={opportunityProbability} onChange={e=>setOpportunityProbability(e.target.value)}/></label><label>预计成交日期<input type="date" value={opportunityCloseDate} onChange={e=>setOpportunityCloseDate(e.target.value)}/></label><label>阶段<select value={opportunityStage} onChange={e=>setOpportunityStage(e.target.value)}><option value="qualification">资格确认</option><option value="discovery">需求发现</option><option value="proposal">方案 / 报价</option><option value="negotiation">谈判</option><option value="won">赢单</option><option value="lost">丢单</option></select></label></div><FormActions saving={saving} onCancel={()=>setFormKind(null)} label="保存商机"/></form>}
      {error&&!formKind&&<div className="inline-error" role="alert"><ShieldCheck size={15}/><span>{error}</span><button onClick={()=>void reload()}>重试</button></div>}
      {loading?<div className="empty-state"><Activity size={24}/><strong>正在读取 CRM 数据…</strong></div>:tab==="accounts"?<div className="table-wrap"><table><thead><tr><th>企业</th><th>国家</th><th>行业</th><th>企业类型</th><th>验证状态</th><th>生命周期</th></tr></thead><tbody>{(isLive?accounts:demoRows.map((x,i)=>({id:String(i),company_name:x.company,website_url:null,domain:null,country_code:null,industry:x.product,account_type:x.type.split(" / ")[0],lifecycle_stage:"prospect",verification_status:"unverified",owner_id:null,created_at:"",updated_at:""} as AccountRecord))).map(a=><tr key={a.id}><td><div className="company-cell"><span className="company-avatar company-avatar--blue">{a.company_name.slice(0,2).toUpperCase()}</span><span><strong>{a.company_name}</strong><small>{a.domain||a.website_url||"尚未验证官网"}</small></span></div></td><td>{a.country_code||"—"}</td><td>{a.industry||"—"}</td><td>{a.account_type}</td><td><Badge tone={a.verification_status==="human_verified"?"green":"amber"}>{a.verification_status}</Badge></td><td><Badge>{a.lifecycle_stage}</Badge></td></tr>)}</tbody></table>{(isLive?accounts.length:demoRows.length)===0&&<div className="empty-state"><Building2 size={26}/><strong>还没有企业账户</strong><span>创建第一条企业记录，数据将保存到 Supabase。</span></div>}</div>:tab==="contacts"?<div className="table-wrap"><table><thead><tr><th>联系人</th><th>企业</th><th>工作邮箱</th><th>处理依据</th><th>联系状态</th><th>验证</th></tr></thead><tbody>{contacts.map(x=><tr key={x.id}><td><strong>{x.full_name}</strong><small className="table-secondary">{x.job_title||"未填写职位"}</small></td><td>{x.company_name}</td><td>{x.work_email||"—"}</td><td>{x.lawful_basis||"未记录"}</td><td><Badge tone={x.do_not_contact?"amber":"neutral"}>{x.do_not_contact?"禁止联系":x.consent_status}</Badge></td><td><Badge>{x.verification_status}</Badge></td></tr>)}</tbody></table>{contacts.length===0&&<div className="empty-state"><Users size={26}/><strong>暂无联系人</strong><span>创建联系人前先核验数据来源与处理依据。</span></div>}</div>:tab==="leads"?<div className="table-wrap"><table><thead><tr><th>线索</th><th>关联企业</th><th>国家</th><th>状态</th><th>匹配评分</th><th>下一步</th></tr></thead><tbody>{(isLive?liveRows:demoRows.map((x,i)=>({id:String(i),lead_name:x.company,status:x.stage,score:x.fit,source_url:null,next_action_at:null,created_at:"",company_name:x.company,country_code:null,contact_name:null} as LeadRecord))).map(x=><tr key={x.id}><td><strong>{x.lead_name}</strong><small className="table-secondary">{x.contact_name||"无联系人"}</small></td><td>{x.company_name||"—"}</td><td>{x.country_code||"—"}</td><td><Badge tone={x.status==="qualified"||x.status==="converted"?"green":"amber"}>{x.status}</Badge></td><td>{x.score===null?"—":x.score}</td><td>{x.next_action_at?new Date(x.next_action_at).toLocaleDateString():"未安排"}</td></tr>)}</tbody></table>{(isLive?liveRows.length:demoRows.length)===0&&<div className="empty-state"><Users size={26}/><strong>还没有销售线索</strong><span>先添加企业账户，再开始线索开发。</span></div>}</div>:<div className="table-wrap"><table><thead><tr><th>商机</th><th>企业</th><th>阶段</th><th>金额</th><th>概率</th><th>预计成交</th></tr></thead><tbody>{opportunities.map(x=><tr key={x.id}><td><strong>{x.name}</strong></td><td>{x.company_name}</td><td><Badge tone={x.stage==="won"?"green":x.stage==="lost"?"amber":"neutral"}>{x.stage}</Badge></td><td>{x.amount===null?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:x.currency||"USD"}).format(Number(x.amount))}</td><td>{x.probability===null?"—":Math.round(Number(x.probability)*100)+"%"}</td><td>{x.expected_close_date||"—"}</td></tr>)}</tbody></table>{opportunities.length===0&&<div className="empty-state"><Target size={26}/><strong>暂无商机</strong><span>将已确认需求转为商机，记录金额、阶段和预计成交日期。</span></div>}</div>}
      <div className="panel-note"><ShieldCheck size={14}/>{isLive?"企业、联系人、线索和商机均通过角色受限 RPC 读写；联系人包含处理依据与禁止联系标记。":"演示企业仅用于预览，不代表真实客户。"}</div>
    </section>
    <CRMExtras role={role} toast={toast}/>
  </>;
}

function FormActions({saving,onCancel,label}:{saving:boolean;onCancel:()=>void;label:string}) {
  return <div className="account-form-actions"><button type="button" className="button button--secondary" onClick={onCancel}>取消</button><button type="submit" className="button button--primary" disabled={saving}>{saving?"保存中…":label}</button></div>;
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

function Automation({ toast }: { toast: (s: string) => void }) {
  const [approvals,setApprovals]=useState<ApprovalRecord[]>([]);
  const [loading,setLoading]=useState(Boolean(supabase));
  const [error,setError]=useState("");
  const [actingId,setActingId]=useState("");
  const isLive=Boolean(supabase);

  async function reloadApprovals(){
    if(!supabase){setLoading(false);return;}
    setLoading(true);setError("");
    try{setApprovals(await listApprovals());}
    catch(e){setError(e instanceof Error?e.message:"无法读取人工审批队列。");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void reloadApprovals();},[]);

  async function decide(id:string,decision:"approved"|"rejected"){
    setActingId(id);setError("");
    try{
      await reviewApproval(id,decision);
      toast(decision==="approved"?"审批已通过并记录审计":"审批已拒绝并记录审计");
      await reloadApprovals();
    }catch(e){setError(e instanceof Error?e.message:"更新审批状态失败。");}
    finally{setActingId("");}
  }

  const pending=approvals.filter(a=>a.status==="pending").length;
  return <>
    <div className="metric-grid">
      <MetricCard label="人工审批队列" value={isLive?String(approvals.length):"—"} change={isLive?"真实数据库记录":"需要登录连接"} icon={ShieldCheck} tone="purple" note={isLive?"Supabase":"未连接"} />
      <MetricCard label="待人工审批" value={isLive?String(pending):"—"} change="首次外联不得自动发送" icon={Mail} tone="orange" note="人工决定" />
      <MetricCard label="队列失败任务" value="—" change="需接入实时监控" icon={Activity} tone="green" note="监控未接入" />
      <MetricCard label="本月 API 成本" value="—" change="需接入账单统计" icon={Database} tone="blue" note="账单未接入" />
    </div>
    <section className="panel">
      <div className="crm-toolbar"><div><SectionTitle title="任务与审批队列"/><p className="panel-subtitle">审批状态由数据库保存并写入审计；批准仅代表人工审核通过，不代表邮件已发送。</p></div><button className="button button--secondary" onClick={()=>void reloadApprovals()} disabled={loading}><Activity size={14}/>刷新</button></div>
      {error&&<div className="inline-error" role="alert"><ShieldCheck size={15}/><span>{error}</span><button onClick={()=>void reloadApprovals()}>重试</button></div>}
      {loading?<div className="empty-state"><Activity size={24}/><strong>正在读取审批记录…</strong></div>:!isLive?<div className="empty-state"><ShieldCheck size={24}/><strong>尚未连接审批数据库</strong><span>连接并登录后，此处显示真实审批记录。</span></div>:approvals.length===0?<div className="empty-state"><ClipboardList size={24}/><strong>暂无审批请求</strong><span>当前没有待审批或历史审批记录；系统不会自动发送首次开发邮件。</span></div>:<div className="workflow-list">{approvals.map(a=>{
        const payload=a.payload||{};
        const subject=typeof payload.subject==="string"?payload.subject:a.subject_type+" · "+a.subject_id.slice(0,8);
        const recipient=typeof payload.to==="string"?payload.to:typeof payload.recipient==="string"?payload.recipient:"未提供收件人";
        const statusLabel=({pending:"待审核",approved:"已批准",rejected:"已拒绝",cancelled:"已取消"} as Record<string,string>)[a.status]||a.status;
        return <div className="workflow-row" key={a.id}>
          <span className="workflow-icon workflow-icon--mail"><Mail size={17}/></span>
          <div className="workflow-copy"><strong>{subject}</strong><small>{a.approval_type==="outbound_email"?"首次外联邮件":a.approval_type} · {recipient} · {new Date(a.requested_at).toLocaleString()}</small>{a.review_note&&<small>审核意见：{a.review_note}</small>}</div>
          <Badge tone={a.status==="approved"?"green":a.status==="pending"?"amber":"neutral"}>{statusLabel}</Badge>
          <div className="workflow-actions">{a.status==="pending"?<><button className="button button--secondary button--small" disabled={actingId===a.id} onClick={()=>void decide(a.id,"rejected")}>拒绝</button><button className="button button--primary button--small" disabled={actingId===a.id} onClick={()=>void decide(a.id,"approved")}>{actingId===a.id?"处理中…":"批准"}</button></>:<span className="table-secondary">{a.reviewed_at?new Date(a.reviewed_at).toLocaleString():"—"}</span>}</div>
        </div>;
      })}</div>}
      <div className="panel-note"><ShieldCheck size={14}/>批准/拒绝通过受限 RPC 执行并记录审核人和时间；此处不会触发邮件发送。邮件发送端必须另行校验审批状态。</div>
    </section>
    <section className="panel"><SectionTitle title="工作流目录" /><div className="workflow-catalog">{[{name:"全球产品发现",desc:"关键词 → 搜索数据 → 去重 → 机会评分",icon:Compass},{name:"企业线索发现",desc:"目标市场 → 企业搜索 → 画像丰富 → 人工复核",icon:Building2},{name:"产品与客户匹配",desc:"产品画像 → 企业需求 → 匹配分数 → CRM 线索",icon:Target},{name:"研究报告生成",desc:"证据聚合 → 风险检查 → AI 报告",icon:Sparkles}].map(x=><div className="catalog-row" key={x.name}><span className="feature-icon feature-icon--purple"><x.icon size={17}/></span><div><strong>{x.name}</strong><small>{x.desc}</small></div><Badge>规划中</Badge><button className="icon-button" onClick={() => toast(`${x.name} 将在工作流引擎开发后启用`) }><ArrowRight size={15}/></button></div>)}</div></section>
  </>;
}

function Integrations({ toast }: { toast: (s: string) => void }) {
  const [category, setCategory] = useState("全部类别");
  const [liveConnectors, setLiveConnectors] = useState<Array<{provider_key:string;display_name:string;category:string;status:string;authorization_status:string;regions:string[];capabilities:string[]}>>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [attestation, setAttestation] = useState(false);
  const [licenseScope, setLicenseScope] = useState("SerpApi Google Search API; internal product research only; no redistribution");
  const [retentionDays, setRetentionDays] = useState("30");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [savingProvider, setSavingProvider] = useState(false);
  const isLive = Boolean(supabase);
  useEffect(() => {
    if (!supabase) return;
    Promise.all([listDataSources(), supabase.auth.getUser()])
      .then(([rows, {data:userData}]) => {
        setLiveConnectors(rows as typeof liveConnectors);
        setRole((userData.user?.app_metadata?.urania_role as string | undefined) ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "无法读取连接器目录。"))
      .finally(() => setLoading(false));
  }, []);
  async function saveProviderAuthorization() {
    if (!selectedProvider || !attestation) {
      setError("请确认已配置服务端 API 密钥，并完成供应商许可审核。");
      return;
    }
    const days = Number(retentionDays);
    if (!Number.isInteger(days) || days < 1 || days > 3650 || licenseScope.trim().length < 8) {
      setError("请填写有效的数据使用范围和 1–3650 天的保留期限。");
      return;
    }
    setSavingProvider(true); setError("");
    try {
      if (providerApiKey.trim().length < 8) {
        setError("请输入有效的 API 密钥。");
        return;
      }
      await saveProviderCredential(selectedProvider, providerApiKey.trim());
      const nextStatus = selectedProvider === "serpapi" ? "active" : "configured";
      const updated = await updateProviderState({
        provider_key:selectedProvider,status:nextStatus,authorization_status:"approved",
        license_scope:licenseScope.trim(),retention_days:days
      });
      setLiveConnectors(rows=>rows.map(x=>x.provider_key===selectedProvider?{...x,...updated}:x));
      setSelectedProvider(null); setAttestation(false); setProviderApiKey("");
      toast(selectedProvider === "serpapi" ? "SerpApi 密钥已安全保存并启用。" : "密钥已安全保存；该供应商的实际调用适配器仍需实现。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新授权状态失败。");
    } finally { setSavingProvider(false); }
  }

  const categories = ["全部类别","search","trends","marketplace","company_data","contact_data","supplier_data","ai","database","other"];
  const filteredLive = liveConnectors.filter((x) => category==="全部类别" || x.category===category);
  const filteredDemo = connectors.filter((x) => category==="全部类别" || x.category===category);
  const stateLabel = (s:string) => ({planned:"待配置",pending_authorization:"待授权",configured:"已配置",active:"已启用",paused:"已暂停",disabled:"已禁用",error:"异常"}[s] || s);
  const authLabel = (s:string) => ({unknown:"权限待核验",pending:"申请中",approved:"已授权",restricted:"受限",rejected:"未通过"}[s] || s);
  return <>
    <div className="integration-banner"><div className="integration-banner-icon"><Database size={21}/></div><div><h2>统一连接器目录</h2><p>统一管理搜索、电商、企业数据与 AI 模型。密钥通过服务端 Secret 配置；浏览器和代码仓库不得保存真实密钥。</p></div><Badge tone="blue">{isLive?liveConnectors.length:connectors.length} 个目录条目</Badge></div>
    <div className="integration-summary"><MetricCard label="连接器目录" value={String(isLive?liveConnectors.length:connectors.length)} change="可扩展" icon={Database} tone="purple" note={isLive?"数据库记录":"演示清单"} /><MetricCard label="已启用" value={String(isLive?liveConnectors.filter(x=>x.status==="active").length:1)} change="真实连接需验证" icon={Check} tone="green" note="仅统计 active" /><MetricCard label="待配置 / 授权" value={String(isLive?liveConnectors.filter(x=>x.status==="planned"||x.authorization_status!=="approved").length:4)} change="需要凭证与许可" icon={Settings2} tone="orange" note="第三方数据源" /><MetricCard label="本月调用成本" value="—" change="账单未接入" icon={BarChart3} tone="blue" note="不会虚报费用" /></div>
    <section className="panel"><div className="integration-toolbar"><SectionTitle title={isLive?"数据源注册表":"数据源连接器"} /><select value={category} onChange={(e)=>setCategory(e.target.value)} aria-label="筛选连接器类别">{categories.map(c=><option key={c} value={c}>{c==="全部类别"?"全部类别":c}</option>)}</select></div>
      {error&&<div className="inline-error"><ShieldCheck size={15}/><span>{error}</span></div>}
      {loading?<div className="empty-state"><Activity size={24}/><strong>正在读取连接器目录…</strong></div>:<div className="connector-list">{isLive?filteredLive.map((x) => <div className="connector-row" key={x.provider_key}><span className="connector-logo connector-logo--blue">{x.display_name.slice(0,2)}</span><div className="connector-copy"><div><strong>{x.display_name}</strong><Badge>{x.category}</Badge></div><p>{(x.capabilities||[]).join(" · ") || "能力范围待定义"}{x.regions?.length ? " · " + x.regions.join(", ") : ""}</p><small className="table-secondary">授权：{authLabel(x.authorization_status)}</small></div><Badge tone={x.status==="active"||x.status==="configured"?"green":x.status==="error"?"amber":"neutral"}>{stateLabel(x.status)}</Badge>{role==="admin" && x.category!=="database" && x.provider_key!=="cloudflare_workers_ai" ? <button className="button button--secondary button--small" onClick={()=>{setSelectedProvider(x.provider_key);setProviderApiKey("");setAttestation(false);setLicenseScope(x.display_name+" API; internal business research only; no redistribution");setError("");}}>配置密钥<ArrowRight size={13}/></button> : <button className="button button--secondary button--small" onClick={() => toast(x.provider_key==="cloudflare_workers_ai"?"Cloudflare Workers AI 不使用供应商 API 密钥；需在 Worker 中配置 AI binding 后才能调用。":role==="admin"?"该数据库连接使用项目级配置，不支持在此录入密钥。":"仅管理员可配置服务端密钥。")}>{x.provider_key==="cloudflare_workers_ai"?"查看绑定状态":"查看状态"}<ArrowRight size={13}/></button>}</div>):filteredDemo.map((x) => <div className={"connector-row"} key={x.name}><span className={"connector-logo connector-logo--"+x.tone}>{x.initials}</span><div className="connector-copy"><div><strong>{x.name}</strong><Badge>{x.category}</Badge></div><p>{x.detail}</p></div><Badge tone={x.state==="已连接"?"green":x.state==="待授权"?"amber":"neutral"}>{x.state}</Badge><button className="button button--secondary button--small" onClick={() => toast(x.name+" 需先确认账户授权、API 权限、价格与数据条款")}>查看状态<ArrowRight size={13}/></button></div>)}</div>}
      {selectedProvider&&<form className="account-form provider-auth-form" onSubmit={(e)=>{e.preventDefault();void saveProviderAuthorization();}}>
        <div className="account-form-heading"><strong>配置 {liveConnectors.find(x=>x.provider_key===selectedProvider)?.display_name || selectedProvider} 凭证</strong><span>密钥将通过已登录的管理员会话发送到后端，并保存至 Supabase Vault。系统不会回显密钥；请勿在共享设备上填写。</span></div>
        <label className="provider-scope-label">API 密钥 / Token *<input type="password" required minLength={8} maxLength={4096} autoComplete="new-password" value={providerApiKey} onChange={e=>setProviderApiKey(e.target.value)} placeholder="在此安全输入供应商密钥" /></label>
        <label className="provider-scope-label">许可与用途范围 *<input required minLength={8} maxLength={1000} value={licenseScope} onChange={e=>setLicenseScope(e.target.value)} /></label>
        <label className="provider-scope-label">数据保留期限（天） *<input type="number" min={1} max={3650} required value={retentionDays} onChange={e=>setRetentionDays(e.target.value)} /></label>
        <label className="provider-attestation"><input type="checkbox" checked={attestation} onChange={e=>setAttestation(e.target.checked)}/><span>我已核验该供应商 API 的商业使用许可、配额、费用和数据保留条款，并确认该密钥仅用于授权用途。</span></label>
        {error&&<p className="auth-error" role="alert">{error}</p>}
        <div className="account-form-actions"><button type="button" className="button button--secondary" onClick={()=>setSelectedProvider(null)}>取消</button><button type="submit" className="button button--primary" disabled={savingProvider||!attestation}>{savingProvider?"安全保存中…":selectedProvider==="serpapi"?"保存密钥并启用 SerpApi":"保存密钥并登记授权"}</button></div>
      </form>}
      <div className="panel-note"><ShieldCheck size={14}/>密钥使用 Supabase Vault 加密存储，数据库目录只保留 Secret 引用；只有管理员可以写入，密钥不会被 API 返回。当前已实现 SerpApi 的真实搜索适配器；其他供应商可以安全保存凭证并记录授权状态，但必须在接入对应服务端适配器后才能执行真实调用。</div></section>
    <section className="panel"><SectionTitle title="连接器接入原则" /><div className="evidence-grid"><div><span className="evidence-mark evidence-mark--green">01</span><strong>许可先行</strong><p>确认 API 权限、数据用途、保留周期和商业使用范围。</p></div><div><span className="evidence-mark evidence-mark--blue">02</span><strong>统一标准</strong><p>映射为标准记录，并保留供应商原始响应和来源时间。</p></div><div><span className="evidence-mark evidence-mark--amber">03</span><strong>成本可控</strong><p>设置缓存、速率限制、预算上限和失败重试策略。</p></div></div></section>
  </>;
}

function Settings({ toast }: { toast: (s: string) => void }) {
  const settings = [
    {title:"工作区与成员",desc:"用户、角色、团队和资源访问范围",icon:Users,state:"基础框架"},
    {title:"安全与权限",desc:"RBAC、服务端密钥、RLS 与敏感操作审批",icon:ShieldCheck,state:"部分实施"},
    {title:"数据治理",desc:"来源许可、保留期限、删除请求与数据质量",icon:Database,state:"待实施"},
    {title:"预算与成本",desc:"供应商额度、月度预算、任务成本和告警",icon:BarChart3,state:"待实施"},
    {title:"审计日志",desc:"登录、数据变更、审批和连接器配置记录",icon:Activity,state:"待实施"},
    {title:"系统健康",desc:"部署版本、队列、失败率和服务状态",icon:Zap,state:"待实施"},
  ];
  return <><div className="settings-grid">{settings.map((s)=><button className="panel settings-card" key={s.title} onClick={() => toast(`${s.title} 设置将在后续版本接入`)}><span className="feature-icon feature-icon--blue"><s.icon size={18}/></span><span className="settings-copy"><strong>{s.title}</strong><small>{s.desc}</small><Badge>{s.state}</Badge></span><ArrowRight size={16} className="muted"/></button>)}</div><div className="demo-disclaimer"><ShieldCheck size={15}/><span>生产环境必须启用认证、最小权限、服务端密钥、数据库 RLS 与完整审计；当前版本不接入真实用户身份。</span></div></>;
}
