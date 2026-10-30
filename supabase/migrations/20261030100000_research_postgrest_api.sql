-- Public PostgREST RPC boundary for the evidence-first research workspace.
-- SECURITY INVOKER keeps caller RLS in force; no service-role escalation.
create or replace function public.urania_research_create_project(
  p_name text, p_objective text, p_geographies text[] default '{}',
  p_industries text[] default '{}', p_investment_horizon text default '1_3y',
  p_investment_budget jsonb default '{}', p_approval_policy text default 'tiered'
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_row research.research_projects;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(coalesce(p_objective,''))) < 10 then
    raise exception 'invalid_project_details' using errcode='22023';
  end if;
  insert into research.research_projects(name,objective,geographies,industries,investment_horizon,investment_budget,approval_policy,created_by)
  values(trim(p_name),trim(p_objective),coalesce(p_geographies,'{}'),coalesce(p_industries,'{}'),p_investment_horizon,coalesce(p_investment_budget,'{}'::jsonb),p_approval_policy,auth.uid())
  returning * into v_row;
  return jsonb_build_object('id',v_row.id,'name',v_row.name,'objective',v_row.objective,'status',v_row.status,'created_at',v_row.created_at);
end $$;

create or replace function public.urania_research_list_projects()
returns setof jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object('id',p.id,'name',p.name,'objective',p.objective,'status',p.status,'geographies',p.geographies,'industries',p.industries,'investment_horizon',p.investment_horizon,'investment_budget',p.investment_budget,'approval_policy',p.approval_policy,'created_at',p.created_at)
  from research.research_projects p where p.created_by=auth.uid() order by p.created_at desc
$$;

create or replace function public.urania_research_create_opportunity(
  p_project_id uuid, p_title text, p_summary text default null,
  p_opportunity_type text default 'product', p_target_markets text[] default '{}'
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_row research.opportunities;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from research.research_projects p where p.id=p_project_id and p.created_by=auth.uid()) then
    raise exception 'project_not_found' using errcode='P0002';
  end if;
  if length(trim(coalesce(p_title,''))) < 2 then raise exception 'invalid_opportunity_title' using errcode='22023'; end if;
  insert into research.opportunities(project_id,title,summary,opportunity_type,target_markets,created_by)
  values(p_project_id,trim(p_title),nullif(trim(coalesce(p_summary,'')),''),p_opportunity_type,coalesce(p_target_markets,'{}'),auth.uid())
  returning * into v_row;
  return jsonb_build_object('id',v_row.id,'project_id',v_row.project_id,'title',v_row.title,'stage',v_row.stage,'decision_status',v_row.decision_status,'created_at',v_row.created_at);
end $$;

create or replace function public.urania_research_list_opportunities(p_project_id uuid)
returns setof jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object('id',o.id,'project_id',o.project_id,'title',o.title,'summary',o.summary,'opportunity_type',o.opportunity_type,'target_markets',o.target_markets,'stage',o.stage,'decision_status',o.decision_status,'created_at',o.created_at)
  from research.opportunities o join research.research_projects p on p.id=o.project_id
  where o.project_id=p_project_id and p.created_by=auth.uid() order by o.created_at desc
$$;

create or replace function public.urania_research_create_finding(
  p_opportunity_id uuid, p_stage text, p_claim text, p_explanation text default null,
  p_finding_type text default 'claim', p_confidence numeric default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_row research.research_findings;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not exists(select 1 from research.opportunities o join research.research_projects p on p.id=o.project_id where o.id=p_opportunity_id and p.created_by=auth.uid()) then
    raise exception 'opportunity_not_found' using errcode='P0002';
  end if;
  if length(trim(coalesce(p_claim,''))) < 5 then raise exception 'invalid_finding' using errcode='22023'; end if;
  insert into research.research_findings(opportunity_id,stage,claim,explanation,finding_type,confidence,created_by)
  values(p_opportunity_id,p_stage,trim(p_claim),p_explanation,p_finding_type,p_confidence,auth.uid())
  returning * into v_row;
  return jsonb_build_object('id',v_row.id,'opportunity_id',v_row.opportunity_id,'stage',v_row.stage,'claim',v_row.claim,'evidence_status',v_row.evidence_status,'confidence',v_row.confidence,'created_at',v_row.created_at);
end $$;

revoke all on function public.urania_research_create_project(text,text,text[],text[],text,jsonb,text) from public, anon;
revoke all on function public.urania_research_list_projects() from public, anon;
revoke all on function public.urania_research_create_opportunity(uuid,text,text,text,text[]) from public, anon;
revoke all on function public.urania_research_list_opportunities(uuid) from public, anon;
revoke all on function public.urania_research_create_finding(uuid,text,text,text,text,numeric) from public, anon;
grant execute on function public.urania_research_create_project(text,text,text[],text[],text,jsonb,text) to authenticated;
grant execute on function public.urania_research_list_projects() to authenticated;
grant execute on function public.urania_research_create_opportunity(uuid,text,text,text,text[]) to authenticated;
grant execute on function public.urania_research_list_opportunities(uuid) to authenticated;
grant execute on function public.urania_research_create_finding(uuid,text,text,text,text,numeric) to authenticated;
