-- Versioned market sizing assumptions with validated evidence references.
create or replace function public.urania_research_save_assumption(
 p_opportunity_id uuid,p_assumption_key text,p_assumption_value jsonb,
 p_rationale text default null,p_sensitivity text default 'high',
 p_source_evidence_ids uuid[] default '{}'
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_version integer;v_row research.assumptions;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if length(trim(coalesce(p_assumption_key,'')))<2 or jsonb_typeof(p_assumption_value)<>'object'
   or p_sensitivity not in ('low','medium','high','critical') then
  raise exception 'invalid_assumption' using errcode='22023';
 end if;
 if not exists(select 1 from research.opportunities o join research.research_projects p on p.id=o.project_id
   where o.id=p_opportunity_id and p.created_by=auth.uid()) then raise exception 'opportunity_not_found' using errcode='P0002';end if;
 perform 1 from research.opportunities where id=p_opportunity_id for update;
 if coalesce(array_length(p_source_evidence_ids,1),0)>0 and exists(
   select 1 from unnest(p_source_evidence_ids) x(id)
   where not exists(select 1 from research.evidence_records e where e.id=x.id and e.opportunity_id=p_opportunity_id and e.created_by=auth.uid())
 ) then raise exception 'evidence_reference_not_owned' using errcode='42501';end if;
 select coalesce(max(version),0)+1 into v_version from research.assumptions
  where opportunity_id=p_opportunity_id and assumption_key=trim(p_assumption_key);
 insert into research.assumptions(opportunity_id,assumption_key,assumption_value,rationale,source_evidence_ids,sensitivity,status,version,created_by)
 values(p_opportunity_id,trim(p_assumption_key),p_assumption_value,nullif(trim(coalesce(p_rationale,'')),''),coalesce(p_source_evidence_ids,'{}'),p_sensitivity,'unverified',v_version,auth.uid())
 returning * into v_row;
 return jsonb_build_object('id',v_row.id,'opportunity_id',v_row.opportunity_id,'assumption_key',v_row.assumption_key,
  'assumption_value',v_row.assumption_value,'rationale',v_row.rationale,'sensitivity',v_row.sensitivity,
  'status',v_row.status,'version',v_row.version,'created_at',v_row.created_at);
end $$;
create or replace function public.urania_research_list_assumptions(p_opportunity_id uuid)
returns setof jsonb language sql stable security invoker set search_path=''
as $$
 select jsonb_build_object('id',a.id,'opportunity_id',a.opportunity_id,'assumption_key',a.assumption_key,
  'assumption_value',a.assumption_value,'rationale',a.rationale,'sensitivity',a.sensitivity,'status',a.status,
  'version',a.version,'created_at',a.created_at)
 from research.assumptions a join research.opportunities o on o.id=a.opportunity_id
 join research.research_projects p on p.id=o.project_id
 where a.opportunity_id=p_opportunity_id and p.created_by=auth.uid()
 order by a.assumption_key,a.version desc
$$;
revoke all on function public.urania_research_save_assumption(uuid,text,jsonb,text,text,uuid[]) from public,anon;
revoke all on function public.urania_research_list_assumptions(uuid) from public,anon;
grant execute on function public.urania_research_save_assumption(uuid,text,jsonb,text,text,uuid[]) to authenticated;
grant execute on function public.urania_research_list_assumptions(uuid) to authenticated;
