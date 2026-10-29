create or replace function public.urania_create_email_approval(p_contact_id uuid,p_subject text,p_body text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, auth, crm, automation, audit
as $$
declare actor uuid; role_name text; contact_row crm.contacts%rowtype; account_owner uuid;
declare draft_id uuid := gen_random_uuid(); approval_row automation.approvals%rowtype;
begin
  actor := public.urania_require_role(array['admin','sales']);
  role_name := public.urania_role_from_jwt();
  if p_contact_id is null then raise exception 'contact_id required' using errcode='22023'; end if;
  if p_subject is null or length(btrim(p_subject))<3 or length(p_subject)>240 then raise exception 'invalid email subject' using errcode='22023'; end if;
  if p_body is null or length(btrim(p_body))<20 or length(p_body)>12000 then raise exception 'invalid email body' using errcode='22023'; end if;
  select * into contact_row from crm.contacts where id=p_contact_id and deleted_at is null for share;
  if contact_row.id is null then raise exception 'contact not found' using errcode='P0002'; end if;
  if role_name='sales' then
    select owner_id into account_owner from crm.accounts where id=contact_row.account_id and deleted_at is null;
    if contact_row.owner_id is distinct from actor and contact_row.created_by is distinct from actor and account_owner is distinct from actor then
      raise exception 'forbidden' using errcode='42501';
    end if;
  end if;
  if contact_row.do_not_contact then raise exception 'contact is marked do_not_contact' using errcode='42501'; end if;
  if contact_row.work_email is null or btrim(contact_row.work_email)='' then raise exception 'contact has no work email' using errcode='22023'; end if;
  if contact_row.lawful_basis is null or btrim(contact_row.lawful_basis)='' then raise exception 'contact lawful basis is required' using errcode='22023'; end if;
  insert into automation.approvals(approval_type,subject_type,subject_id,status,requested_by,payload)
  values('outbound_email','email_draft',draft_id,'pending',actor,
    jsonb_build_object('contact_id',contact_row.id,'to',contact_row.work_email,'subject',btrim(p_subject),'body',btrim(p_body),'first_contact',true,'send_authorized',false))
  returning * into approval_row;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'request_approval','automation.approval',approval_row.id::text,
    jsonb_build_object('approval_type','outbound_email','contact_id',contact_row.id,'send_authorized',false));
  return jsonb_build_object('data',jsonb_build_object('id',approval_row.id,'subject_id',draft_id,'status',approval_row.status,'requested_at',approval_row.requested_at));
end;
$$;

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
       or contact_row.work_email is distinct from approval_row.payload->>'to' or contact_row.lawful_basis is null then
      raise exception 'email draft is no longer eligible for approval; re-check contact and lawful basis' using errcode='42501';
    end if;
  end if;
  update automation.approvals set status=p_decision,reviewed_by=actor,reviewed_at=now(),review_note=nullif(btrim(p_review_note),'')
  where id=p_approval_id returning * into updated;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'review_approval','automation.approval',updated.id::text,jsonb_build_object('approval_type',updated.approval_type,'decision',updated.status));
  return jsonb_build_object('data',jsonb_build_object('id',updated.id,'status',updated.status,'reviewed_by',updated.reviewed_by,'reviewed_at',updated.reviewed_at));
end;
$$;
revoke all on function public.urania_create_email_approval(uuid,text,text) from public,anon;
grant execute on function public.urania_create_email_approval(uuid,text,text) to authenticated;
revoke all on function public.urania_review_approval(uuid,text,text) from public,anon;
grant execute on function public.urania_review_approval(uuid,text,text) to authenticated;
