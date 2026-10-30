create or replace function public.urania_research_list_runs(p_opportunity_id uuid)
returns setof jsonb language sql stable security invoker set search_path=''
as $function$
 select jsonb_build_object('id',r.id,'opportunity_id',r.opportunity_id,'run_type',r.run_type,
  'status',r.status,'model_provider',r.model_provider,'model_name',r.model_name,'prompt_version',r.prompt_version,
  'input_scope',r.input_scope,'output_summary',r.output_summary,'started_at',r.started_at,
  'finished_at',r.finished_at,'created_at',r.created_at)
 from research.research_runs r join research.opportunities o on o.id=r.opportunity_id
 join research.research_projects p on p.id=o.project_id
 where r.opportunity_id=p_opportunity_id and p.created_by=auth.uid()
 order by r.created_at desc
$function$;
revoke all on function public.urania_research_list_runs(uuid) from public,anon;
grant execute on function public.urania_research_list_runs(uuid) to authenticated;
