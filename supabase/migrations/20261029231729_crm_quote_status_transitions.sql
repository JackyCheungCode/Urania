create or replace function public.urania_set_quote_status(p_quote_id uuid,p_status text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, crm, audit
as $$
declare actor uuid; role_name text; previous crm.quotes%rowtype; updated crm.quotes%rowtype; transition_allowed boolean := false;
begin
  actor := public.urania_require_role(array['admin','sales']);
  role_name := public.urania_role_from_jwt();
  if p_status not in ('draft','in_review','approved','sent','accepted','rejected','expired') then
    raise exception 'invalid quote status' using errcode='22023';
  end if;
  select * into previous from crm.quotes where id=p_quote_id for update;
  if previous.id is null then raise exception 'quote not found' using errcode='P0002'; end if;
  if role_name='sales' then
    if previous.created_by is distinct from actor then raise exception 'forbidden' using errcode='42501'; end if;
    transition_allowed := case previous.status
      when 'draft' then p_status='in_review'
      when 'in_review' then p_status in ('approved','rejected')
      when 'approved' then p_status='sent'
      when 'sent' then p_status in ('accepted','rejected','expired')
      else false
    end;
    if not transition_allowed then raise exception 'invalid quote status transition' using errcode='22023'; end if;
  end if;
  update crm.quotes set status=p_status,updated_at=now() where id=p_quote_id returning * into updated;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'quote_status_change','crm.quote',updated.id::text,jsonb_build_object('from',previous.status,'to',updated.status));
  return jsonb_build_object('data',jsonb_build_object('id',updated.id,'quote_number',updated.quote_number,'status',updated.status));
end;
$$;
revoke all on function public.urania_set_quote_status(uuid,text) from public,anon;
grant execute on function public.urania_set_quote_status(uuid,text) to authenticated;
