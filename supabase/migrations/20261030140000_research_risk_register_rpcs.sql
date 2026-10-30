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


create table if not exists research.risk_audit_events(
 id bigint generated always as identity primary key,
 risk_id uuid not null references research.risk_register(id) on delete cascade,
 previous_status text not null,
 new_status text not null check(new_status in ('open','mitigating','accepted','resolved','false_positive')),
 note text not null,
 actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists risk_audit_events_risk_time_idx on research.risk_audit_events(risk_id,created_at desc);
alter table research.risk_audit_events enable row level security;
create policy risk_audit_events_owner_read on research.risk_audit_events for select to authenticated using(
 exists(select 1 from research.risk_register r join research.opportunities o on o.id=r.opportunity_id
 join research.research_projects p on p.id=o.project_id where r.id=risk_id and p.created_by=(select auth.uid()))
);
grant select on research.risk_audit_events to authenticated;
grant usage,select on sequence research.risk_audit_events_id_seq to authenticated;

create or replace function research.capture_risk_status_event()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.status is distinct from old.status then
  insert into research.risk_audit_events(risk_id,previous_status,new_status,note,actor_id)
  values(new.id,old.status,new.status,
    coalesce(nullif(new.reviewed_at::text,''),'Risk status changed through authorized workflow.'),
    coalesce(auth.uid(),new.reviewed_by,new.created_by));
 end if;
 return new;
end $$;
revoke all on function research.capture_risk_status_event() from public,anon,authenticated;
drop trigger if exists risk_status_audit_trigger on research.risk_register;
create trigger risk_status_audit_trigger after update of status on research.risk_register
for each row execute function research.capture_risk_status_event();

create or replace function public.urania_research_review_risk(p_risk_id uuid,p_status text,p_note text)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_row research.risk_register; v_role text;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 v_role:=coalesce(auth.jwt()->'app_metadata'->>'urania_role','');
 if v_role<>'admin' then raise exception 'admin_risk_review_required' using errcode='42501'; end if;
 if p_status not in ('open','mitigating','accepted','resolved','false_positive') or length(trim(coalesce(p_note,'')))<8 then
  raise exception 'risk_review_status_and_note_required' using errcode='22023';
 end if;
 update research.risk_register r set status=p_status,reviewed_by=auth.uid(),reviewed_at=now(),
   mitigation_plan=case when p_status in ('mitigating','resolved','accepted') then coalesce(r.mitigation_plan,'')||case when r.mitigation_plan is null then '' else E'\n' end||trim(p_note) else r.mitigation_plan end
 where r.id=p_risk_id and r.created_by=auth.uid()
 and exists(select 1 from research.opportunities o join research.research_projects p on p.id=o.project_id
   where o.id=r.opportunity_id and p.created_by=auth.uid())
 returning r.* into v_row;
 if not found then raise exception 'risk_not_found_or_not_owned' using errcode='P0002'; end if;
 return jsonb_build_object('id',v_row.id,'status',v_row.status,'reviewed_by',v_row.reviewed_by,'reviewed_at',v_row.reviewed_at);
end $$;
revoke all on function public.urania_research_review_risk(uuid,text,text) from public,anon;
grant execute on function public.urania_research_review_risk(uuid,text,text) to authenticated;
