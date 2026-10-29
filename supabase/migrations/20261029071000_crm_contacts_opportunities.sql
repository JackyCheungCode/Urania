create or replace function public.urania_list_contacts(p_search text default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, crm
as $$
declare actor uuid;
declare result jsonb;
begin
  actor := public.urania_require_role(array['admin','sales']);
  select coalesce(jsonb_agg(to_jsonb(q) order by q.updated_at desc), '[]'::jsonb)
  into result
  from (
    select c.id,c.account_id,c.full_name,c.job_title,c.work_email,c.phone,c.profile_url,c.country_code,
           c.verification_status,c.lawful_basis,c.consent_status,c.do_not_contact,c.last_verified_at,
           c.created_at,c.updated_at,a.company_name
    from crm.contacts c
    join crm.accounts a on a.id=c.account_id
    where c.deleted_at is null and a.deleted_at is null
      and (p_search is null or btrim(p_search)='' or c.full_name ilike '%'||left(btrim(p_search),100)||'%' or c.work_email ilike '%'||left(btrim(p_search),100)||'%' or a.company_name ilike '%'||left(btrim(p_search),100)||'%')
      and (public.urania_role_from_jwt() <> 'sales' or c.owner_id=actor or c.owner_id is null)
    order by c.updated_at desc
    limit greatest(1,least(coalesce(p_limit,50),100))
  ) q;
  return jsonb_build_object('data',result,'count',jsonb_array_length(result));
end;
$$;

create or replace function public.urania_create_contact(
  p_account_id uuid,
  p_full_name text,
  p_job_title text default null,
  p_work_email text default null,
  p_phone text default null,
  p_profile_url text default null,
  p_country_code text default null,
  p_lawful_basis text default null,
  p_do_not_contact boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, crm, audit
as $$
declare actor uuid;
declare created crm.contacts%rowtype;
begin
  actor := public.urania_require_role(array['admin','sales']);
  if p_account_id is null or not exists(select 1 from crm.accounts where id=p_account_id and deleted_at is null) then
    raise exception 'valid account_id is required' using errcode='22023';
  end if;
  if p_full_name is null or length(btrim(p_full_name)) < 2 or length(p_full_name)>200 then
    raise exception 'full_name must be between 2 and 200 characters' using errcode='22023';
  end if;
  if p_work_email is not null and (length(p_work_email)>320 or p_work_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$') then
    raise exception 'invalid work email' using errcode='22023';
  end if;
  if p_profile_url is not null and p_profile_url !~ '^https?://' then
    raise exception 'profile_url must be an http(s) URL' using errcode='22023';
  end if;
  if p_country_code is not null and p_country_code !~ '^[A-Za-z]{2}$' then
    raise exception 'country_code must be ISO alpha-2' using errcode='22023';
  end if;
  if p_lawful_basis is null or length(btrim(p_lawful_basis))<3 or length(p_lawful_basis)>200 then
    raise exception 'lawful_basis is required for contact data' using errcode='22023';
  end if;
  insert into crm.contacts(account_id,full_name,job_title,work_email,phone,profile_url,country_code,lawful_basis,do_not_contact,owner_id,created_by)
  values(p_account_id,btrim(p_full_name),nullif(btrim(p_job_title),''),lower(nullif(btrim(p_work_email),'')),nullif(btrim(p_phone),''),nullif(btrim(p_profile_url),''),upper(p_country_code),btrim(p_lawful_basis),coalesce(p_do_not_contact,false),actor,actor)
  returning * into created;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'create','crm.contact',created.id::text,jsonb_build_object('account_id',created.account_id,'do_not_contact',created.do_not_contact,'lawful_basis',created.lawful_basis));
  return jsonb_build_object('data',jsonb_build_object('id',created.id,'account_id',created.account_id,'full_name',created.full_name,'job_title',created.job_title,'work_email',created.work_email,'do_not_contact',created.do_not_contact,'created_at',created.created_at));
end;
$$;

create or replace function public.urania_list_opportunities(p_search text default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, crm
as $$
declare actor uuid;
declare result jsonb;
begin
  actor := public.urania_require_role(array['admin','sales']);
  select coalesce(jsonb_agg(to_jsonb(q) order by q.updated_at desc), '[]'::jsonb)
  into result
  from (
    select o.id,o.account_id,o.name,o.stage,o.amount,o.currency,o.probability,o.expected_close_date,o.owner_id,o.lost_reason,o.created_at,o.updated_at,a.company_name
    from crm.opportunities o join crm.accounts a on a.id=o.account_id
    where o.deleted_at is null and a.deleted_at is null
      and (p_search is null or btrim(p_search)='' or o.name ilike '%'||left(btrim(p_search),100)||'%' or a.company_name ilike '%'||left(btrim(p_search),100)||'%')
      and (public.urania_role_from_jwt() <> 'sales' or o.owner_id=actor or o.owner_id is null)
    order by o.updated_at desc
    limit greatest(1,least(coalesce(p_limit,50),100))
  ) q;
  return jsonb_build_object('data',result,'count',jsonb_array_length(result));
end;
$$;

create or replace function public.urania_create_opportunity(
  p_account_id uuid,
  p_name text,
  p_amount numeric default null,
  p_currency text default 'USD',
  p_probability numeric default 0.1,
  p_expected_close_date date default null,
  p_stage text default 'qualification'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, crm, audit
as $$
declare actor uuid;
declare created crm.opportunities%rowtype;
begin
  actor := public.urania_require_role(array['admin','sales']);
  if p_account_id is null or not exists(select 1 from crm.accounts where id=p_account_id and deleted_at is null) then
    raise exception 'valid account_id is required' using errcode='22023';
  end if;
  if p_name is null or length(btrim(p_name))<2 or length(p_name)>240 then
    raise exception 'opportunity name must be between 2 and 240 characters' using errcode='22023';
  end if;
  if p_amount is not null and p_amount<0 then raise exception 'amount cannot be negative' using errcode='22023'; end if;
  if p_currency is null or p_currency !~ '^[A-Za-z]{3}$' then raise exception 'currency must be ISO alpha-3' using errcode='22023'; end if;
  if p_probability is null or p_probability<0 or p_probability>1 then raise exception 'probability must be between 0 and 1' using errcode='22023'; end if;
  if p_stage not in ('qualification','discovery','proposal','negotiation','won','lost') then raise exception 'invalid stage' using errcode='22023'; end if;
  insert into crm.opportunities(account_id,name,stage,amount,currency,probability,expected_close_date,owner_id,created_by)
  values(p_account_id,btrim(p_name),p_stage,p_amount,upper(p_currency),p_probability,p_expected_close_date,actor,actor)
  returning * into created;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'create','crm.opportunity',created.id::text,jsonb_build_object('account_id',created.account_id,'stage',created.stage,'amount',created.amount,'currency',created.currency));
  return jsonb_build_object('data',jsonb_build_object('id',created.id,'account_id',created.account_id,'name',created.name,'stage',created.stage,'amount',created.amount,'currency',created.currency,'probability',created.probability,'expected_close_date',created.expected_close_date,'created_at',created.created_at));
end;
$$;

revoke all on function public.urania_list_contacts(text,integer) from public, anon;
revoke all on function public.urania_create_contact(uuid,text,text,text,text,text,text,text,boolean) from public, anon;
revoke all on function public.urania_list_opportunities(text,integer) from public, anon;
revoke all on function public.urania_create_opportunity(uuid,text,numeric,text,numeric,date,text) from public, anon;
grant execute on function public.urania_list_contacts(text,integer) to authenticated;
grant execute on function public.urania_create_contact(uuid,text,text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.urania_list_opportunities(text,integer) to authenticated;
grant execute on function public.urania_create_opportunity(uuid,text,numeric,text,numeric,date,text) to authenticated;
