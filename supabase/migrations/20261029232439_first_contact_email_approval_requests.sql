create or replace function public.urania_create_email_approval(p_contact_id uuid,p_subject text,p_body text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, crm, automation, audit
as $$
declare actor uuid; contact_row crm.contacts%rowtype; draft_id uuid := gen_random_uuid(); approval_row automation.approvals%rowtype;
begin
  actor := public.urania_require_role(array['admin','sales']);
  if p_contact_id is null then raise exception 'contact_id required' using errcode='22023'; end if;
  if p_subject is null or length(btrim(p_subject))<3 or length(p_subject)>240 then
    raise exception 'email subject must be between 3 and 240 characters' using errcode='22023';
  end if;
  if p_body is null or length(btrim(p_body))<20 or length(p_body)>12000 then
    raise exception 'email body must be between 20 and 12000 characters' using errcode='22023';
  end if;
  select * into contact_row from crm.contacts where id=p_contact_id and deleted_at is null for share;
  if contact_row.id is null then raise exception 'contact not found' using errcode='P0002'; end if;
  if contact_row.do_not_contact then raise exception 'contact is marked do_not_contact' using errcode='42501'; end if;
  if contact_row.work_email is null or btrim(contact_row.work_email)='' then
    raise exception 'contact has no work email' using errcode='22023';
  end if;
  if contact_row.lawful_basis is null or btrim(contact_row.lawful_basis)='' then
    raise exception 'contact lawful basis is required' using errcode='22023';
  end if;
  insert into automation.approvals(approval_type,subject_type,subject_id,status,requested_by,payload)
  values('outbound_email','email_draft',draft_id,'pending',actor,
    jsonb_build_object('contact_id',contact_row.id,'to',contact_row.work_email,'subject',btrim(p_subject),
      'body',btrim(p_body),'first_contact',true,'send_authorized',false))
  returning * into approval_row;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'request_approval','automation.approval',approval_row.id::text,
    jsonb_build_object('approval_type','outbound_email','contact_id',contact_row.id,'send_authorized',false));
  return jsonb_build_object('data',jsonb_build_object('id',approval_row.id,'subject_id',draft_id,
    'status',approval_row.status,'requested_at',approval_row.requested_at));
end;
$$;
revoke all on function public.urania_create_email_approval(uuid,text,text) from public,anon;
grant execute on function public.urania_create_email_approval(uuid,text,text) to authenticated;
