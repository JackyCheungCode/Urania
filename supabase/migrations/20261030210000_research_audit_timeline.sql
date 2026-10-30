-- Unified owner-scoped audit timeline for evidence verification, risk review and investment decisions.
create or replace function public.urania_research_list_audit_events(p_opportunity_id uuid)
returns setof jsonb language sql stable security invoker set search_path=''
as $function$
 select event_payload from (
 select e.created_at as event_time, jsonb_build_object('event_type','evidence_verification','entity_id',e.id,
  'action','verification_status_changed','previous_status',e.previous_status,'new_status',e.new_status,
  'note',e.note,'actor_id',e.actor_id,'created_at',e.created_at)
 from research.evidence_verification_events e
 join research.evidence_records er on er.id=e.evidence_record_id
 join research.opportunities o on o.id=er.opportunity_id
 join research.research_projects p on p.id=o.project_id
 where o.id=p_opportunity_id and p.created_by=auth.uid()
 union all
 select r.created_at, jsonb_build_object('event_type','risk_review','entity_id',r.id,
  'action','risk_status_changed','previous_status',r.previous_status,'new_status',r.new_status,
  'note',r.note,'actor_id',r.actor_id,'created_at',r.created_at)
 from research.risk_audit_events r
 join research.risk_register rr on rr.id=r.risk_id
 join research.opportunities o on o.id=rr.opportunity_id
 join research.research_projects p on p.id=o.project_id
 where o.id=p_opportunity_id and p.created_by=auth.uid()
 union all
 select d.created_at, jsonb_build_object('event_type','investment_decision','entity_id',d.id,
  'action',d.action,'previous_status',d.previous_state->>'status','new_status',d.new_state->>'status',
  'note',d.note,'actor_id',d.actor_id,'created_at',d.created_at)
 from research.decision_audit_logs d
 join research.investment_decisions idc on idc.id=d.decision_id
 join research.opportunities o on o.id=idc.opportunity_id
 join research.research_projects p on p.id=o.project_id
 where o.id=p_opportunity_id and p.created_by=auth.uid()
 ) events(event_time,event_payload)
 order by event_time desc
$function$;
revoke all on function public.urania_research_list_audit_events(uuid) from public,anon;
grant execute on function public.urania_research_list_audit_events(uuid) to authenticated;
