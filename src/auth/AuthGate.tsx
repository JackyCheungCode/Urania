import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, Locked, Security, Idea } from "@carbon/react/icons";
import { Button, InlineNotification, PasswordInput, TextInput } from "@carbon/react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setChecking(false);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !session) { setRole(null); setRoleLoading(false); return; }
    let alive = true;
    setRoleLoading(true);
    supabase.auth.getUser().then(({ data, error: userError }) => {
      if (!alive) return;
      if (userError) setError(userError.message);
      setRole((data.user?.app_metadata?.urania_role as string | undefined) ?? null);
      setRoleLoading(false);
    });
    return () => { alive = false; };
  }, [session]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setInfo("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError(signInError.message);
    setBusy(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }

  if (!isSupabaseConfigured) {
    return <div className="auth-shell"><section className="auth-card">
      <div className="auth-brand"><span className="brand-mark"><Idea size={20}/></span><div><strong>urania<span>.</span></strong><small>GLOBAL INTELLIGENCE</small></div></div>
      <div className="auth-symbol"><Locked size={24}/></div>
      <p className="eyebrow">SECURE WORKSPACE SETUP</p><h1>先配置安全登录</h1>
      <p className="auth-description">当前环境尚未配置 Supabase 公共项目参数。为避免在没有身份验证的情况下暴露 CRM 数据，工作区已锁定。</p>
      <div className="setup-steps"><div><b>1</b><span>复制 <code>.env.example</code> 为 <code>.env.local</code></span></div><div><b>2</b><span>填入 Supabase Project URL 和 Publishable Key</span></div><div><b>3</b><span>在 Supabase Auth 中创建用户，并由管理员设置 <code>app_metadata.urania_role</code></span></div></div>
      <div className="auth-security"><Security size={16}/>服务角色密钥绝不能放入前端环境变量。</div>
    </section></div>;
  }

  if (checking) return <div className="auth-shell"><div className="auth-card auth-loading">正在验证安全会话…</div></div>;
  if (!session) return <div className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><span className="brand-mark"><Idea size={20}/></span><div><strong>urania<span>.</span></strong><small>GLOBAL INTELLIGENCE</small></div></div>
    <div className="auth-symbol"><Locked size={24}/></div><p className="eyebrow">PRIVATE WORKSPACE</p><h1>登录 Urania</h1>
    <p className="auth-description">使用工作区账号登录。只有经管理员授予角色的用户才能访问业务数据。</p>
    <form className="auth-form" onSubmit={signIn}><TextInput id="auth-email" labelText="工作邮箱" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/><PasswordInput id="auth-password" labelText="密码" autoComplete="current-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少 8 位"/>
    {error && <InlineNotification kind="error" lowContrast title="登录失败" subtitle={error} hideCloseButton/>}{info && <InlineNotification kind="info" lowContrast title="访问帮助" subtitle={info} hideCloseButton/>}
    <Button className="auth-submit" type="submit" disabled={busy}>{busy?"正在登录…":"安全登录"}<ArrowRight size={16}/></Button></form>
    <div className="auth-security"><Security size={16}/>启用服务端角色校验 · 不支持公开注册</div>
    <Button kind="ghost" className="auth-help" onClick={()=>setInfo("请联系 Urania 工作区管理员创建账号并分配角色。")}>需要访问权限？</Button>
  </section></div>;

  if (roleLoading) return <div className="auth-shell"><div className="auth-card auth-loading">正在验证工作区角色…</div></div>;
  if (!role || !["admin", "researcher", "sales"].includes(role)) return <div className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><span className="brand-mark"><Idea size={20}/></span><div><strong>urania<span>.</span></strong><small>GLOBAL INTELLIGENCE</small></div></div>
    <div className="auth-symbol"><Security size={24}/></div><p className="eyebrow">ACCESS CONTROL</p><h1>等待工作区授权</h1>
    <p className="auth-description">当前账号已登录，但尚未获得 Urania 的有效工作区角色。为保护 CRM 和数据源配置，系统不会加载业务页面。</p>
    <div className="auth-security"><Security size={16}/>请管理员通过 Supabase Auth 管理接口设置 <code>app_metadata.urania_role</code> 为 admin、researcher 或 sales。</div>
    <Button kind="secondary" className="auth-submit" onClick={signOut}>安全退出</Button>
  </section></div>;
  return <>{children}<Button kind="ghost" className="auth-session-control" onClick={signOut} title="安全退出">已登录 · 退出</Button></>;
}
