-- Secure RPC layer for the Urania internal application.
-- Access is restricted to authenticated users with server-managed app_metadata.urania_role.
-- Do not set urania_role in user_metadata; it is user-editable.

create or replace function public.urania_require_role(allowed_roles text[])
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor uuid;
  role_name text;
begin
  actor := auth.uid();
  role_name := auth.jwt() -> 'app_metadata' ->> 'urania_role';
  if actor is null or role_name is null or not (role_name = any(allowed_roles)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return actor;
end;
$$;

create or replace function public.urania_list_accounts(p_search text default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, crm
as $$
declare actor uuid;
declare result jsonb;
begin
  actor := public.urania_require_role(array['admin','sales','researcher']);
  select coalesce(jsonb_agg(to_jsonb(q) order by q.updated_at desc), '[]'::jsonb)
  into result
  from (
    select id, company_name, website_url, domain, country_code, region, industry,
           account_type, lifecycle_stage, verification_status, owner_id, created_at, updated_at
    from crm.accounts
    where deleted_at is null
      and (p_search is null or btrim(p_search) = '' or
           company_name ilike '%' || left(btrim(p_search), 100) || '%' or
           coalesce(domain,'') ilike '%' || left(btrim(p_search), 100) || '%')
      and (public.urania_role_from_jwt() <> 'sales' or owner_id = actor or owner_id is null)
    order by updated_at desc
    limit greatest(1, least(coalesce(p_limit,50),100))
  ) q;
  return jsonb_build_object('data', result, 'count', jsonb_array_length(result));
end;
$$;

create or replace function public.urania_role_from_jwt()
returns text
language sql
stable
security invoker
set search_path = pg_catalog, auth
as $$
  select auth.jwt() -> 'app_metadata' ->> 'urania_role';
$$;

create or replace function public.urania_create_account(
  p_company_name text,
  p_website_url text default null,
  p_country_code text default null,
  p_industry text default null,
  p_account_type text default 'unknown',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, crm, audit
as $$
declare actor uuid;
declare created crm.accounts%rowtype;
begin
  actor := public.urania_require_role(array['admin','sales']);
  if p_company_name is null or length(btrim(p_company_name)) < 2 or length(p_company_name) > 200 then
    raise exception 'company_name must be between 2 and 200 characters' using errcode = '22023';
  end if;
  if p_website_url is not null and p_website_url !~ '^https?://' then
    raise exception 'website_url must be an http(s) URL' using errcode = '22023';
  end if;
  if p_country_code is not null and p_country_code !~ '^[A-Za-z]{2}$' then
    raise exception 'country_code must be ISO alpha-2' using errcode = '22023';
  end if;
  if p_account_type not in ('importer','distributor','retailer','brand','manufacturer','wholesaler','service_provider','unknown') then
    raise exception 'invalid account_type' using errcode = '22023';
  end if;

  insert into crm.accounts(company_name, normalized_name, website_url, domain, country_code, industry, account_type, notes, owner_id, created_by)
  values (
    btrim(p_company_name),
    lower(regexp_replace(btrim(p_company_name), '\s+', ' ', 'g')),
    nullif(btrim(p_website_url),''),
    case when p_website_url is null then null else lower(regexp_replace(split_part(regexp_replace(p_website_url,'^https?://',''), '/', 1), '^www\.', '')) end,
    upper(p_country_code),
    nullif(btrim(p_industry),''),
    p_account_type,
    nullif(btrim(p_notes),''),
    actor,
    actor
  )
  returning * into created;

  insert into audit.audit_events(actor_id, action, resource_type, resource_id, details)
  values (actor, 'create', 'crm.account', created.id::text, jsonb_build_object('company_name',created.company_name));

  return jsonb_build_object('data', jsonb_build_object('id',created.id,'company_name',created.company_name,'website_url',created.website_url,'domain',created.domain,'country_code',created.country_code,'industry',created.industry,'account_type',created.account_type,'lifecycle_stage',created.lifecycle_stage,'created_at',created.created_at));
end;
$$;

create or replace function public.urania_list_leads(p_search text default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, crm
as $$
declare actor uuid;
declare role_name text;
declare result jsonb;
begin
  actor := public.urania_require_role(array['admin','sales','researcher']);
  role_name := public.urania_role_from_jwt();
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb)
  into result
  from (
    select l.id, l.lead_name, l.status, l.score, l.source_url, l.next_action_at, l.created_at,
           a.company_name, a.country_code, c.full_name as contact_name
    from crm.leads l
    left join crm.accounts a on a.id=l.account_id
    left join crm.contacts c on c.id=l.contact_id
    where l.deleted_at is null
      and (p_search is null or btrim(p_search) = '' or l.lead_name ilike '%' || left(btrim(p_search),100) || '%' or a.company_name ilike '%' || left(btrim(p_search),100) || '%')
      and (role_name <> 'sales' or l.owner_id = actor or l.owner_id is null)
    order by l.created_at desc
    limit greatest(1, least(coalesce(p_limit,50),100))
  ) q;
  return jsonb_build_object('data',result,'count',jsonb_array_length(result));
end;
$$;

create or replace function public.urania_create_lead(
  p_lead_name text,
  p_account_id uuid default null,
  p_contact_id uuid default null,
  p_source_url text default null,
  p_next_action_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, crm, audit
as $$
declare actor uuid;
declare created crm.leads%rowtype;
begin
  actor := public.urania_require_role(array['admin','sales']);
  if p_lead_name is null or length(btrim(p_lead_name)) < 2 or length(p_lead_name) > 200 then
    raise exception 'lead_name must be between 2 and 200 characters' using errcode = '22023';
  end if;
  insert into crm.leads(lead_name, account_id, contact_id, source_url, next_action_at, owner_id, created_by)
  values (btrim(p_lead_name), p_account_id, p_contact_id, p_source_url, p_next_action_at, actor, actor)
  returning * into created;
  insert into audit.audit_events(actor_id, action, resource_type, resource_id, details)
  values (actor, 'create', 'crm.lead', created.id::text, jsonb_build_object('lead_name',created.lead_name));
  return jsonb_build_object('data',jsonb_build_object('id',created.id,'lead_name',created.lead_name,'status',created.status,'account_id',created.account_id,'contact_id',created.contact_id,'next_action_at',created.next_action_at,'created_at',created.created_at));
end;
$$;

create or replace function public.urania_list_products(p_search text default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, research
as $$
declare actor uuid;
declare result jsonb;
begin
  actor := public.urania_require_role(array['admin','researcher','sales']);
  select coalesce(jsonb_agg(to_jsonb(q) order by q.updated_at desc), '[]'::jsonb)
  into result
  from (
    select id, canonical_name, description, category_path, brand, attributes, status, created_at, updated_at
    from research.products
    where deleted_at is null
      and (p_search is null or btrim(p_search) = '' or canonical_name ilike '%' || left(btrim(p_search),100) || '%' or coalesce(description,'') ilike '%' || left(btrim(p_search),100) || '%')
    order by updated_at desc
    limit greatest(1, least(coalesce(p_limit,50),100))
  ) q;
  return jsonb_build_object('data',result,'count',jsonb_array_length(result));
end;
$$;

create or replace function public.urania_list_data_sources()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, integrations
as $$
declare actor uuid;
declare result jsonb;
begin
  actor := public.urania_require_role(array['admin','researcher']);
  select coalesce(jsonb_agg(to_jsonb(q) order by q.category, q.display_name), '[]'::jsonb)
  into result
  from (
    select provider_key, display_name, category, status, authorization_status, regions, capabilities, last_health_check_at
    from integrations.data_sources
  ) q;
  return jsonb_build_object('data',result,'count',jsonb_array_length(result));
end;
$$;

create or replace function public.urania_create_collection_job(
  p_job_type text,
  p_provider_key text default null,
  p_market_country text default null,
  p_input_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, automation, integrations, audit
as $$
declare actor uuid;
declare created automation.collection_jobs%rowtype;
begin
  actor := public.urania_require_role(array['admin','researcher']);
  if p_job_type is null or p_job_type !~ '^[a-z][a-z0-9_.-]{1,79}$' then
    raise exception 'invalid job_type' using errcode = '22023';
  end if;
  if p_input_payload is null or pg_column_size(p_input_payload) > 16384 then
    raise exception 'input_payload exceeds 16KB' using errcode = '22023';
  end if;
  if p_provider_key is not null and not exists (select 1 from integrations.data_sources s where s.provider_key=p_provider_key) then
    raise exception 'unknown provider_key' using errcode = '22023';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 160 then
    raise exception 'idempotency_key must be 8-160 characters' using errcode = '22023';
  end if;
  insert into automation.collection_jobs(job_type, provider_key, market_country, input_payload, idempotency_key, created_by)
  values (p_job_type, p_provider_key, upper(p_market_country), p_input_payload, p_idempotency_key, actor)
  on conflict (idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning * into created;
  insert into audit.audit_events(actor_id, action, resource_type, resource_id, details)
  values (actor, 'enqueue', 'automation.collection_job', created.id::text, jsonb_build_object('job_type',created.job_type,'provider_key',created.provider_key));
  return jsonb_build_object('data',jsonb_build_object('id',created.id,'job_type',created.job_type,'provider_key',created.provider_key,'status',created.status,'idempotency_key',created.idempotency_key,'created_at',created.created_at));
end;
$$;

revoke all on function public.urania_require_role(text[]) from public, anon, authenticated;
revoke all on function public.urania_role_from_jwt() from public, anon;
revoke all on function public.urania_list_accounts(text,integer) from public, anon;
revoke all on function public.urania_create_account(text,text,text,text,text,text) from public, anon;
revoke all on function public.urania_list_leads(text,integer) from public, anon;
revoke all on function public.urania_create_lead(text,uuid,uuid,text,timestamptz) from public, anon;
revoke all on function public.urania_list_products(text,integer) from public, anon;
revoke all on function public.urania_list_data_sources() from public, anon;
revoke all on function public.urania_create_collection_job(text,text,text,jsonb,text) from public, anon;

grant execute on function public.urania_require_role(text[]) to authenticated;
grant execute on function public.urania_role_from_jwt() to authenticated;
grant execute on function public.urania_list_accounts(text,integer) to authenticated;
grant execute on function public.urania_create_account(text,text,text,text,text,text) to authenticated;
grant execute on function public.urania_list_leads(text,integer) to authenticated;
grant execute on function public.urania_create_lead(text,uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.urania_list_products(text,integer) to authenticated;
grant execute on function public.urania_list_data_sources() to authenticated;
grant execute on function public.urania_create_collection_job(text,text,text,jsonb,text) to authenticated;
