create or replace function public.urania_enforce_crm_account_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth, crm
as $$
declare row_data jsonb;
declare account_id_value uuid;
declare contact_id_value uuid;
declare opportunity_id_value uuid;
declare quote_id_value uuid;
declare related_account uuid;
declare quote_owner uuid;
declare owner_value uuid;
declare actor uuid;
declare role_name text;
begin
  row_data := to_jsonb(NEW);
  actor := auth.uid();
  role_name := public.urania_role_from_jwt();
  account_id_value := nullif(row_data->>'account_id','')::uuid;
  contact_id_value := nullif(row_data->>'contact_id','')::uuid;
  opportunity_id_value := nullif(row_data->>'opportunity_id','')::uuid;
  quote_id_value := nullif(row_data->>'quote_id','')::uuid;

  if contact_id_value is not null then
    select c.account_id into related_account from crm.contacts c where c.id=contact_id_value and c.deleted_at is null;
    if related_account is null then raise exception 'contact not found' using errcode='22023'; end if;
    if account_id_value is null then account_id_value:=related_account;
    elsif account_id_value<>related_account then raise exception 'contact and account must match' using errcode='22023'; end if;
  end if;

  if opportunity_id_value is not null then
    select o.account_id into related_account from crm.opportunities o where o.id=opportunity_id_value and o.deleted_at is null;
    if related_account is null then raise exception 'opportunity not found' using errcode='22023'; end if;
    if account_id_value is null then account_id_value:=related_account;
    elsif account_id_value<>related_account then raise exception 'opportunity and account must match' using errcode='22023'; end if;
  end if;

  if TG_TABLE_NAME='orders' and quote_id_value is not null then
    select q.account_id,q.created_by into related_account,quote_owner from crm.quotes q where q.id=quote_id_value;
    if related_account is null then raise exception 'quote not found' using errcode='22023'; end if;
    if account_id_value is null then account_id_value:=related_account;
    elsif account_id_value<>related_account then raise exception 'quote and account must match' using errcode='22023'; end if;
    if role_name='sales' and quote_owner is not null and quote_owner<>actor then raise exception 'forbidden' using errcode='42501'; end if;
  end if;

  if role_name='sales' and account_id_value is not null then
    select a.owner_id into owner_value from crm.accounts a where a.id=account_id_value and a.deleted_at is null;
    if not found then raise exception 'account not found' using errcode='22023'; end if;
    if owner_value is not null and owner_value<>actor then raise exception 'forbidden' using errcode='42501'; end if;
  end if;

  if row_data ? 'account_id' then row_data:=jsonb_set(row_data,'{account_id}',coalesce(to_jsonb(account_id_value),'null'::jsonb),true); end if;
  return jsonb_populate_record(NEW,row_data);
end;
$$;

drop trigger if exists crm_contacts_account_scope on crm.contacts;
create trigger crm_contacts_account_scope before insert or update on crm.contacts for each row execute function public.urania_enforce_crm_account_scope();
drop trigger if exists crm_leads_account_scope on crm.leads;
create trigger crm_leads_account_scope before insert or update on crm.leads for each row execute function public.urania_enforce_crm_account_scope();
drop trigger if exists crm_opportunities_account_scope on crm.opportunities;
create trigger crm_opportunities_account_scope before insert or update on crm.opportunities for each row execute function public.urania_enforce_crm_account_scope();
drop trigger if exists crm_activities_account_scope on crm.activities;
create trigger crm_activities_account_scope before insert or update on crm.activities for each row execute function public.urania_enforce_crm_account_scope();
drop trigger if exists crm_quotes_account_scope on crm.quotes;
create trigger crm_quotes_account_scope before insert or update on crm.quotes for each row execute function public.urania_enforce_crm_account_scope();
drop trigger if exists crm_orders_account_scope on crm.orders;
create trigger crm_orders_account_scope before insert or update on crm.orders for each row execute function public.urania_enforce_crm_account_scope();
revoke all on function public.urania_enforce_crm_account_scope() from public,anon,authenticated;

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
declare actor uuid;
declare created crm.quotes%rowtype;
declare item jsonb;
declare qty integer;
declare price numeric;
declare subtotal_amount numeric:=0;
declare description text;
declare item_count integer:=0;
begin
  actor := public.urania_require_role(array['admin','sales']);
  if p_account_id is null or not exists(select 1 from crm.accounts where id=p_account_id and deleted_at is null) then raise exception 'valid account_id required' using errcode='22023'; end if;
  if p_currency is null or p_currency !~ '^[A-Za-z]{3}$' then raise exception 'currency must be ISO alpha-3' using errcode='22023'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>50 then raise exception 'items must be an array with 1-50 items' using errcode='22023'; end if;
  if coalesce(p_shipping_cost,0)<0 or coalesce(p_tax_cost,0)<0 then raise exception 'shipping and tax cannot be negative' using errcode='22023'; end if;
  if p_opportunity_id is not null and not exists(select 1 from crm.opportunities where id=p_opportunity_id and account_id=p_account_id and deleted_at is null) then raise exception 'opportunity must belong to the same account' using errcode='22023'; end if;
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
    subtotal_amount:=subtotal_amount+round(qty*price,2);
  end loop;
  update crm.quotes q set subtotal=subtotal_amount,total=subtotal_amount+q.shipping_cost+q.tax_cost,updated_at=now() where q.id=created.id returning q.* into created;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'create','crm.quote',created.id::text,jsonb_build_object('quote_number',created.quote_number,'item_count',item_count,'total',created.total,'currency',created.currency));
  return jsonb_build_object('data',jsonb_build_object('id',created.id,'quote_number',created.quote_number,'status',created.status,'currency',created.currency,'subtotal',created.subtotal,'shipping_cost',created.shipping_cost,'tax_cost',created.tax_cost,'total',created.total,'created_at',created.created_at));
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
      and (public.urania_role_from_jwt()<>'sales' or o.created_by=actor)
    order by o.created_at desc limit greatest(1,least(coalesce(p_limit,100),100))
  ) q;
  return jsonb_build_object('data',result,'count',jsonb_array_length(result));
end;
$$;
