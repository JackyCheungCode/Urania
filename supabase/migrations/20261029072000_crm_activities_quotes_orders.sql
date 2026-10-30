create or replace function public.urania_list_activities(p_search text default null, p_limit integer default 100)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, auth, crm
as $$
declare actor uuid; declare result jsonb;
begin
  actor := public.urania_require_role(array['admin','sales']);
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into result
  from (
    select x.id,x.account_id,x.contact_id,x.opportunity_id,x.activity_type,x.subject,x.body,x.due_at,x.completed_at,x.direction,x.created_by,x.created_at,
      a.company_name,c.full_name as contact_name,o.name as opportunity_name
    from crm.activities x
    left join crm.accounts a on a.id=x.account_id
    left join crm.contacts c on c.id=x.contact_id
    left join crm.opportunities o on o.id=x.opportunity_id
    where (p_search is null or btrim(p_search)='' or x.subject ilike '%'||left(btrim(p_search),100)||'%' or coalesce(a.company_name,'') ilike '%'||left(btrim(p_search),100)||'%')
      and (public.urania_role_from_jwt()<>'sales' or x.created_by=actor)
    order by x.created_at desc limit greatest(1,least(coalesce(p_limit,100),100))
  ) q;
  return jsonb_build_object('data',result,'count',jsonb_array_length(result));
end;
$$;

create or replace function public.urania_create_activity(
  p_activity_type text,
  p_subject text,
  p_account_id uuid default null,
  p_contact_id uuid default null,
  p_opportunity_id uuid default null,
  p_body text default null,
  p_due_at timestamptz default null,
  p_direction text default 'internal'
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth, crm, audit
as $$
declare actor uuid; declare created crm.activities%rowtype;
begin
  actor := public.urania_require_role(array['admin','sales']);
  if p_activity_type not in ('note','call','meeting','email','task','status_change','other') then raise exception 'invalid activity_type' using errcode='22023'; end if;
  if p_subject is null or length(btrim(p_subject))<2 or length(p_subject)>240 then raise exception 'subject must be between 2 and 240 characters' using errcode='22023'; end if;
  if p_direction not in ('inbound','outbound','internal') then raise exception 'invalid direction' using errcode='22023'; end if;
  if p_body is not null and length(p_body)>10000 then raise exception 'body too long' using errcode='22023'; end if;
  if p_account_id is not null and not exists(select 1 from crm.accounts where id=p_account_id and deleted_at is null) then raise exception 'account not found' using errcode='22023'; end if;
  if p_contact_id is not null and not exists(select 1 from crm.contacts where id=p_contact_id and deleted_at is null) then raise exception 'contact not found' using errcode='22023'; end if;
  if p_opportunity_id is not null and not exists(select 1 from crm.opportunities where id=p_opportunity_id and deleted_at is null) then raise exception 'opportunity not found' using errcode='22023'; end if;
  insert into crm.activities(account_id,contact_id,opportunity_id,activity_type,subject,body,due_at,direction,created_by)
  values(p_account_id,p_contact_id,p_opportunity_id,p_activity_type,btrim(p_subject),nullif(btrim(p_body),''),p_due_at,p_direction,actor)
  returning * into created;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'create','crm.activity',created.id::text,jsonb_build_object('activity_type',created.activity_type,'subject',created.subject,'direction',created.direction));
  return jsonb_build_object('data',jsonb_build_object('id',created.id,'activity_type',created.activity_type,'subject',created.subject,'account_id',created.account_id,'due_at',created.due_at,'created_at',created.created_at));
end;
$$;

create or replace function public.urania_list_quotes(p_search text default null, p_limit integer default 100)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, auth, crm
as $$
declare actor uuid; declare result jsonb;
begin
  actor := public.urania_require_role(array['admin','sales']);
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into result
  from (
    select q.id,q.account_id,q.opportunity_id,q.quote_number,q.version,q.status,q.currency,q.valid_until,q.incoterm,q.payment_terms,q.subtotal,q.shipping_cost,q.tax_cost,q.total,q.created_at,a.company_name
    from crm.quotes q join crm.accounts a on a.id=q.account_id
    where (p_search is null or btrim(p_search)='' or q.quote_number ilike '%'||left(btrim(p_search),100)||'%' or a.company_name ilike '%'||left(btrim(p_search),100)||'%')
      and (public.urania_role_from_jwt()<>'sales' or q.created_by=actor)
    order by q.created_at desc limit greatest(1,least(coalesce(p_limit,100),100))
  ) q;
  return jsonb_build_object('data',result,'count',jsonb_array_length(result));
end;
$$;

create or replace function public.urania_create_quote(
  p_account_id uuid,
  p_currency text,
  p_items jsonb,
  p_opportunity_id uuid default null,
  p_valid_until date default null,
  p_incoterm text default null,
  p_payment_terms text default null,
  p_shipping_cost numeric default 0,
  p_tax_cost numeric default 0
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth, crm, audit
as $$
declare actor uuid; declare created crm.quotes%rowtype; declare item jsonb; declare qty integer; declare price numeric; declare subtotal numeric:=0; declare description text; declare item_count integer:=0;
begin
  actor := public.urania_require_role(array['admin','sales']);
  if p_account_id is null or not exists(select 1 from crm.accounts where id=p_account_id and deleted_at is null) then raise exception 'valid account_id required' using errcode='22023'; end if;
  if p_currency is null or p_currency !~ '^[A-Za-z]{3}$' then raise exception 'currency must be ISO alpha-3' using errcode='22023'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>50 then raise exception 'items must be an array with 1-50 items' using errcode='22023'; end if;
  if coalesce(p_shipping_cost,0)<0 or coalesce(p_tax_cost,0)<0 then raise exception 'shipping and tax cannot be negative' using errcode='22023'; end if;
  insert into crm.quotes(account_id,opportunity_id,quote_number,currency,valid_until,incoterm,payment_terms,shipping_cost,tax_cost,created_by)
  values(p_account_id,p_opportunity_id,'URQ-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),upper(p_currency),p_valid_until,nullif(btrim(p_incoterm),''),nullif(btrim(p_payment_terms),''),coalesce(p_shipping_cost,0),coalesce(p_tax_cost,0),actor)
  returning * into created;
  for item in select value from jsonb_array_elements(p_items) as i(value) loop
    item_count:=item_count+1;
    description:=nullif(btrim(item->>'description'),'');
    qty:=nullif(item->>'quantity','')::integer;
    price:=nullif(item->>'unit_price','')::numeric;
    if description is null or length(description)>1000 or qty is null or qty<1 or qty>10000000 or price is null or price<0 then raise exception 'invalid quote item at index %',item_count using errcode='22023'; end if;
    insert into crm.quote_items(quote_id,description,quantity,unit_price,currency,line_total)
    values(created.id,description,qty,price,upper(p_currency),round(qty*price,2));
    subtotal:=subtotal+round(qty*price,2);
  end loop;
  update crm.quotes set subtotal=subtotal,total=subtotal+shipping_cost+tax_cost,updated_at=now() where id=created.id returning * into created;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'create','crm.quote',created.id::text,jsonb_build_object('quote_number',created.quote_number,'item_count',item_count,'total',created.total,'currency',created.currency));
  return jsonb_build_object('data',jsonb_build_object('id',created.id,'quote_number',created.quote_number,'status',created.status,'currency',created.currency,'subtotal',created.subtotal,'shipping_cost',created.shipping_cost,'tax_cost',created.tax_cost,'total',created.total,'created_at',created.created_at));
end;
$$;

create or replace function public.urania_set_quote_status(p_quote_id uuid,p_status text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth, crm, audit
as $$
declare actor uuid; declare previous crm.quotes%rowtype; declare updated crm.quotes%rowtype;
begin
  actor:=public.urania_require_role(array['admin','sales']);
  if p_status not in ('draft','in_review','approved','sent','accepted','rejected','expired') then raise exception 'invalid quote status' using errcode='22023'; end if;
  select * into previous from crm.quotes where id=p_quote_id for update;
  if previous.id is null then raise exception 'quote not found' using errcode='P0002'; end if;
  update crm.quotes set status=p_status,updated_at=now() where id=p_quote_id returning * into updated;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'quote_status_change','crm.quote',updated.id::text,jsonb_build_object('from',previous.status,'to',updated.status));
  return jsonb_build_object('data',jsonb_build_object('id',updated.id,'quote_number',updated.quote_number,'status',updated.status));
end;
$$;

create or replace function public.urania_list_orders(p_search text default null,p_limit integer default 100)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, auth, crm
as $$
declare actor uuid; declare result jsonb;
begin
  actor:=public.urania_require_role(array['admin','sales']);
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into result
  from (
    select o.id,o.account_id,o.quote_id,o.order_number,o.status,o.currency,o.total,o.incoterm,o.payment_status,o.order_date,o.delivery_date,o.created_at,a.company_name
    from crm.orders o join crm.accounts a on a.id=o.account_id
    where (p_search is null or btrim(p_search)='' or o.order_number ilike '%'||left(btrim(p_search),100)||'%' or a.company_name ilike '%'||left(btrim(p_search),100)||'%')
    order by o.created_at desc limit greatest(1,least(coalesce(p_limit,100),100))
  ) q;
  return jsonb_build_object('data',result,'count',jsonb_array_length(result));
end;
$$;

create or replace function public.urania_create_order(
  p_account_id uuid,
  p_currency text default 'USD',
  p_total numeric default null,
  p_quote_id uuid default null,
  p_incoterm text default null,
  p_order_date date default null,
  p_delivery_date date default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth, crm, audit
as $$
declare actor uuid; declare quote_row crm.quotes%rowtype; declare created crm.orders%rowtype; declare order_currency text; declare order_total numeric;
begin
  actor:=public.urania_require_role(array['admin','sales']);
  if p_account_id is null or not exists(select 1 from crm.accounts where id=p_account_id and deleted_at is null) then raise exception 'valid account_id required' using errcode='22023'; end if;
  if p_quote_id is not null then
    select * into quote_row from crm.quotes where id=p_quote_id for update;
    if quote_row.id is null or quote_row.account_id<>p_account_id or quote_row.status<>'accepted' then raise exception 'order requires an accepted quote for the same account' using errcode='22023'; end if;
    order_currency:=quote_row.currency; order_total:=quote_row.total;
  else
    if p_currency is null or p_currency !~ '^[A-Za-z]{3}$' or p_total is null or p_total<0 then raise exception 'valid currency and non-negative total required without quote' using errcode='22023'; end if;
    order_currency:=upper(p_currency); order_total:=p_total;
  end if;
  insert into crm.orders(account_id,quote_id,order_number,status,currency,total,incoterm,order_date,delivery_date,created_by)
  values(p_account_id,p_quote_id,'URO-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),'draft',order_currency,order_total,nullif(btrim(p_incoterm),''),p_order_date,p_delivery_date,actor)
  returning * into created;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'create','crm.order',created.id::text,jsonb_build_object('order_number',created.order_number,'total',created.total,'currency',created.currency,'quote_id',created.quote_id));
  return jsonb_build_object('data',jsonb_build_object('id',created.id,'order_number',created.order_number,'status',created.status,'currency',created.currency,'total',created.total,'payment_status',created.payment_status,'created_at',created.created_at));
end;
$$;

revoke all on function public.urania_list_activities(text,integer) from public, anon;
revoke all on function public.urania_create_activity(text,text,uuid,uuid,uuid,text,timestamptz,text) from public, anon;
revoke all on function public.urania_list_quotes(text,integer) from public, anon;
revoke all on function public.urania_create_quote(uuid,text,jsonb,uuid,date,text,text,numeric,numeric) from public, anon;
revoke all on function public.urania_set_quote_status(uuid,text) from public, anon;
revoke all on function public.urania_list_orders(text,integer) from public, anon;
revoke all on function public.urania_create_order(uuid,text,numeric,uuid,text,date,date) from public, anon;
grant execute on function public.urania_list_activities(text,integer) to authenticated;
grant execute on function public.urania_create_activity(text,text,uuid,uuid,uuid,text,timestamptz,text) to authenticated;
grant execute on function public.urania_list_quotes(text,integer) to authenticated;
grant execute on function public.urania_create_quote(uuid,text,jsonb,uuid,date,text,text,numeric,numeric) to authenticated;
grant execute on function public.urania_set_quote_status(uuid,text) to authenticated;
grant execute on function public.urania_list_orders(text,integer) to authenticated;
grant execute on function public.urania_create_order(uuid,text,numeric,uuid,text,date,date) to authenticated;
