-- Owner-scoped retrieval of web search observations linked to a research opportunity.
create or replace function public.urania_research_list_search_results(p_opportunity_id uuid)
returns setof jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,auth,research,automation
as $function$
begin
 if auth.uid() is null or coalesce(auth.jwt()->'app_metadata'->>'urania_role','') not in ('admin','researcher') then
  raise exception 'research_role_required' using errcode='42501';
 end if;
 if not exists(select 1 from research.opportunities o join research.research_projects p on p.id=o.project_id
  where o.id=p_opportunity_id and p.created_by=auth.uid()) then
  raise exception 'opportunity_not_found' using errcode='P0002';
 end if;
 return query
 select jsonb_build_object('id',s.id,'job_id',s.job_id,'query',s.query_text,'rank',s.result_rank,
  'title',s.title,'url',s.result_url,'snippet',s.snippet,'displayed_url',s.displayed_url,
  'market_country',s.market_country,'observed_at',s.observed_at,'fetched_at',s.fetched_at)
 from research.search_results s
 join automation.collection_jobs j on j.id=s.job_id
 where j.created_by=auth.uid() and j.input_payload->>'opportunity_id'=p_opportunity_id::text
 order by s.fetched_at desc,s.result_rank asc;
end
$function$;
revoke all on function public.urania_research_list_search_results(uuid) from public,anon;
grant execute on function public.urania_research_list_search_results(uuid) to authenticated;
