drop function if exists public.urania_worker_store_search_results(text,uuid,text,text,text,jsonb,integer);

create or replace function public.urania_worker_store_search_results(
  p_internal_token text,
  p_job_id uuid,
  p_provider_key text,
  p_query text,
  p_market_country text,
  p_results jsonb,
  p_latency_ms integer default null,
  p_provider_cost numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, vault, automation, integrations, research, audit
as $$
declare expected text;
declare provider integrations.data_sources%rowtype;
declare item jsonb;
declare rank_no integer:=0;
declare inserted_count integer:=0;
declare job_row automation.collection_jobs%rowtype;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name='urania_internal_token' limit 1;
  if expected is null or p_internal_token is null or expected<>p_internal_token then raise exception 'forbidden' using errcode='42501'; end if;
  select * into provider from integrations.data_sources where provider_key=p_provider_key;
  if provider.id is null or provider.status<>'active' or provider.authorization_status<>'approved' then raise exception 'provider is not active and authorized' using errcode='42501'; end if;
  select * into job_row from automation.collection_jobs where id=p_job_id for update;
  if job_row.id is null or job_row.status<>'running' then raise exception 'job is not running' using errcode='22023'; end if;
  if p_query is null or length(btrim(p_query))<2 or length(p_query)>500 then raise exception 'invalid query' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_results,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_results,'[]'::jsonb))>100 then raise exception 'results must be an array of at most 100 items' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(coalesce(p_results,'[]'::jsonb)) as r(value) loop
    rank_no:=rank_no+1;
    insert into research.search_results(job_id,source_id,query_text,result_rank,title,result_url,snippet,displayed_url,market_country,raw_result)
    values(p_job_id,provider.id,left(btrim(p_query),500),rank_no,coalesce(nullif(left(item->>'title',1000),''),'(untitled result)'),nullif(left(coalesce(item->>'link',item->>'url'),2048),''),nullif(left(coalesce(item->>'snippet',item->>'description'),4000),''),nullif(left(coalesce(item->>'displayed_link',item->>'domain'),500),''),upper(p_market_country),item)
    on conflict(job_id,result_rank) do update set title=excluded.title,result_url=excluded.result_url,snippet=excluded.snippet,displayed_url=excluded.displayed_url,raw_result=excluded.raw_result,fetched_at=now();
    inserted_count:=inserted_count+1;
  end loop;
  update automation.collection_jobs set status='succeeded',finished_at=now(),lease_until=null,error_code=null,error_message=null,updated_at=now() where id=p_job_id;
  insert into integrations.usage_events(source_id,job_id,operation,request_count,units,cost,currency,status,latency_ms,request_fingerprint,cost_basis)
  values(provider.id,p_job_id,'google_search',1,inserted_count,p_provider_cost,'USD','success',p_latency_ms,p_job_id::text,case when p_provider_cost is null then 'unknown' else 'provider_reported' end);
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(null,'worker_search_results_saved','automation.collection_job',p_job_id::text,jsonb_build_object('provider_key',p_provider_key,'result_count',inserted_count,'provider_cost',p_provider_cost));
  return jsonb_build_object('status','succeeded','result_count',inserted_count,'provider_cost',p_provider_cost);
end;
$$;

create or replace function public.urania_worker_store_trends(
  p_internal_token text,
  p_job_id uuid,
  p_provider_key text,
  p_query text,
  p_market_country text,
  p_observations jsonb,
  p_latency_ms integer default null,
  p_provider_cost numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, vault, automation, integrations, research, audit
as $$
declare expected text;
declare provider integrations.data_sources%rowtype;
declare item jsonb;
declare value numeric;
declare timestamp_value numeric;
declare observed timestamptz;
declare row_count integer:=0;
declare job_row automation.collection_jobs%rowtype;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name='urania_internal_token' limit 1;
  if expected is null or p_internal_token is null or expected<>p_internal_token then raise exception 'forbidden' using errcode='42501'; end if;
  select * into provider from integrations.data_sources where provider_key=p_provider_key;
  if provider.id is null or provider.status<>'active' or provider.authorization_status<>'approved' then raise exception 'provider is not active and authorized' using errcode='42501'; end if;
  select * into job_row from automation.collection_jobs where id=p_job_id for update;
  if job_row.id is null or job_row.status<>'running' then raise exception 'job is not running' using errcode='22023'; end if;
  if p_query is null or length(btrim(p_query))<2 or length(p_query)>500 then raise exception 'invalid query' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_observations,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_observations,'[]'::jsonb))>1000 then raise exception 'observations must be an array of at most 1000 items' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(coalesce(p_observations,'[]'::jsonb)) as r(value) loop
    value:=nullif(item->>'value','')::numeric;
    if value is null or value<0 or value>100 then raise exception 'trend value must be between 0 and 100' using errcode='22023'; end if;
    timestamp_value:=nullif(item->>'timestamp','')::numeric;
    observed:=case when timestamp_value is null then null else to_timestamp(timestamp_value) end;
    insert into research.observations(product_id,source_id,metric_name,metric_value,metric_unit,market_country,evidence_type,source_record_id,source_url,observed_at,fetched_at,method_version,metadata)
    values(null,provider.id,'google_trends_interest',value,'relative_index_0_100',upper(p_market_country),'T2_proxy',coalesce(item->>'source_record_id',p_job_id::text||':'||(row_count+1)::text),nullif(left(item->>'source_url',2048),''),observed,now(),'dataforseo_google_trends_explore_v1',jsonb_build_object('query',left(btrim(p_query),500),'provider_key',p_provider_key,'point',item));
    row_count:=row_count+1;
  end loop;
  update automation.collection_jobs set status='succeeded',finished_at=now(),lease_until=null,error_code=null,error_message=null,updated_at=now() where id=p_job_id;
  insert into integrations.usage_events(source_id,job_id,operation,request_count,units,cost,currency,status,latency_ms,request_fingerprint,cost_basis)
  values(provider.id,p_job_id,'google_trends_explore',1,row_count,p_provider_cost,'USD','success',p_latency_ms,p_job_id::text,case when p_provider_cost is null then 'unknown' else 'provider_reported' end);
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(null,'worker_trends_saved','automation.collection_job',p_job_id::text,jsonb_build_object('provider_key',p_provider_key,'observation_count',row_count,'provider_cost',p_provider_cost,'metric_type','relative_index_0_100'));
  return jsonb_build_object('status','succeeded','observation_count',row_count,'provider_cost',p_provider_cost);
end;
$$;

revoke all on function public.urania_worker_store_search_results(text,uuid,text,text,text,jsonb,integer,numeric) from public,anon,authenticated;
revoke all on function public.urania_worker_store_trends(text,uuid,text,text,text,jsonb,integer,numeric) from public,anon,authenticated;
grant execute on function public.urania_worker_store_search_results(text,uuid,text,text,text,jsonb,integer,numeric) to service_role;
grant execute on function public.urania_worker_store_trends(text,uuid,text,text,text,jsonb,integer,numeric) to service_role;
