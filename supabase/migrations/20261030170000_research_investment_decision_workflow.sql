-- Decision submission and explicit admin approval with server-enforced hard-veto checks.
create or replace function research.capture_investment_decision_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into research.decision_audit_logs(decision_id,actor_id,action,previous_state,new_state,note)
  values(
    new.id,auth.uid(),
    case when tg_op='INSERT' then 'submitted' else 'status_changed' end,
    case when tg_op='INSERT' then '{}'::jsonb else jsonb_build_object('status',old.status,'decision',old.decision) end,
    jsonb_build_object('status',new.status,'decision',new.decision,'hard_veto_triggered',new.hard_veto_triggered),
    null
  );
  return new;
end $$;
revoke all on function research.capture_investment_decision_audit() from public,anon,authenticated;
drop trigger if exists investment_decision_audit_trigger on research.investment_decisions;
create trigger investment_decision_audit_trigger
after insert or update of status,decision on research.investment_decisions
for each row execute function research.capture_investment_decision_audit();

create or replace function public.urania_research_submit_decision(
  p_opportunity_id uuid,p_decision text,p_rationale text,
  p_commercial_score numeric default null,p_evidence_coverage numeric default null,
  p_model_version text default 'urania-decision-v1',
  p_financial_model_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_decision research.investment_decisions;
  v_veto boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_decision not in ('invest','validate_more','defer','reject')
     or length(trim(coalesce(p_rationale,'')))<10
     or (p_commercial_score is not null and p_commercial_score not between 0 and 100)
     or (p_evidence_coverage is not null and p_evidence_coverage not between 0 and 1) then
    raise exception 'invalid_decision_input' using errcode='22023';
  end if;
  if not exists(select 1 from research.opportunities o join research.research_projects p on p.id=o.project_id
    where o.id=p_opportunity_id and p.created_by=auth.uid()) then
    raise exception 'opportunity_not_found' using errcode='P0002';
  end if;
  if p_financial_model_id is not null and not exists(select 1 from research.financial_models m
    where m.id=p_financial_model_id and m.opportunity_id=p_opportunity_id and m.created_by=auth.uid()) then
    raise exception 'financial_model_not_found' using errcode='P0002';
  end if;
  select exists(select 1 from research.risk_register r where r.opportunity_id=p_opportunity_id
    and r.hard_veto and r.status in ('open','mitigating')) into v_veto;
  insert into research.investment_decisions(opportunity_id,decision,rationale,commercial_score,evidence_coverage,
    hard_veto_triggered,model_version,financial_model_id,created_by,status)
  values(p_opportunity_id,p_decision,trim(p_rationale),p_commercial_score,p_evidence_coverage,
    v_veto,coalesce(nullif(trim(p_model_version),''),'urania-decision-v1'),p_financial_model_id,auth.uid(),'pending')
  returning * into v_decision;
  return jsonb_build_object('id',v_decision.id,'opportunity_id',v_decision.opportunity_id,
    'decision',v_decision.decision,'status',v_decision.status,'hard_veto_triggered',v_decision.hard_veto_triggered,
    'created_at',v_decision.created_at);
end $$;

create or replace function public.urania_research_approve_decision(p_decision_id uuid,p_note text default null)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_decision research.investment_decisions;
  v_role text;
  v_veto boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  v_role := coalesce(auth.jwt()->'app_metadata'->>'urania_role','');
  if v_role <> 'admin' then raise exception 'admin_approval_required' using errcode='42501'; end if;
  select d.* into v_decision from research.investment_decisions d
  join research.opportunities o on o.id=d.opportunity_id
  join research.research_projects p on p.id=o.project_id
  where d.id=p_decision_id and p.created_by=auth.uid() and d.status='pending'
  for update of d;
  if not found then raise exception 'pending_decision_not_found' using errcode='P0002'; end if;
  select exists(select 1 from research.risk_register r where r.opportunity_id=v_decision.opportunity_id
    and r.hard_veto and r.status in ('open','mitigating')) into v_veto;
  if v_veto then raise exception 'active_hard_veto_blocks_approval' using errcode='23514'; end if;
  update research.investment_decisions set status='approved',approved_by=auth.uid(),approved_at=now()
  where id=p_decision_id returning * into v_decision;
  update research.opportunities set decision_status=case v_decision.decision
    when 'invest' then 'invest' when 'validate_more' then 'validate_more'
    when 'defer' then 'defer' else 'reject' end,
    stage=case when v_decision.decision='invest' then 'approved'
      when v_decision.decision='reject' then 'rejected' else 'decision_pending' end,
    updated_at=now()
  where id=v_decision.opportunity_id;
  return jsonb_build_object('id',v_decision.id,'decision',v_decision.decision,
    'status',v_decision.status,'approved_by',v_decision.approved_by,'approved_at',v_decision.approved_at);
end $$;

revoke all on function public.urania_research_submit_decision(uuid,text,text,numeric,numeric,text,uuid) from public,anon;
revoke all on function public.urania_research_approve_decision(uuid,text) from public,anon;
grant execute on function public.urania_research_submit_decision(uuid,text,text,numeric,numeric,text,uuid) to authenticated;
grant execute on function public.urania_research_approve_decision(uuid,text) to authenticated;


create or replace function public.urania_research_list_decisions(p_opportunity_id uuid)
returns setof jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object('id',d.id,'opportunity_id',d.opportunity_id,'decision',d.decision,
    'rationale',d.rationale,'commercial_score',d.commercial_score,'evidence_coverage',d.evidence_coverage,
    'hard_veto_triggered',d.hard_veto_triggered,'model_version',d.model_version,
    'financial_model_id',d.financial_model_id,'status',d.status,'approved_by',d.approved_by,
    'approved_at',d.approved_at,'created_at',d.created_at)
  from research.investment_decisions d
  join research.opportunities o on o.id=d.opportunity_id
  join research.research_projects p on p.id=o.project_id
  where d.opportunity_id=p_opportunity_id and p.created_by=auth.uid()
  order by d.created_at desc
$$;
revoke all on function public.urania_research_list_decisions(uuid) from public,anon;
grant execute on function public.urania_research_list_decisions(uuid) to authenticated;
