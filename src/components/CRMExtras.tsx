import { useEffect, useState, type FormEvent } from "react";
import { Activity, Clipboard, Document, Package, Add, Renew, Security } from "@carbon/react/icons";
import { Button, InlineNotification } from "@carbon/react";
import {
  createActivity, createOrder, createQuote, listAccounts, listActivities, listContacts, listOrders, listQuotes, setQuoteStatus,
  type AccountRecord, type ActivityRecord, type ContactRecord, type OrderRecord, type QuoteRecord
} from "../lib/api";

type Props = { role: string | null; toast: (message: string) => void };

export default function CRMExtras({ role, toast }: Props) {
  const [tab,setTab]=useState<"activities"|"quotes"|"orders">("activities");
  const [accounts,setAccounts]=useState<AccountRecord[]>([]);
  const [contacts,setContacts]=useState<ContactRecord[]>([]);
  const [activities,setActivities]=useState<ActivityRecord[]>([]);
  const [quotes,setQuotes]=useState<QuoteRecord[]>([]);
  const [orders,setOrders]=useState<OrderRecord[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [formOpen,setFormOpen]=useState(false);

  const [activityType,setActivityType]=useState("note");
  const [activitySubject,setActivitySubject]=useState("");
  const [activityAccount,setActivityAccount]=useState("");
  const [activityContact,setActivityContact]=useState("");
  const [activityBody,setActivityBody]=useState("");
  const [activityDue,setActivityDue]=useState("");
  const [activityDirection,setActivityDirection]=useState("internal");

  const [quoteAccount,setQuoteAccount]=useState("");
  const [quoteCurrency,setQuoteCurrency]=useState("USD");
  const [quoteDescription,setQuoteDescription]=useState("");
  const [quoteQuantity,setQuoteQuantity]=useState("1");
  const [quoteUnitPrice,setQuoteUnitPrice]=useState("");
  const [quoteShipping,setQuoteShipping]=useState("0");
  const [quoteTax,setQuoteTax]=useState("0");
  const [quoteValidUntil,setQuoteValidUntil]=useState("");
  const [quoteIncoterm,setQuoteIncoterm]=useState("FOB");
  const [quotePaymentTerms,setQuotePaymentTerms]=useState("30% deposit, balance before shipment");

  const [orderAccount,setOrderAccount]=useState("");
  const [orderQuote,setOrderQuote]=useState("");
  const [orderCurrency,setOrderCurrency]=useState("USD");
  const [orderTotal,setOrderTotal]=useState("");
  const [orderIncoterm,setOrderIncoterm]=useState("FOB");
  const [orderDate,setOrderDate]=useState("");
  const [deliveryDate,setDeliveryDate]=useState("");

  async function reload() {
    if(role!=="admin"&&role!=="sales"){setLoading(false);return;}
    setLoading(true);setError("");
    try{
      const [accountRows,contactRows,activityRows,quoteRows,orderRows]=await Promise.all([
        listAccounts(),listContacts(),listActivities(),listQuotes(),listOrders()
      ]);
      setAccounts(accountRows);setContacts(contactRows);setActivities(activityRows);setQuotes(quoteRows);setOrders(orderRows);
    }catch(e){setError(e instanceof Error?e.message:"无法读取 CRM 活动、报价或订单。");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void reload();},[role]);

  async function saveActivity(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    try{
      await createActivity({activity_type:activityType,subject:activitySubject,account_id:activityAccount||null,contact_id:activityContact||null,body:activityBody||undefined,due_at:activityDue?new Date(activityDue).toISOString():null,direction:activityDirection});
      setActivitySubject("");setActivityBody("");setActivityDue("");setFormOpen(false);toast("活动已记录");await reload();
    }catch(x){setError(x instanceof Error?x.message:"保存活动失败。");}finally{setSaving(false);}
  }
  async function saveQuote(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    try{
      await createQuote({account_id:quoteAccount,currency:quoteCurrency,items:[{description:quoteDescription,quantity:Number(quoteQuantity),unit_price:Number(quoteUnitPrice)}],valid_until:quoteValidUntil||null,incoterm:quoteIncoterm,payment_terms:quotePaymentTerms,shipping_cost:Number(quoteShipping)||0,tax_cost:Number(quoteTax)||0});
      setQuoteDescription("");setQuoteQuantity("1");setQuoteUnitPrice("");setFormOpen(false);toast("报价单已创建");await reload();
    }catch(x){setError(x instanceof Error?x.message:"创建报价失败。");}finally{setSaving(false);}
  }
  async function saveOrder(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    try{
      await createOrder({account_id:orderAccount,quote_id:orderQuote||null,currency:orderCurrency,total:orderQuote?null:Number(orderTotal),incoterm:orderIncoterm,order_date:orderDate||null,delivery_date:deliveryDate||null});
      setOrderQuote("");setOrderTotal("");setFormOpen(false);toast("订单已创建");await reload();
    }catch(x){setError(x instanceof Error?x.message:"创建订单失败。");}finally{setSaving(false);}
  }
  async function changeQuote(id:string,status:string){
    try{await setQuoteStatus(id,status);toast("报价状态已更新");await reload();}
    catch(x){setError(x instanceof Error?x.message:"更新报价状态失败。");}
  }

  if(role!=="admin"&&role!=="sales") return null;
  const createLabel=tab==="activities"?"记录活动":tab==="quotes"?"创建报价":"创建订单";
  return <section className="panel crm-extras">
    <div className="crm-toolbar"><div><h3 className="panel-title">销售执行</h3><p className="panel-subtitle">活动记录、报价审批和订单交付；本页不会发送邮件或付款。</p></div><div className="summary-actions"><Button kind="secondary" className="button button--secondary" onClick={()=>void reload()}><Renew size={14}/>刷新</Button><Button kind="primary" className="button button--primary" onClick={()=>setFormOpen(v=>!v)}><Add size={15}/>{formOpen?"关闭表单":createLabel}</Button></div></div>
    <div className="crm-tabs"><Button className={tab==="activities"?"crm-tab crm-tab--active":"crm-tab"} onClick={()=>{setTab("activities");setFormOpen(false)}}><Activity size={13}/>活动 <span>{activities.length}</span></Button><Button className={tab==="quotes"?"crm-tab crm-tab--active":"crm-tab"} onClick={()=>{setTab("quotes");setFormOpen(false)}}><Document size={13}/>报价 <span>{quotes.length}</span></Button><Button className={tab==="orders"?"crm-tab crm-tab--active":"crm-tab"} onClick={()=>{setTab("orders");setFormOpen(false)}}><Package size={13}/>订单 <span>{orders.length}</span></Button></div>
    {formOpen&&tab==="activities"&&<form className="account-form" onSubmit={saveActivity}><div className="account-form-heading"><strong>记录活动 / 任务</strong><span>邮件活动仅作为 CRM 日志，不会自动发送。</span></div><div className="account-form-grid"><label>活动类型<select value={activityType} onChange={e=>setActivityType(e.target.value)}><option value="note">备注</option><option value="call">电话</option><option value="meeting">会议</option><option value="email">邮件记录</option><option value="task">任务</option></select></label><label>主题 *<input required minLength={2} maxLength={240} value={activitySubject} onChange={e=>setActivitySubject(e.target.value)}/></label><label>关联企业<select value={activityAccount} onChange={e=>setActivityAccount(e.target.value)}><option value="">无</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.company_name}</option>)}</select></label><label>联系人<select value={activityContact} onChange={e=>setActivityContact(e.target.value)}><option value="">无</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label><label>方向<select value={activityDirection} onChange={e=>setActivityDirection(e.target.value)}><option value="internal">内部</option><option value="inbound">收到</option><option value="outbound">发出</option></select></label><label>截止时间<input type="datetime-local" value={activityDue} onChange={e=>setActivityDue(e.target.value)}/></label></div><label className="provider-scope-label">备注<textarea rows={3} value={activityBody} onChange={e=>setActivityBody(e.target.value)}/></label><div className="account-form-actions"><Button type="button" kind="secondary" className="button button--secondary" onClick={()=>setFormOpen(false)}>取消</Button><Button type="submit" kind="primary" className="button button--primary" disabled={saving}>{saving?"保存中…":"保存活动"}</Button></div></form>}
    {formOpen&&tab==="quotes"&&<form className="account-form" onSubmit={saveQuote}><div className="account-form-heading"><strong>创建报价单</strong><span>首版支持单条明细；金额由数据库计算并写入审计日志。</span></div><div className="account-form-grid"><label>客户企业 *<select required value={quoteAccount} onChange={e=>setQuoteAccount(e.target.value)}><option value="">选择企业…</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.company_name}</option>)}</select></label><label>明细描述 *<input required minLength={2} maxLength={1000} value={quoteDescription} onChange={e=>setQuoteDescription(e.target.value)}/></label><label>数量 *<input type="number" min="1" max="10000000" required value={quoteQuantity} onChange={e=>setQuoteQuantity(e.target.value)}/></label><label>单价 *<input type="number" min="0" step="0.0001" required value={quoteUnitPrice} onChange={e=>setQuoteUnitPrice(e.target.value)}/></label><label>币种<select value={quoteCurrency} onChange={e=>setQuoteCurrency(e.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>CNY</option><option>PLN</option></select></label><label>运费<input type="number" min="0" step="0.01" value={quoteShipping} onChange={e=>setQuoteShipping(e.target.value)}/></label><label>税费<input type="number" min="0" step="0.01" value={quoteTax} onChange={e=>setQuoteTax(e.target.value)}/></label><label>有效期<input type="date" value={quoteValidUntil} onChange={e=>setQuoteValidUntil(e.target.value)}/></label><label>Incoterm<input value={quoteIncoterm} onChange={e=>setQuoteIncoterm(e.target.value)}/></label><label>付款条款<input value={quotePaymentTerms} onChange={e=>setQuotePaymentTerms(e.target.value)}/></label></div><div className="account-form-actions"><Button type="button" kind="secondary" className="button button--secondary" onClick={()=>setFormOpen(false)}>取消</Button><Button type="submit" kind="primary" className="button button--primary" disabled={saving}>{saving?"保存中…":"创建报价"}</Button></div></form>}
    {formOpen&&tab==="orders"&&<form className="account-form" onSubmit={saveOrder}><div className="account-form-heading"><strong>创建订单</strong><span>关联报价时只允许使用同一客户的已接受报价。</span></div><div className="account-form-grid"><label>客户企业 *<select required value={orderAccount} onChange={e=>{setOrderAccount(e.target.value);setOrderQuote("")}}><option value="">选择企业…</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.company_name}</option>)}</select></label><label>已接受报价<select value={orderQuote} onChange={e=>setOrderQuote(e.target.value)}><option value="">无报价（手动金额）</option>{quotes.filter(q=>q.account_id===orderAccount&&q.status==="accepted").map(q=><option key={q.id} value={q.id}>{q.quote_number} · {q.currency} {q.total}</option>)}</select></label>{!orderQuote&&<><label>币种<select value={orderCurrency} onChange={e=>setOrderCurrency(e.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>CNY</option><option>PLN</option></select></label><label>订单总额 *<input type="number" min="0" step="0.01" required value={orderTotal} onChange={e=>setOrderTotal(e.target.value)}/></label></>}<label>Incoterm<input value={orderIncoterm} onChange={e=>setOrderIncoterm(e.target.value)}/></label><label>订单日期<input type="date" value={orderDate} onChange={e=>setOrderDate(e.target.value)}/></label><label>预计交付日期<input type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)}/></label></div><div className="account-form-actions"><Button type="button" kind="secondary" className="button button--secondary" onClick={()=>setFormOpen(false)}>取消</Button><Button type="submit" kind="primary" className="button button--primary" disabled={saving}>{saving?"保存中…":"创建订单"}</Button></div></form>}
    {error&&<InlineNotification kind="error" lowContrast title="销售执行操作失败" subtitle={error} actionButtonLabel="重试" onActionButtonClick={()=>void reload()} hideCloseButton/>}
    {loading?<div className="empty-state"><Activity size={24}/><strong>正在读取销售执行数据…</strong></div>:tab==="activities"?<div className="table-wrap"><table><thead><tr><th>活动</th><th>企业</th><th>联系人 / 商机</th><th>方向</th><th>截止时间</th></tr></thead><tbody>{activities.map(x=><tr key={x.id}><td><strong>{x.subject}</strong><small className="table-secondary">{x.activity_type}</small></td><td>{x.company_name||"—"}</td><td>{x.contact_name||x.opportunity_name||"—"}</td><td>{x.direction||"—"}</td><td>{x.due_at?new Date(x.due_at).toLocaleString():"—"}</td></tr>)}</tbody></table>{activities.length===0&&<div className="empty-state"><Clipboard size={24}/><strong>暂无活动记录</strong></div>}</div>:tab==="quotes"?<div className="table-wrap"><table><thead><tr><th>报价编号</th><th>客户</th><th>状态</th><th>总额</th><th>有效期</th><th>更新状态</th></tr></thead><tbody>{quotes.map(q=><tr key={q.id}><td><strong>{q.quote_number}</strong></td><td>{q.company_name}</td><td>{q.status}</td><td>{new Intl.NumberFormat("en-US",{style:"currency",currency:q.currency||"USD"}).format(Number(q.total))}</td><td>{q.valid_until||"—"}</td><td><select value={q.status} onChange={e=>void changeQuote(q.id,e.target.value)} aria-label={"更新报价 "+q.quote_number}>{(role==="admin"?["draft","in_review","approved","sent","accepted","rejected","expired"]:[q.status,...(({draft:["in_review"],in_review:["approved","rejected"],approved:["sent"],sent:["accepted","rejected","expired"]} as Record<string,string[]>)[q.status]||[])]).map(status=><option key={status} value={status}>{({draft:"草稿",in_review:"审核中",approved:"已批准",sent:"已发送",accepted:"已接受",rejected:"已拒绝",expired:"已过期"} as Record<string,string>)[status]||status}</option>)}</select></td></tr>)}</tbody></table>{quotes.length===0&&<div className="empty-state"><Document size={24}/><strong>暂无报价单</strong></div>}</div>:<div className="table-wrap"><table><thead><tr><th>订单编号</th><th>客户</th><th>状态</th><th>总额</th><th>付款状态</th><th>预计交付</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><strong>{o.order_number}</strong></td><td>{o.company_name}</td><td>{o.status}</td><td>{new Intl.NumberFormat("en-US",{style:"currency",currency:o.currency||"USD"}).format(Number(o.total))}</td><td>{o.payment_status}</td><td>{o.delivery_date||"—"}</td></tr>)}</tbody></table>{orders.length===0&&<div className="empty-state"><Package size={24}/><strong>暂无订单</strong></div>}</div>}
    <div className="panel-note"><Security size={14}/>活动只记录业务沟通，不会自动发送邮件；报价金额由数据库计算；订单关联报价时必须先接受报价。</div>
  </section>;
}
