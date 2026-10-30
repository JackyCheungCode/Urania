drop policy if exists approvals_update on automation.approvals;
revoke update on automation.approvals from authenticated, anon;

create or replace function public.urania_list_approvals(p_limit integer default 50)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, auth, automation
as $$
declare actor uuid; declare actor_role text; declare result jsonb;
begin
  actor := public.urania_require_role(array['admin','sales']);
  actor_role := public.urania_role_from_jwt();
  select coalesce(jsonb_agg(to_jsonb(a) order by a.requested_at desc),'[]'::jsonb)
  into result
  from (
    select id,approval_type,subject_type,subject_id,status,requested_by,reviewed_by,
           review_note,requested_at,reviewed_at,payload
    from automation.approvals
    where actor_role='admin' or requested_by=actor or status='pending'
    order by requested_at desc
    limit greatest(1,least(coalesce(p_limit,50),100))
  ) a;
  return jsonb_build_object('data',result,'count',jsonb_array_length(result));
end;
$$;

create or replace function public.urania_review_approval(p_approval_id uuid,p_decision text,p_review_note text default null)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth, automation, audit
as $$
declare actor uuid; declare approval_row automation.approvals%rowtype; declare updated automation.approvals%rowtype;
begin
  actor := public.urania_require_role(array['admin','sales']);
  if p_decision not in ('approved','rejected') then raise exception 'decision must be approved or rejected' using errcode='22023'; end if;
  if p_review_note is not null and length(p_review_note)>2000 then raise exception 'review note too long' using errcode='22023'; end if;
  select * into approval_row from automation.approvals where id=p_approval_id for update;
  if approval_row.id is null then raise exception 'approval not found' using errcode='P0002'; end if;
  if approval_row.status<>'pending' then raise exception 'approval is no longer pending' using errcode='22023'; end if;
  update automation.approvals set status=p_decision,reviewed_by=actor,reviewed_at=now(),review_note=nullif(btrim(p_review_note),'')
  where id=p_approval_id returning * into updated;
  insert into audit.audit_events(actor_id,action,resource_type,resource_id,details)
  values(actor,'review_approval','automation.approval',updated.id::text,jsonb_build_object('approval_type',updated.approval_type,'decision',updated.status));
  return jsonb_build_object('data',jsonb_build_object('id',updated.id,'status',updated.status,'reviewed_by',updated.reviewed_by,'reviewed_at',updated.reviewed_at));
end;
$$;

revoke all on function public.urania_list_approvals(integer) from public,anon;
revoke all on function public.urania_review_approval(uuid,text,text) from public,anon;
grant execute on function public.urania_list_approvals(integer) to authenticated;
grant execute on function public.urania_review_approval(uuid,text,text) to authenticated;
