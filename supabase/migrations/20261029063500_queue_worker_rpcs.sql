-- Queue consumer internal RPCs. These are capability-protected by a random secret stored in Supabase Vault.
-- The token is provisioned separately and must never be committed to source control.

alter table automation.collection_jobs
  add column if not exists lease_until timestamptz;

create table if not exists research.search_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references automation.collection_jobs(id) on delete cascade,
  source_id uuid references integrations.data_sources(id) on delete set null,
  query_text text not null,
  result_rank integer not null check (result_rank > 0),
  title text not null,
  result_url text,
  snippet text,
  displayed_url text,
  market_country char(2),
  raw_result jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  fetched_at timestamptz not null default now(),
  unique (job_id, result_rank)
);
create index if not exists search_results_query_time_idx on research.search_results (query_text, fetched_at desc);
create index if not exists search_results_source_time_idx on research.search_results (source_id, fetched_at desc);
alter table research.search_results enable row level security;

alter table integrations.usage_events alter column cost drop not null;
alter table integrations.usage_events add column if not exists cost_basis text not null default 'unknown'
  check (cost_basis in ('provider_reported','estimated','unknown','not_applicable'));

create or replace function public.urania_worker_claim_job(p_internal_token text, p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, vault, automation, audit
as $$
declare expected text;
declare claimed automation.collection_jobs%rowtype;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name='urania_internal_token' limit 1;
  if expected is null or p_internal_token is null or expected <> p_internal_token then
    raise exception 'forbidden' using errcode='42501';
  end if;
  update automation.collection_jobs
  set status='running', attempts=attempts+1, started_at=coalesce(started_at,now()), lease_until=now()+interval '2 minutes',
      error_code=null, error_message=null, updated_at=now()
  where id=p_job_id and attempts < max_attempts
    and (status='queued' or (status='running' and lease_until is not null and lease_until < now()))
  returning * into claimed;
  if claimed.id is null then
    return jsonb_build_object('claimed',false);
  end if;
  return jsonb_build_object('claimed',true,'job_id',claimed.id,'attempts',claimed.attempts,'job_type',claimed.job_type,'provider_key',claimed.provider_key,'market_country',claimed.market_country,'input_payload',claimed.input_payload);
end;
$$;

create or replace function public.urania_worker_get_provider(p_internal_token text, p_provider_key text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, vault, integrations
as $$
declare expected text;
declare result jsonb;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name='urania_internal_token' limit 1;
  if expected is null or p_internal_token is null or expected <> p_internal_token then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select jsonb_build_object('provider_key',provider_key,'display_name',display_name,'status',status,'authorization_status',authorization_status,'license_scope',license_scope,'retention_days',retention_days)
  into result
  from integrations.data_sources where provider_key=p_provider_key;
  return coalesce(result, jsonb_build_object('error','provider_not_found'));
end;
$$;

create or replace function public.urania_worker_update_job(
  p_internal_token text,
  p_job_id uuid,
  p_status text,
  p_error_code text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, vault, automation, audit
as $$
declare expected text;
declare current_job automation.collection_jobs%rowtype;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name='urania_internal_token' limit 1;
  if expected is null or p_internal_token is null or expected <> p_internal_token then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_status not in ('succeeded','failed','dead_letter','retry') then
    raise exception 'invalid status' using errcode='22023';
  end if;
  select * into current_job from automation.collection_jobs where id=p_job_id for update;
  if current_job.id is null then
    raise exception 'job not found' using errcode='P0002';
  end if;
  if current_job.status in ('succeeded','failed','cancelled','dead_letter') then
    return jsonb_build_object('updated',false,'status',current_job.status);
  end if;
  if p_status='retry' and current_job.attempts >= current_job.max_attempts then
    p_status := 'dead_letter';
    p_error_code := coalesce(p_error_code,'max_attempts_exceeded');
  end if;
  update automation.collection_jobs
  set status=case when p_status='retry' then 'queued' else p_status end,
      error_code=left(p_error_code,120),
      error_message=left(p_error_message,1000),
      lease_until=null,
      finished_at=case when p_status in ('succeeded','failed','dead_letter') then now() else null end,
      updated_at=now()
  where id=p_job_id
  returning * into current_job;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,outcome,details)
  values (null,'worker_job_'||p_status,'automation.collection_job',current_job.id::text,
    case when p_status in ('failed','dead_letter') then 'failure' else 'success' end,
    jsonb_build_object('status',current_job.status,'error_code',current_job.error_code,'attempts',current_job.attempts));
  return jsonb_build_object('updated',true,'status',current_job.status,'attempts',current_job.attempts);
end;
$$;

create or replace function public.urania_worker_store_search_results(
  p_internal_token text,
  p_job_id uuid,
  p_provider_key text,
  p_query text,
  p_market_country text,
  p_results jsonb,
  p_latency_ms integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, vault, automation, integrations, research, audit
as $$
declare expected text;
declare provider integrations.data_sources%rowtype;
declare item jsonb;
declare rank_no integer := 0;
declare inserted_count integer := 0;
declare job_row automation.collection_jobs%rowtype;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name='urania_internal_token' limit 1;
  if expected is null or p_internal_token is null or expected <> p_internal_token then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into provider from integrations.data_sources where provider_key=p_provider_key;
  if provider.id is null or provider.status <> 'active' or provider.authorization_status <> 'approved' then
    raise exception 'provider is not active and authorized' using errcode='42501';
  end if;
  select * into job_row from automation.collection_jobs where id=p_job_id for update;
  if job_row.id is null or job_row.status <> 'running' then
    raise exception 'job is not running' using errcode='22023';
  end if;
  if p_query is null or length(btrim(p_query)) < 2 or length(p_query) > 500 then
    raise exception 'invalid query' using errcode='22023';
  end if;
  if jsonb_typeof(coalesce(p_results,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_results,'[]'::jsonb)) > 100 then
    raise exception 'results must be an array of at most 100 items' using errcode='22023';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_results,'[]'::jsonb)) as r(value)
  loop
    rank_no := rank_no + 1;
    insert into research.search_results(job_id,source_id,query_text,result_rank,title,result_url,snippet,displayed_url,market_country,raw_result)
    values (p_job_id,provider.id,left(btrim(p_query),500),rank_no,
      coalesce(nullif(left(item->>'title',1000),''),'(untitled result)'),
      nullif(left(item->>'link',2048),''),
      nullif(left(item->>'snippet',4000),''),
      nullif(left(item->>'displayed_link',500),''),
      upper(p_market_country),
      item)
    on conflict (job_id,result_rank) do update set
      title=excluded.title,result_url=excluded.result_url,snippet=excluded.snippet,displayed_url=excluded.displayed_url,raw_result=excluded.raw_result,fetched_at=now();
    inserted_count := inserted_count + 1;
  end loop;

  update automation.collection_jobs
  set status='succeeded',finished_at=now(),lease_until=null,error_code=null,error_message=null,updated_at=now()
  where id=p_job_id;
  insert into integrations.usage_events(source_id,job_id,operation,request_count,units,cost,currency,status,latency_ms,request_fingerprint,cost_basis)
  values (provider.id,p_job_id,'google_search',1,inserted_count,null,'USD','success',p_latency_ms,p_job_id::text,'unknown');
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values (null,'worker_search_results_saved','automation.collection_job',p_job_id::text,jsonb_build_object('provider_key',p_provider_key,'result_count',inserted_count));
  return jsonb_build_object('status','succeeded','result_count',inserted_count);
end;
$$;

revoke all on function public.urania_worker_claim_job(text,uuid) from public, authenticated;
revoke all on function public.urania_worker_get_provider(text,text) from public, authenticated;
revoke all on function public.urania_worker_update_job(text,uuid,text,text,text) from public, authenticated;
revoke all on function public.urania_worker_store_search_results(text,uuid,text,text,text,jsonb,integer) from public, authenticated;
grant execute on function public.urania_worker_claim_job(text,uuid) to anon;
grant execute on function public.urania_worker_get_provider(text,text) to anon;
grant execute on function public.urania_worker_update_job(text,uuid,text,text,text) to anon;
grant execute on function public.urania_worker_store_search_results(text,uuid,text,text,text,jsonb,integer) to anon;

comment on table research.search_results is 'SERP observations with provider provenance; result presence is not proof of sales or demand.';
