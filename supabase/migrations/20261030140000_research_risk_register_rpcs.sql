-- Owner-scoped risk register API. Hard vetoes are explicit records and never score offsets.
create or replace function public.urania_research_create_risk(
  p_opportunity_id uuid,p_risk_category text,p_description text,
  p_severity text default 'medium',p_likelihood text default 'medium',
  p_hard_veto boolean default false,p_mitigation_plan text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_row research.risk_register;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if length(trim(coalesce(p_description,'')))<5 then raise exception 'risk_description_required' using errcode='22023'; end if;
  if not exists(select 1 from research.opportunities o join research.research_projects p on p.id=o.project_id where o.id=p_opportunity_id and p.created_by=auth.uid()) then
    raise exception 'opportunity_not_found' using errcode='P0002';
  end if;
  insert into research.risk_register(opportunity_id,risk_category,description,severity,likelihood,hard_veto,mitigation_plan,created_by)
  values(p_opportunity_id,p_risk_category,trim(p_description),p_severity,p_likelihood,coalesce(p_hard_veto,false),nullif(trim(coalesce(p_mitigation_plan,'')),''),auth.uid())
  returning * into v_row;
  return jsonb_build_object('id',v_row.id,'opportunity_id',v_row.opportunity_id,'risk_category',v_row.risk_category,
    'description',v_row.description,'severity',v_row.severity,'likelihood',v_row.likelihood,'hard_veto',v_row.hard_veto,
    'status',v_row.status,'mitigation_plan',v_row.mitigation_plan,'created_at',v_row.created_at);
end $$;

create or replace function public.urania_research_list_risks(p_opportunity_id uuid)
returns setof jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object('id',r.id,'opportunity_id',r.opportunity_id,'risk_category',r.risk_category,
    'description',r.description,'severity',r.severity,'likelihood',r.likelihood,'hard_veto',r.hard_veto,
    'status',r.status,'mitigation_plan',r.mitigation_plan,'created_at',r.created_at)
  from research.risk_register r
  join research.opportunities o on o.id=r.opportunity_id
  join research.research_projects p on p.id=o.project_id
  where r.opportunity_id=p_opportunity_id and p.created_by=auth.uid()
  order by (r.hard_veto and r.status in ('open','mitigating')) desc,
    case r.severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
    r.created_at desc
$$;

revoke all on function public.urania_research_create_risk(uuid,text,text,text,text,boolean,text) from public, anon;
revoke all on function public.urania_research_list_risks(uuid) from public, anon;
grant execute on function public.urania_research_create_risk(uuid,text,text,text,text,boolean,text) to authenticated;
grant execute on function public.urania_research_list_risks(uuid) to authenticated;
