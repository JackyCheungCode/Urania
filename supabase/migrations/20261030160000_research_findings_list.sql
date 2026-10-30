create or replace function public.urania_research_list_findings(p_opportunity_id uuid)
returns setof jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'id',f.id,'opportunity_id',f.opportunity_id,'stage',f.stage,'finding_type',f.finding_type,
    'claim',f.claim,'explanation',f.explanation,'evidence_status',f.evidence_status,
    'confidence',f.confidence,'freshness_status',f.freshness_status,
    'model_generated',f.model_generated,'created_at',f.created_at
  )
  from research.research_findings f
  join research.opportunities o on o.id=f.opportunity_id
  join research.research_projects p on p.id=o.project_id
  where f.opportunity_id=p_opportunity_id and p.created_by=auth.uid()
  order by f.created_at desc
$$;
revoke all on function public.urania_research_list_findings(uuid) from public,anon;
grant execute on function public.urania_research_list_findings(uuid) to authenticated;
