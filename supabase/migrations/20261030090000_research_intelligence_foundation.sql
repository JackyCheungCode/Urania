-- Urania research intelligence foundation (additive; preserves existing CRM/research tables)
-- Apply only after review. All records are owner-scoped; service-side workers must use service credentials.
create table if not exists research.research_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  objective text not null,
  scope_type text not null default 'global' check (scope_type in ('global','regional','country','industry')),
  geographies text[] not null default '{}',
  industries text[] not null default '{}',
  investment_horizon text not null default '1_3y' check (investment_horizon in ('under_1y','1_3y','3_5y','over_5y')),
  investment_budget jsonb not null default '{}'::jsonb,
  approval_policy text not null default 'tiered' check (approval_policy in ('owner','committee','tiered')),
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists research.opportunities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references research.research_projects(id) on delete cascade,
  product_id uuid references research.products(id) on delete set null,
  title text not null,
  summary text,
  opportunity_type text not null default 'product' check (opportunity_type in ('product','software','service','technology','industry','business_model','other')),
  target_markets text[] not null default '{}',
  stage text not null default 'discovered' check (stage in ('discovered','standardizing','demand_validation','competition_customer','supply_chain','compliance_risk','financial_modeling','investment_assessment','decision_pending','approved','rejected','on_hold')),
  decision_status text not null default 'undecided' check (decision_status in ('undecided','invest','validate_more','defer','reject')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists research.research_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references research.research_projects(id) on delete cascade,
  opportunity_id uuid references research.opportunities(id) on delete cascade,
  run_type text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','partial','failed','cancelled')),
  model_provider text,
  model_name text,
  prompt_version text,
  input_scope jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists research.research_findings (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references research.opportunities(id) on delete cascade,
  stage text not null check (stage in ('discovery','standardization','demand','competition','customer','supply_chain','compliance','financial','investment','monitoring')),
  finding_type text not null default 'claim' check (finding_type in ('claim','observation','estimate','contradiction','gap')),
  claim text not null,
  explanation text,
  evidence_status text not null default 'insufficient' check (evidence_status in ('insufficient','supported','contested','verified','rejected')),
  confidence numeric(5,4) check (confidence between 0 and 1),
  freshness_status text not null default 'unknown' check (freshness_status in ('fresh','aging','stale','unknown')),
  model_generated boolean not null default false,
  research_run_id uuid references research.research_runs(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists research.evidence_sources (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references integrations.data_sources(id) on delete set null,
  publisher text,
  source_type text not null default 'web' check (source_type in ('transaction','government','industry_report','academic','web','interview','survey','supplier_document','financial_filing','other')),
  source_url text,
  title text,
  license_name text,
  license_scope text,
  retention_days integer check (retention_days is null or retention_days > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists research.evidence_records (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid references research.research_findings(id) on delete cascade,
  opportunity_id uuid not null references research.opportunities(id) on delete cascade,
  evidence_source_id uuid not null references research.evidence_sources(id) on delete restrict,
  evidence_class text not null check (evidence_class in ('observed_transaction','observed_behavior','proxy_indicator','model_estimate','expert_opinion','primary_research')),
  claim_supported text not null,
  metric_name text,
  metric_value numeric,
  metric_unit text,
  geography text,
  published_at timestamptz,
  observed_at timestamptz,
  collected_at timestamptz not null default now(),
  methodology text,
  raw_excerpt text,
  raw_payload jsonb not null default '{}'::jsonb,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','machine_checked','human_verified','disputed','rejected')),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  confidence numeric(5,4) check (confidence between 0 and 1),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists research.assumptions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references research.opportunities(id) on delete cascade,
  assumption_key text not null,
  assumption_value jsonb not null,
  rationale text,
  source_evidence_ids uuid[] not null default '{}',
  sensitivity text not null default 'medium' check (sensitivity in ('low','medium','high','critical')),
  status text not null default 'unverified' check (status in ('unverified','validated','rejected','superseded')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (opportunity_id, assumption_key, version)
);

create table if not exists research.risk_register (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references research.opportunities(id) on delete cascade,
  risk_category text not null check (risk_category in ('legal','regulatory','sanctions','ip','safety','environmental','labor','supplier','market','financial','execution','reputation','other')),
  description text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  likelihood text not null default 'medium' check (likelihood in ('low','medium','high','unknown')),
  hard_veto boolean not null default false,
  status text not null default 'open' check (status in ('open','mitigating','accepted','resolved','false_positive')),
  evidence_record_ids uuid[] not null default '{}',
  mitigation_plan text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists research.financial_models (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references research.opportunities(id) on delete cascade,
  model_version integer not null default 1 check (model_version > 0),
  currency char(3) not null default 'USD',
  horizon_months integer not null default 36 check (horizon_months between 1 and 240),
  assumptions_snapshot jsonb not null default '{}'::jsonb,
  inputs jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  calculation_engine_version text not null,
  status text not null default 'draft' check (status in ('draft','calculated','reviewed','superseded')),
  calculated_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (opportunity_id, model_version)
);

create table if not exists research.investment_decisions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references research.opportunities(id) on delete cascade,
  decision text not null check (decision in ('invest','validate_more','defer','reject')),
  rationale text not null,
  commercial_score numeric(5,2) check (commercial_score between 0 and 100),
  evidence_coverage numeric(5,4) check (evidence_coverage between 0 and 1),
  hard_veto_triggered boolean not null default false,
  model_version text not null,
  financial_model_id uuid references research.financial_models(id) on delete set null,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists research.decision_audit_logs (
  id bigint generated always as identity primary key,
  decision_id uuid not null references research.investment_decisions(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  previous_state jsonb not null default '{}'::jsonb,
  new_state jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists opportunities_project_stage_idx on research.opportunities(project_id, stage, created_at desc);
create index if not exists research_runs_opportunity_time_idx on research.research_runs(opportunity_id, created_at desc);
create index if not exists findings_opportunity_stage_idx on research.research_findings(opportunity_id, stage, created_at desc);
create index if not exists evidence_records_opportunity_time_idx on research.evidence_records(opportunity_id, collected_at desc);
create index if not exists evidence_records_source_idx on research.evidence_records(evidence_source_id);
create index if not exists risk_register_opportunity_status_idx on research.risk_register(opportunity_id, status, severity);
create index if not exists financial_models_opportunity_version_idx on research.financial_models(opportunity_id, model_version desc);
create index if not exists investment_decisions_opportunity_time_idx on research.investment_decisions(opportunity_id, created_at desc);

alter table research.research_projects enable row level security;
alter table research.opportunities enable row level security;
alter table research.research_runs enable row level security;
alter table research.research_findings enable row level security;
alter table research.evidence_sources enable row level security;
alter table research.evidence_records enable row level security;
alter table research.assumptions enable row level security;
alter table research.risk_register enable row level security;
alter table research.financial_models enable row level security;
alter table research.investment_decisions enable row level security;
alter table research.decision_audit_logs enable row level security;

create policy research_projects_owner_all on research.research_projects for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy opportunities_owner_all on research.opportunities for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy research_runs_owner_all on research.research_runs for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy research_findings_owner_all on research.research_findings for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy evidence_sources_owner_all on research.evidence_sources for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy evidence_records_owner_all on research.evidence_records for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy assumptions_owner_all on research.assumptions for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy risk_register_owner_all on research.risk_register for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy financial_models_owner_all on research.financial_models for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy investment_decisions_owner_all on research.investment_decisions for all to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy decision_audit_logs_owner_read on research.decision_audit_logs for select to authenticated using (exists (select 1 from research.investment_decisions d where d.id = decision_id and d.created_by = (select auth.uid())));

grant usage on schema research to authenticated;
grant select, insert, update, delete on research.research_projects, research.opportunities, research.research_runs, research.research_findings, research.evidence_sources, research.evidence_records, research.assumptions, research.risk_register, research.financial_models, research.investment_decisions to authenticated;
grant select on research.decision_audit_logs to authenticated;
grant usage, select on sequence research.decision_audit_logs_id_seq to authenticated;
