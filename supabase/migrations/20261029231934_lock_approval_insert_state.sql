drop policy if exists approvals_insert on automation.approvals;
create policy approvals_insert on automation.approvals
for insert to authenticated
with check (
  (select public.urania_role_from_jwt()) = any(array['admin','sales'])
  and requested_by = (select auth.uid())
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);