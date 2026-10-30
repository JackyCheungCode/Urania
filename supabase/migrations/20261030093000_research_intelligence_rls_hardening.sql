-- Tighten child-row authorization: ownership must follow the parent project/opportunity.
drop policy if exists research_runs_owner_all on research.research_runs;
create policy research_runs_parent_owner_all on research.research_runs for all to authenticated
using (exists (select 1 from research.research_projects p where p.id = project_id and p.created_by = (select auth.uid())))
with check (exists (select 1 from research.research_projects p where p.id = project_id and p.created_by = (select auth.uid())));

drop policy if exists research_findings_owner_all on research.research_findings;
create policy research_findings_parent_owner_all on research.research_findings for all to authenticated
using (exists (select 1 from research.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid())))
with check (exists (select 1 from research.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid())));

drop policy if exists evidence_records_owner_all on research.evidence_records;
create policy evidence_records_parent_owner_all on research.evidence_records for all to authenticated
using (
  exists (select 1 from research.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid()))
  and exists (select 1 from research.evidence_sources s where s.id = evidence_source_id and s.created_by = (select auth.uid()))
)
with check (
  exists (select 1 from research.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid()))
  and exists (select 1 from research.evidence_sources s where s.id = evidence_source_id and s.created_by = (select auth.uid()))
);

drop policy if exists assumptions_owner_all on research.assumptions;
create policy assumptions_parent_owner_all on research.assumptions for all to authenticated
using (exists (select 1 from research.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid())))
with check (exists (select 1 from research.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid())));

drop policy if exists risk_register_owner_all on research.risk_register;
create policy risk_register_parent_owner_all on research.risk_register for all to authenticated
using (exists (select 1 from research.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid())))
with check (exists (select 1 from research.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid())));

drop policy if exists financial_models_owner_all on research.financial_models;
create policy financial_models_parent_owner_all on research.financial_models for all to authenticated
using (exists (select 1 from research.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid())))
with check (exists (select 1 from research.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid())));

drop policy if exists investment_decisions_owner_all on research.investment_decisions;
create policy investment_decisions_parent_owner_all on research.investment_decisions for all to authenticated
using (exists (select 1 from research.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid())))
with check (exists (select 1 from research.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid())));

drop policy if exists decision_audit_logs_owner_read on research.decision_audit_logs;
create policy decision_audit_logs_parent_owner_read on research.decision_audit_logs for select to authenticated
using (exists (
  select 1 from research.investment_decisions d
  join research.opportunities o on o.id = d.opportunity_id
  where d.id = decision_id and o.created_by = (select auth.uid())
));
