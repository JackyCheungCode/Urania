-- Switch user-facing business RPCs to SECURITY INVOKER and enforce access in RLS.
-- Internal queue RPCs remain SECURITY DEFINER but are executable only by service_role.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'urania_require_role','urania_role_from_jwt',
      'urania_list_accounts','urania_create_account','urania_list_leads','urania_create_lead',
      'urania_list_products','urania_list_data_sources','urania_create_collection_job','urania_create_product',
      'urania_set_provider_state','urania_list_contacts','urania_create_contact','urania_list_opportunities',
      'urania_create_opportunity','urania_list_activities','urania_create_activity','urania_list_quotes',
      'urania_create_quote','urania_set_quote_status','urania_list_orders','urania_create_order',
      'urania_enforce_crm_account_scope'
    )
  loop
    execute format('alter function %s security invoker',f.signature);
  end loop;
end $$;

grant execute on function public.urania_role_from_jwt() to authenticated;
grant execute on function public.urania_require_role(text[]) to authenticated;

grant usage on schema research,crm,integrations,automation,audit to authenticated;
grant select,insert,update,delete on all tables in schema research,crm,integrations,automation,audit to authenticated;
grant usage,select on all sequences in schema research,crm,integrations,automation,audit to authenticated;

-- CRM accounts: sales reps see their own and unassigned accounts; researchers/admins may research all accounts.
drop policy if exists accounts_read on crm.accounts;
create policy accounts_read on crm.accounts for select to authenticated using (
  public.urania_role_from_jwt() in ('admin','researcher') or
  (public.urania_role_from_jwt()='sales' and (owner_id=auth.uid() or owner_id is null))
);
drop policy if exists accounts_insert on crm.accounts;
create policy accounts_insert on crm.accounts for insert to authenticated with check (
  public.urania_role_from_jwt()='admin' or
  (public.urania_role_from_jwt()='sales' and owner_id=auth.uid())
);
drop policy if exists accounts_update on crm.accounts;
create policy accounts_update on crm.accounts for update to authenticated using (
  public.urania_role_from_jwt()='admin' or
  (public.urania_role_from_jwt()='sales' and (owner_id=auth.uid() or owner_id is null))
) with check (
  public.urania_role_from_jwt()='admin' or
  (public.urania_role_from_jwt()='sales' and owner_id=auth.uid())
);
drop policy if exists accounts_delete on crm.accounts;
create policy accounts_delete on crm.accounts for delete to authenticated using (public.urania_role_from_jwt()='admin');

-- Contacts are restricted to sales/admin and owner scope.
drop policy if exists contacts_read on crm.contacts;
create policy contacts_read on crm.contacts for select to authenticated using (
  public.urania_role_from_jwt()='admin' or
  (public.urania_role_from_jwt()='sales' and (owner_id=auth.uid() or owner_id is null))
);
drop policy if exists contacts_insert on crm.contacts;
create policy contacts_insert on crm.contacts for insert to authenticated with check (
  public.urania_role_from_jwt()='admin' or
  (public.urania_role_from_jwt()='sales' and owner_id=auth.uid())
);
drop policy if exists contacts_update on crm.contacts;
create policy contacts_update on crm.contacts for update to authenticated using (
  public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and owner_id=auth.uid())
) with check (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and owner_id=auth.uid()));
drop policy if exists contacts_delete on crm.contacts;
create policy contacts_delete on crm.contacts for delete to authenticated using (public.urania_role_from_jwt()='admin');

-- Leads
drop policy if exists leads_read on crm.leads;
create policy leads_read on crm.leads for select to authenticated using (
  public.urania_role_from_jwt() in ('admin','researcher') or
  (public.urania_role_from_jwt()='sales' and (owner_id=auth.uid() or owner_id is null))
);
drop policy if exists leads_insert on crm.leads;
create policy leads_insert on crm.leads for insert to authenticated with check (
  public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and owner_id=auth.uid())
);
drop policy if exists leads_update on crm.leads;
create policy leads_update on crm.leads for update to authenticated using (
  public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and owner_id=auth.uid())
) with check (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and owner_id=auth.uid()));
drop policy if exists leads_delete on crm.leads;
create policy leads_delete on crm.leads for delete to authenticated using (public.urania_role_from_jwt()='admin');

-- Opportunities
drop policy if exists opportunities_read on crm.opportunities;
create policy opportunities_read on crm.opportunities for select to authenticated using (
  public.urania_role_from_jwt()='admin' or
  (public.urania_role_from_jwt()='sales' and (owner_id=auth.uid() or owner_id is null))
);
drop policy if exists opportunities_insert on crm.opportunities;
create policy opportunities_insert on crm.opportunities for insert to authenticated with check (
  public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and owner_id=auth.uid())
);
drop policy if exists opportunities_update on crm.opportunities;
create policy opportunities_update on crm.opportunities for update to authenticated using (
  public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and owner_id=auth.uid())
) with check (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and owner_id=auth.uid()));
drop policy if exists opportunities_delete on crm.opportunities;
create policy opportunities_delete on crm.opportunities for delete to authenticated using (public.urania_role_from_jwt()='admin');

-- Activities, quotes, and orders are owner-scoped for sales.
drop policy if exists activities_read on crm.activities;
create policy activities_read on crm.activities for select to authenticated using (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and created_by=auth.uid()));
drop policy if exists activities_insert on crm.activities;
create policy activities_insert on crm.activities for insert to authenticated with check (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and created_by=auth.uid()));
drop policy if exists activities_update on crm.activities;
create policy activities_update on crm.activities for update to authenticated using (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and created_by=auth.uid())) with check (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and created_by=auth.uid()));
drop policy if exists activities_delete on crm.activities;
create policy activities_delete on crm.activities for delete to authenticated using (public.urania_role_from_jwt()='admin');

drop policy if exists quotes_read on crm.quotes;
create policy quotes_read on crm.quotes for select to authenticated using (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and created_by=auth.uid()));
drop policy if exists quotes_insert on crm.quotes;
create policy quotes_insert on crm.quotes for insert to authenticated with check (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and created_by=auth.uid()));
drop policy if exists quotes_update on crm.quotes;
create policy quotes_update on crm.quotes for update to authenticated using (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and created_by=auth.uid())) with check (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and created_by=auth.uid()));
drop policy if exists quotes_delete on crm.quotes;
create policy quotes_delete on crm.quotes for delete to authenticated using (public.urania_role_from_jwt()='admin');

drop policy if exists quote_items_read on crm.quote_items;
create policy quote_items_read on crm.quote_items for select to authenticated using (
  exists(select 1 from crm.quotes q where q.id=quote_id and (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and q.created_by=auth.uid())))
);
drop policy if exists quote_items_insert on crm.quote_items;
create policy quote_items_insert on crm.quote_items for insert to authenticated with check (
  exists(select 1 from crm.quotes q where q.id=quote_id and (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and q.created_by=auth.uid())))
);
drop policy if exists quote_items_update on crm.quote_items;
create policy quote_items_update on crm.quote_items for update to authenticated using (
  exists(select 1 from crm.quotes q where q.id=quote_id and (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and q.created_by=auth.uid())))
) with check (
  exists(select 1 from crm.quotes q where q.id=quote_id and (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and q.created_by=auth.uid())))
);
drop policy if exists quote_items_delete on crm.quote_items;
create policy quote_items_delete on crm.quote_items for delete to authenticated using (public.urania_role_from_jwt()='admin');

drop policy if exists orders_read on crm.orders;
create policy orders_read on crm.orders for select to authenticated using (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and created_by=auth.uid()));
drop policy if exists orders_insert on crm.orders;
create policy orders_insert on crm.orders for insert to authenticated with check (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and created_by=auth.uid()));
drop policy if exists orders_update on crm.orders;
create policy orders_update on crm.orders for update to authenticated using (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and created_by=auth.uid())) with check (public.urania_role_from_jwt()='admin' or (public.urania_role_from_jwt()='sales' and created_by=auth.uid()));
drop policy if exists orders_delete on crm.orders;
create policy orders_delete on crm.orders for delete to authenticated using (public.urania_role_from_jwt()='admin');

-- Product research data: all roles can read normalized products; research roles manage evidence.
drop policy if exists products_read on research.products;
create policy products_read on research.products for select to authenticated using (public.urania_role_from_jwt() in ('admin','researcher','sales'));
drop policy if exists products_insert on research.products;
create policy products_insert on research.products for insert to authenticated with check (public.urania_role_from_jwt() in ('admin','researcher'));
drop policy if exists products_update on research.products;
create policy products_update on research.products for update to authenticated using (public.urania_role_from_jwt() in ('admin','researcher')) with check (public.urania_role_from_jwt() in ('admin','researcher'));
drop policy if exists products_delete on research.products;
create policy products_delete on research.products for delete to authenticated using (public.urania_role_from_jwt()='admin');

do $$
declare tbl text;
begin
  foreach tbl in array array['product_identifiers','product_offers','observations','suppliers','supplier_quotes','product_scores','ai_reports'] loop
    execute format('drop policy if exists %I_read on research.%I',tbl,tbl);
    execute format('create policy %I_read on research.%I for select to authenticated using (public.urania_role_from_jwt() in (''admin'',''researcher'',''sales''))',tbl,tbl);
    execute format('drop policy if exists %I_insert on research.%I',tbl,tbl);
    execute format('create policy %I_insert on research.%I for insert to authenticated with check (public.urania_role_from_jwt() in (''admin'',''researcher''))',tbl,tbl);
    execute format('drop policy if exists %I_update on research.%I',tbl,tbl);
    execute format('create policy %I_update on research.%I for update to authenticated using (public.urania_role_from_jwt() in (''admin'',''researcher'')) with check (public.urania_role_from_jwt() in (''admin'',''researcher''))',tbl,tbl);
    execute format('drop policy if exists %I_delete on research.%I',tbl,tbl);
    execute format('create policy %I_delete on research.%I for delete to authenticated using (public.urania_role_from_jwt()=''admin'')',tbl,tbl);
  end loop;
end $$;

drop policy if exists search_results_read on research.search_results;
create policy search_results_read on research.search_results for select to authenticated using (public.urania_role_from_jwt() in ('admin','researcher','sales'));

drop policy if exists data_sources_read on integrations.data_sources;
create policy data_sources_read on integrations.data_sources for select to authenticated using (public.urania_role_from_jwt() in ('admin','researcher'));
drop policy if exists data_sources_insert on integrations.data_sources;
create policy data_sources_insert on integrations.data_sources for insert to authenticated with check (public.urania_role_from_jwt()='admin');
drop policy if exists data_sources_update on integrations.data_sources;
create policy data_sources_update on integrations.data_sources for update to authenticated using (public.urania_role_from_jwt()='admin') with check (public.urania_role_from_jwt()='admin');
drop policy if exists data_sources_delete on integrations.data_sources;
create policy data_sources_delete on integrations.data_sources for delete to authenticated using (public.urania_role_from_jwt()='admin');

drop policy if exists usage_events_read on integrations.usage_events;
create policy usage_events_read on integrations.usage_events for select to authenticated using (public.urania_role_from_jwt() in ('admin','researcher'));

drop policy if exists collection_jobs_read on automation.collection_jobs;
create policy collection_jobs_read on automation.collection_jobs for select to authenticated using (public.urania_role_from_jwt() in ('admin','researcher'));
drop policy if exists collection_jobs_insert on automation.collection_jobs;
create policy collection_jobs_insert on automation.collection_jobs for insert to authenticated with check (public.urania_role_from_jwt() in ('admin','researcher') and created_by=auth.uid());
drop policy if exists collection_jobs_update on automation.collection_jobs;
create policy collection_jobs_update on automation.collection_jobs for update to authenticated using (public.urania_role_from_jwt() in ('admin','researcher')) with check (public.urania_role_from_jwt() in ('admin','researcher'));

drop policy if exists task_runs_read on automation.task_runs;
create policy task_runs_read on automation.task_runs for select to authenticated using (public.urania_role_from_jwt() in ('admin','researcher'));
drop policy if exists approvals_read on automation.approvals;
create policy approvals_read on automation.approvals for select to authenticated using (public.urania_role_from_jwt() in ('admin','sales'));
drop policy if exists approvals_insert on automation.approvals;
create policy approvals_insert on automation.approvals for insert to authenticated with check (public.urania_role_from_jwt() in ('admin','sales') and requested_by=auth.uid());
drop policy if exists approvals_update on automation.approvals;
create policy approvals_update on automation.approvals for update to authenticated using (public.urania_role_from_jwt() in ('admin','sales')) with check (public.urania_role_from_jwt() in ('admin','sales'));

drop policy if exists audit_read on audit.audit_events;
create policy audit_read on audit.audit_events for select to authenticated using (public.urania_role_from_jwt()='admin');
drop policy if exists audit_insert on audit.audit_events;
create policy audit_insert on audit.audit_events for insert to authenticated with check (actor_id=auth.uid() and public.urania_role_from_jwt() in ('admin','researcher','sales'));
