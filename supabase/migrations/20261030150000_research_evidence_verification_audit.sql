-- Human verification updates and immutable evidence status history.
create table if not exists research.evidence_verification_events (
  id bigint generated always as identity primary key,
  evidence_record_id uuid not null references research.evidence_records(id) on delete cascade,
  previous_status text not null,
  new_status text not null check (new_status in ('human_verified','disputed','rejected')),
  note text not null,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists evidence_verification_events_record_time_idx
  on research.evidence_verification_events(evidence_record_id,created_at desc);
alter table research.evidence_verification_events enable row level security;
create policy evidence_verification_events_owner_read on research.evidence_verification_events
  for select to authenticated using (
    exists(select 1 from research.evidence_records e
      join research.opportunities o on o.id=e.opportunity_id
      join research.research_projects p on p.id=o.project_id
      where e.id=evidence_record_id and p.created_by=(select auth.uid()))
  );
grant select on research.evidence_verification_events to authenticated;
grant usage,select on sequence research.evidence_verification_events_id_seq to authenticated;

create or replace function research.capture_evidence_verification_event()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.verification_status is distinct from old.verification_status then
    insert into research.evidence_verification_events(
      evidence_record_id,previous_status,new_status,note,actor_id
    ) values (
      new.id,old.verification_status,new.verification_status,
      coalesce(nullif(current_setting('request.jwt.claims',true)::jsonb->>'verification_note',''),'Status changed through an authorized database update.'),
      coalesce(auth.uid(),new.verified_by,new.created_by)
    );
  end if;
  return new;
end $$;
revoke all on function research.capture_evidence_verification_event() from public,anon,authenticated;
drop trigger if exists evidence_verification_audit_trigger on research.evidence_records;
create trigger evidence_verification_audit_trigger
after update of verification_status on research.evidence_records
for each row execute function research.capture_evidence_verification_event();

create or replace function public.urania_research_verify_evidence(
  p_evidence_id uuid,p_status text,p_note text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_row research.evidence_records;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_status not in ('human_verified','disputed','rejected') or length(trim(coalesce(p_note,'')))<8 then
    raise exception 'verification_status_and_note_required' using errcode='22023';
  end if;
  update research.evidence_records e
  set verification_status=p_status,verified_by=auth.uid(),verified_at=now(),
      raw_payload=coalesce(e.raw_payload,'{}'::jsonb)||jsonb_build_object('verification_note',trim(p_note))
  where e.id=p_evidence_id and e.created_by=auth.uid()
    and exists(select 1 from research.opportunities o
      join research.research_projects p on p.id=o.project_id
      where o.id=e.opportunity_id and p.created_by=auth.uid())
  returning e.* into v_row;
  if not found then raise exception 'evidence_not_found_or_not_owned' using errcode='P0002'; end if;
  return jsonb_build_object('id',v_row.id,'verification_status',v_row.verification_status,
    'verified_by',v_row.verified_by,'verified_at',v_row.verified_at);
end $$;
revoke all on function public.urania_research_verify_evidence(uuid,text,text) from public,anon;
grant execute on function public.urania_research_verify_evidence(uuid,text,text) to authenticated;
