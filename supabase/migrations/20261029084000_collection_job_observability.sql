create or replace function public.urania_list_collection_jobs(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, automation, research, integrations
as $$
declare actor uuid;
declare actor_role text;
declare result jsonb;
begin
  actor := public.urania_require_role(array['admin','researcher']);
  actor_role := public.urania_role_from_jwt();

  select coalesce(jsonb_agg(job_json order by created_at desc), '[]'::jsonb)
    into result
  from (
    select j.created_at,
      jsonb_build_object(
        'id', j.id,
        'job_type', j.job_type,
        'provider_key', j.provider_key,
        'status', j.status,
        'market_country', j.market_country,
        'query', left(coalesce(j.input_payload->>'query',''),500),
        'attempts', j.attempts,
        'max_attempts', j.max_attempts,
        'error_code', j.error_code,
        'error_message', left(j.error_message,500),
        'created_at', j.created_at,
        'started_at', j.started_at,
        'finished_at', j.finished_at,
        'result_count', (select count(*) from research.search_results sr where sr.job_id=j.id),
        'results', coalesce((
          select jsonb_agg(jsonb_build_object(
            'title', sr.title,
            'url', sr.result_url,
            'snippet', sr.snippet,
            'displayed_url', sr.displayed_url,
            'rank', sr.result_rank,
            'fetched_at', sr.fetched_at
          ) order by sr.result_rank)
          from research.search_results sr where sr.job_id=j.id
        ), '[]'::jsonb)
      ) as job_json
    from automation.collection_jobs j
    where actor_role='admin' or j.created_by=actor
    order by j.created_at desc
    limit greatest(1, least(coalesce(p_limit,20),50))
  ) jobs;

  return jsonb_build_object('data', result);
end;
$$;

revoke all on function public.urania_list_collection_jobs(integer) from public, anon;
grant execute on function public.urania_list_collection_jobs(integer) to authenticated;
