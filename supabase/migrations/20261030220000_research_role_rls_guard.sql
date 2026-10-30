-- Enforce researcher/admin authorization at the database boundary as well as the Worker allowlist.
do $$
declare tbl text;
begin
 foreach tbl in array array[
  'research_projects','opportunities','research_runs','research_findings','evidence_sources',
  'evidence_records','assumptions','risk_register','financial_models','investment_decisions',
  'decision_audit_logs','evidence_verification_events','risk_audit_events'
 ] loop
  execute format(
   'create policy %I on research.%I as restrictive for all to authenticated using (coalesce(auth.jwt()->''app_metadata''->>''urania_role'','''') in (''admin'',''researcher'')) with check (coalesce(auth.jwt()->''app_metadata''->>''urania_role'','''') in (''admin'',''researcher''))',
   'research_role_gate_'||tbl,tbl
  );
 end loop;
end $$;
