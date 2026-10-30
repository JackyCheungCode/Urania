-- Versioned, owner-scoped persistence for deterministic financial model snapshots.
create or replace function public.urania_research_save_financial_model(
  p_opportunity_id uuid,
  p_currency text,
  p_horizon_months integer,
  p_inputs jsonb,
  p_outputs jsonb,
  p_engine_version text,
  p_assumptions_snapshot jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_opportunity research.opportunities;
  v_version integer;
  v_row research.financial_models;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_currency !~ '^[A-Z]{3}$' or p_horizon_months not between 1 and 240
     or length(coalesce(p_engine_version,'')) not between 1 and 40
     or jsonb_typeof(coalesce(p_inputs,'{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_outputs,'{}'::jsonb)) <> 'object' then
    raise exception 'invalid_financial_model' using errcode='22023';
  end if;
  select o.* into v_opportunity
  from research.opportunities o
  join research.research_projects p on p.id=o.project_id
  where o.id=p_opportunity_id and p.created_by=auth.uid()
  for update of o;
  if not found then raise exception 'opportunity_not_found' using errcode='P0002'; end if;
  select coalesce(max(model_version),0)+1 into v_version
  from research.financial_models where opportunity_id=p_opportunity_id;
  insert into research.financial_models(
    opportunity_id,model_version,currency,horizon_months,assumptions_snapshot,
    inputs,outputs,calculation_engine_version,status,calculated_at,created_by
  ) values (
    p_opportunity_id,v_version,p_currency,p_horizon_months,
    coalesce(p_assumptions_snapshot,'{}'::jsonb),coalesce(p_inputs,'{}'::jsonb),
    coalesce(p_outputs,'{}'::jsonb),p_engine_version,'calculated',now(),auth.uid()
  ) returning * into v_row;
  return jsonb_build_object(
    'id',v_row.id,'opportunity_id',v_row.opportunity_id,'model_version',v_row.model_version,
    'currency',v_row.currency,'horizon_months',v_row.horizon_months,'inputs',v_row.inputs,
    'outputs',v_row.outputs,'calculation_engine_version',v_row.calculation_engine_version,
    'status',v_row.status,'calculated_at',v_row.calculated_at,'created_at',v_row.created_at
  );
end $$;

create or replace function public.urania_research_list_financial_models(p_opportunity_id uuid)
returns setof jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'id',m.id,'opportunity_id',m.opportunity_id,'model_version',m.model_version,
    'currency',m.currency,'horizon_months',m.horizon_months,'inputs',m.inputs,
    'outputs',m.outputs,'calculation_engine_version',m.calculation_engine_version,
    'status',m.status,'calculated_at',m.calculated_at,'created_at',m.created_at
  )
  from research.financial_models m
  join research.opportunities o on o.id=m.opportunity_id
  join research.research_projects p on p.id=o.project_id
  where m.opportunity_id=p_opportunity_id and p.created_by=auth.uid()
  order by m.model_version desc
$$;

revoke all on function public.urania_research_save_financial_model(uuid,text,integer,jsonb,jsonb,text,jsonb) from public, anon;
revoke all on function public.urania_research_list_financial_models(uuid) from public, anon;
grant execute on function public.urania_research_save_financial_model(uuid,text,integer,jsonb,jsonb,text,jsonb) to authenticated;
grant execute on function public.urania_research_list_financial_models(uuid) to authenticated;
