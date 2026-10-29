drop policy if exists approvals_insert on automation.approvals;
create policy approvals_insert on automation.approvals
for insert to authenticated
with check (
  (select public.urania_role_from_jwt()) = any(array['admin','sales'])
  and requested_by = (select auth.uid())
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and approval_type <> 'outbound_email'
);

create or replace function public.urania_review_approval(p_approval_id uuid,p_decision text,p_review_note text default null)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth, crm, automation, audit
as $$
declare actor uuid; declare approval_row automation.approvals%rowtype; declare updated automation.approvals%rowtype;
declare contact_row crm.contacts%rowtype; declare contact_id_value uuid;
begin
  actor := public.urania_require_role(array['admin','sales']);
  if p_decision not in ('approved','rejected') then raise exception 'decision must be approved or rejected' using errcode='22023'; end if;
  if p_review_note is not null and length(p_review_note)>2000 then raise exception 'review note too long' using errcode='22023'; end if;
  select * into approval_row from automation.approvals where id=p_approval_id for update;
  if approval_row.id is null then raise exception 'approval not found' using errcode='P0002'; end if;
  if approval_row.status<>'pending' then raise exception 'approval is no longer pending' using errcode='22023'; end if;
  if p_decision='approved' and approval_row.approval_type='outbound_email' then
    contact_id_value := nullif(approval_row.payload->>'contact_id','')::uuid;
    select * into contact_row from crm.contacts where id=contact_id_value and deleted_at is null for share;
    if contact_row.id is null or contact_row.do_not_contact or contact_row.work_email is null
       or contact_row.work_email is distinct from approval_row.payload->>'to' or contact_row.lawful_basis is null
       or length(coalesce(approval_row.payload->>'subject',''))<3
       or length(coalesce(approval_row.payload->>'body',''))<20
       or coalesce((approval_row.payload->>'first_contact')::boolean,false) is not true
       or coalesce((approval_row.payload->>'send_authorized')::boolean,true) is not false then
      raise exception 'email draft is no longer eligible for approval; re-check contact and draft content' using errcode='42501';
    end if;
  end if;
  update automation.approvals set status=p_decision,reviewed_by=actor,reviewed_at=now(),review_note=nullif(btrim(p_review_note),'')
  where id=p_approval_id returning * into updated;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'review_approval','automation.approval',updated.id::text,jsonb_build_object('approval_type',updated.approval_type,'decision',updated.status));
  return jsonb_build_object('data',jsonb_build_object('id',updated.id,'status',updated.status,'reviewed_by',updated.reviewed_by,'reviewed_at',updated.reviewed_at));
end;
$$;
revoke all on function public.urania_review_approval(uuid,text,text) from public,anon;
grant execute on function public.urania_review_approval(uuid,text,text) to authenticated;
