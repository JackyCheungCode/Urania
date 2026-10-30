-- Organization tenancy for research workspaces. Existing owner-only projects remain accessible.
create table if not exists research.organizations(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 160),
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists research.organization_members(
 organization_id uuid not null references research.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','researcher','reviewer','viewer')),
 invited_by uuid references auth.users(id),
 joined_at timestamptz not null default now(),
 primary key(organization_id,user_id)
);
alter table research.research_projects add column if not exists organization_id uuid references research.organizations(id) on delete restrict;
create index if not exists research_projects_org_idx on research.research_projects(organization_id);
create index if not exists organization_members_user_idx on research.organization_members(user_id,organization_id);
alter table research.organizations enable row level security;
alter table research.organization_members enable row level security;
create or replace function research.can_access_project(p_project_id uuid,p_min_role text default 'viewer')
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from research.research_projects p
  where p.id=p_project_id and (
   (p.organization_id is null and p.created_by=(select auth.uid()))
   or exists(select 1 from research.organization_members m where m.organization_id=p.organization_id and m.user_id=(select auth.uid())
    and case p_min_role when 'owner' then m.role='owner' when 'admin' then m.role in ('owner','admin')
     when 'researcher' then m.role in ('owner','admin','researcher') when 'reviewer' then m.role in ('owner','admin','researcher','reviewer')
     else m.role in ('owner','admin','researcher','reviewer','viewer') end)
  )
 )
$$;
revoke all on function research.can_access_project(uuid,text) from public,anon;
grant execute on function research.can_access_project(uuid,text) to authenticated;
drop policy if exists research_projects_owner_all on research.research_projects;
create policy research_projects_org_read on research.research_projects for select to authenticated
using (research.can_access_project(id,'viewer'));
create policy research_projects_org_insert on research.research_projects for insert to authenticated
with check (created_by=(select auth.uid()) and (organization_id is null or exists(select 1 from research.organization_members m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))));
create policy research_projects_org_update on research.research_projects for update to authenticated
using (research.can_access_project(id,'admin')) with check (research.can_access_project(id,'admin'));
create policy research_projects_org_delete on research.research_projects for delete to authenticated
using (research.can_access_project(id,'owner'));
drop policy if exists organizations_member_read on research.organizations;
create policy organizations_member_read on research.organizations for select to authenticated
using (exists(select 1 from research.organization_members m where m.organization_id=id and m.user_id=(select auth.uid())));
drop policy if exists organizations_owner_insert on research.organizations;
create policy organizations_owner_insert on research.organizations for insert to authenticated
with check(created_by=(select auth.uid()));
drop policy if exists organization_members_member_read on research.organization_members;
create policy organization_members_member_read on research.organization_members for select to authenticated
using(exists(select 1 from research.organization_members m where m.organization_id=organization_id and m.user_id=(select auth.uid())));
drop policy if exists organization_members_admin_manage on research.organization_members;
create policy organization_members_admin_manage on research.organization_members for all to authenticated
using(exists(select 1 from research.organization_members m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
with check(exists(select 1 from research.organization_members m where m.organization_id=organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
-- Replace owner predicates on all child tables with project membership checks.
drop policy if exists research_runs_parent_owner_all on research.research_runs;
create policy research_runs_org_all on research.research_runs for all to authenticated
using(research.can_access_project(project_id,'researcher')) with check(research.can_access_project(project_id,'researcher'));
drop policy if exists research_findings_parent_owner_all on research.research_findings;
create policy research_findings_org_all on research.research_findings for all to authenticated
using(exists(select 1 from research.opportunities o where o.id=opportunity_id and research.can_access_project(o.project_id,'researcher')))
with check(exists(select 1 from research.opportunities o where o.id=opportunity_id and research.can_access_project(o.project_id,'researcher')));
drop policy if exists evidence_records_parent_owner_all on research.evidence_records;
create policy evidence_records_org_all on research.evidence_records for all to authenticated
using(exists(select 1 from research.opportunities o where o.id=opportunity_id and research.can_access_project(o.project_id,'researcher'))
 and exists(select 1 from research.evidence_sources s where s.id=evidence_source_id and (s.created_by=(select auth.uid()) or exists(select 1 from research.organization_members m join research.opportunities o on o.id=opportunity_id where m.organization_id=(select p.organization_id from research.research_projects p where p.id=o.project_id) and m.user_id=s.created_by))))
with check(exists(select 1 from research.opportunities o where o.id=opportunity_id and research.can_access_project(o.project_id,'researcher'))
 and exists(select 1 from research.evidence_sources s where s.id=evidence_source_id and (s.created_by=(select auth.uid()) or exists(select 1 from research.organization_members m join research.research_projects p on p.organization_id=m.organization_id join research.opportunities o on o.project_id=p.id where o.id=opportunity_id and m.user_id=s.created_by))));
drop policy if exists assumptions_parent_owner_all on research.assumptions;
create policy assumptions_org_all on research.assumptions for all to authenticated
using(exists(select 1 from research.opportunities o where o.id=opportunity_id and research.can_access_project(o.project_id,'researcher')))
with check(exists(select 1 from research.opportunities o where o.id=opportunity_id and research.can_access_project(o.project_id,'researcher')));
drop policy if exists risk_register_parent_owner_all on research.risk_register;
create policy risk_register_org_all on research.risk_register for all to authenticated
using(exists(select 1 from research.opportunities o where o.id=opportunity_id and research.can_access_project(o.project_id,'researcher')))
with check(exists(select 1 from research.opportunities o where o.id=opportunity_id and research.can_access_project(o.project_id,'researcher')));
drop policy if exists financial_models_parent_owner_all on research.financial_models;
create policy financial_models_org_all on research.financial_models for all to authenticated
using(exists(select 1 from research.opportunities o where o.id=opportunity_id and research.can_access_project(o.project_id,'researcher')))
with check(exists(select 1 from research.opportunities o where o.id=opportunity_id and research.can_access_project(o.project_id,'researcher')));
drop policy if exists investment_decisions_parent_owner_all on research.investment_decisions;
create policy investment_decisions_org_all on research.investment_decisions for all to authenticated
using(exists(select 1 from research.opportunities o where o.id=opportunity_id and research.can_access_project(o.project_id,'reviewer')))
with check(exists(select 1 from research.opportunities o where o.id=opportunity_id and research.can_access_project(o.project_id,'researcher')));
