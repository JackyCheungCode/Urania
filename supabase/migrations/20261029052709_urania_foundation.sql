-- Urania foundation schema draft.
-- Applied to the connected Urania Supabase project; retain this file as the migration source of truth.
-- Client roles receive no table grants/policies yet; access must be added only with reviewed RLS rules.

create schema if not exists research;
create schema if not exists crm;
create schema if not exists integrations;
create schema if not exists automation;
create schema if not exists audit;

create table if not exists integrations.data_sources (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  display_name text not null,
  category text not null check (category in ('search','trends','marketplace','company_data','contact_data','supplier_data','ai','database','other')),
  status text not null default 'planned' check (status in ('planned','pending_authorization','configured','active','paused','disabled','error')),
  authorization_status text not null default 'unknown' check (authorization_status in ('unknown','pending','approved','restricted','rejected')),
  regions text[] not null default '{}',
  capabilities text[] not null default '{}',
  public_config jsonb not null default '{}'::jsonb,
  secret_reference text,
  terms_url text,
  license_scope text,
  retention_days integer check (retention_days is null or retention_days > 0),
  last_health_check_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crm.accounts (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  normalized_name text not null,
  website_url text,
  domain text,
  country_code char(2),
  region text,
  industry text,
  account_type text not null default 'unknown' check (account_type in ('importer','distributor','retailer','brand','manufacturer','wholesaler','service_provider','unknown')),
  lifecycle_stage text not null default 'prospect' check (lifecycle_stage in ('prospect','qualified','customer','inactive','disqualified')),
  source_id uuid references integrations.data_sources(id) on delete set null,
  source_record_id text,
  source_url text,
  source_observed_at timestamptz,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','machine_checked','human_verified','disputed')),
  owner_id uuid references auth.users(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists accounts_domain_unique_active on crm.accounts (lower(domain)) where domain is not null and deleted_at is null;
create index if not exists accounts_country_stage_idx on crm.accounts (country_code, lifecycle_stage) where deleted_at is null;
create index if not exists accounts_name_search_idx on crm.accounts using gin (to_tsvector('simple', coalesce(company_name,'')));

create table if not exists crm.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references crm.accounts(id) on delete cascade,
  first_name text,
  last_name text,
  full_name text,
  job_title text,
  work_email text,
  phone text,
  profile_url text,
  country_code char(2),
  source_id uuid references integrations.data_sources(id) on delete set null,
  source_record_id text,
  source_url text,
  source_observed_at timestamptz,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','syntax_valid','provider_verified','human_verified','invalid','disputed')),
  lawful_basis text,
  consent_status text not null default 'unknown' check (consent_status in ('unknown','consented','objected','not_applicable')),
  do_not_contact boolean not null default false,
  last_verified_at timestamptz,
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists contacts_account_idx on crm.contacts (account_id) where deleted_at is null;
create index if not exists contacts_email_idx on crm.contacts (lower(work_email)) where work_email is not null and deleted_at is null;

create table if not exists research.products (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  description text,
  category_path text[] not null default '{}',
  brand text,
  attributes jsonb not null default '{}'::jsonb,
  status text not null default 'candidate' check (status in ('candidate','researching','validated','rejected','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists products_name_search_idx on research.products using gin (to_tsvector('simple', coalesce(canonical_name,'') || ' ' || coalesce(description,'')));

create table if not exists research.product_identifiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references research.products(id) on delete cascade,
  identifier_type text not null check (identifier_type in ('gtin','ean','upc','isbn','asin','mpn','sku','platform_id','other')),
  identifier_value text not null,
  marketplace text,
  source_id uuid references integrations.data_sources(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (identifier_type, identifier_value, marketplace)
);

create table if not exists research.product_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references research.products(id) on delete cascade,
  source_id uuid references integrations.data_sources(id) on delete set null,
  source_record_id text,
  marketplace text,
  market_country char(2),
  title text,
  url text,
  seller_name text,
  price numeric(14,4),
  currency char(3),
  availability text,
  observed_at timestamptz not null default now(),
  fetched_at timestamptz not null default now(),
  raw_record jsonb not null default '{}'::jsonb
);
create index if not exists product_offers_product_time_idx on research.product_offers (product_id, observed_at desc);

create table if not exists research.observations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references research.products(id) on delete cascade,
  source_id uuid references integrations.data_sources(id) on delete set null,
  metric_name text not null,
  metric_value numeric,
  metric_unit text,
  currency char(3),
  market_country char(2),
  evidence_type text not null check (evidence_type in ('T1_observed','T2_proxy','T3_estimate')),
  source_record_id text,
  source_url text,
  observed_at timestamptz,
  fetched_at timestamptz not null default now(),
  method_version text,
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  lower_bound numeric,
  upper_bound numeric,
  license_scope text,
  retention_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists observations_product_metric_time_idx on research.observations (product_id, metric_name, observed_at desc);
create index if not exists observations_source_time_idx on research.observations (source_id, fetched_at desc);

create table if not exists research.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  website_url text,
  country_code char(2),
  region text,
  supplier_type text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','document_checked','sample_checked','audited','disputed')),
  source_id uuid references integrations.data_sources(id) on delete set null,
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists research.supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references research.suppliers(id) on delete cascade,
  product_id uuid references research.products(id) on delete set null,
  quote_reference text,
  unit_price numeric(14,4),
  currency char(3),
  moq integer,
  lead_time_days integer,
  tooling_cost numeric(14,4),
  incoterm text,
  valid_until date,
  quote_status text not null default 'received' check (quote_status in ('received','verified','expired','rejected','accepted')),
  source_url text,
  attachment_reference text,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists research.product_scores (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references research.products(id) on delete cascade,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  score_version text not null,
  component_scores jsonb not null default '{}'::jsonb,
  risk_flags text[] not null default '{}',
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence_count integer not null default 0,
  scored_at timestamptz not null default now(),
  scored_by uuid references auth.users(id) on delete set null
);
create index if not exists product_scores_latest_idx on research.product_scores (product_id, scored_at desc);

create table if not exists research.ai_reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references research.products(id) on delete set null,
  report_type text not null default 'product_opportunity',
  title text not null,
  summary text,
  content jsonb not null default '{}'::jsonb,
  model_provider text,
  model_name text,
  prompt_version text,
  evidence_ids uuid[] not null default '{}',
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null default 'draft' check (status in ('draft','reviewed','approved','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists crm.leads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references crm.accounts(id) on delete set null,
  contact_id uuid references crm.contacts(id) on delete set null,
  lead_name text not null,
  status text not null default 'new' check (status in ('new','researching','qualified','contacted','converted','disqualified')),
  score numeric(5,2) check (score is null or (score >= 0 and score <= 100)),
  score_version text,
  source_id uuid references integrations.data_sources(id) on delete set null,
  source_record_id text,
  source_url text,
  product_interests uuid[] not null default '{}',
  owner_id uuid references auth.users(id) on delete set null,
  next_action_at timestamptz,
  disqualification_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists leads_status_next_action_idx on crm.leads (status, next_action_at) where deleted_at is null;

create table if not exists crm.opportunities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references crm.accounts(id) on delete restrict,
  name text not null,
  stage text not null default 'qualification' check (stage in ('qualification','discovery','proposal','negotiation','won','lost')),
  amount numeric(14,2),
  currency char(3),
  probability numeric(5,4) check (probability is null or (probability >= 0 and probability <= 1)),
  expected_close_date date,
  owner_id uuid references auth.users(id) on delete set null,
  source_lead_id uuid references crm.leads(id) on delete set null,
  lost_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists opportunities_stage_close_idx on crm.opportunities (stage, expected_close_date) where deleted_at is null;

create table if not exists crm.activities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references crm.accounts(id) on delete cascade,
  contact_id uuid references crm.contacts(id) on delete set null,
  opportunity_id uuid references crm.opportunities(id) on delete set null,
  activity_type text not null check (activity_type in ('note','call','meeting','email','task','status_change','other')),
  subject text not null,
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  direction text check (direction is null or direction in ('inbound','outbound','internal')),
  external_message_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists activities_account_time_idx on crm.activities (account_id, created_at desc);

create table if not exists crm.quotes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references crm.accounts(id) on delete restrict,
  opportunity_id uuid references crm.opportunities(id) on delete set null,
  quote_number text not null unique,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','in_review','approved','sent','accepted','rejected','expired')),
  currency char(3) not null,
  valid_until date,
  incoterm text,
  payment_terms text,
  subtotal numeric(14,2) not null default 0,
  shipping_cost numeric(14,2) not null default 0,
  tax_cost numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_number, version)
);

create table if not exists crm.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references crm.quotes(id) on delete cascade,
  product_id uuid references research.products(id) on delete set null,
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,4) not null check (unit_price >= 0),
  currency char(3) not null,
  line_total numeric(14,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists crm.orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references crm.accounts(id) on delete restrict,
  quote_id uuid references crm.quotes(id) on delete set null,
  order_number text not null unique,
  status text not null default 'draft' check (status in ('draft','confirmed','production','shipped','delivered','cancelled','closed')),
  currency char(3) not null,
  total numeric(14,2) not null default 0,
  incoterm text,
  payment_status text not null default 'pending' check (payment_status in ('pending','partial','paid','overdue','refunded')),
  order_date date,
  delivery_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists automation.collection_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  provider_key text,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled','dead_letter')),
  priority integer not null default 5 check (priority between 1 and 10),
  market_country char(2),
  input_payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  estimated_cost numeric(12,4),
  actual_cost numeric(12,4),
  currency char(3) not null default 'USD',
  error_code text,
  error_message text,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collection_jobs_status_schedule_idx on automation.collection_jobs (status, scheduled_at);

create table if not exists automation.task_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references automation.collection_jobs(id) on delete cascade,
  step_key text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','skipped')),
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (job_id, step_key)
);

create table if not exists automation.approvals (
  id uuid primary key default gen_random_uuid(),
  approval_type text not null check (approval_type in ('outbound_email','report','supplier','data_source','other')),
  subject_type text not null,
  subject_id uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  payload jsonb not null default '{}'::jsonb
);
create index if not exists approvals_status_time_idx on automation.approvals (status, requested_at);

create table if not exists integrations.usage_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references integrations.data_sources(id) on delete set null,
  job_id uuid references automation.collection_jobs(id) on delete set null,
  operation text not null,
  request_count integer not null default 1,
  units numeric(14,4),
  cost numeric(14,6) not null default 0,
  currency char(3) not null default 'USD',
  status text not null check (status in ('success','partial','rate_limited','auth_error','provider_error','cancelled')),
  latency_ms integer,
  request_fingerprint text,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_source_time_idx on integrations.usage_events (source_id, created_at desc);

create table if not exists audit.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  outcome text not null default 'success' check (outcome in ('success','denied','failure')),
  request_id text,
  ip_hash text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_resource_time_idx on audit.audit_events (resource_type, resource_id, created_at desc);
create index if not exists audit_events_actor_time_idx on audit.audit_events (actor_id, created_at desc);

-- Default deny at the database API layer until explicit, reviewed RLS policies are added.
do $$
declare
  t record;
begin
  for t in
    select schemaname, tablename
    from pg_tables
    where schemaname in ('research','crm','integrations','automation','audit')
  loop
    execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
  end loop;
end $$;

revoke all on schema research, crm, integrations, automation, audit from anon, authenticated;
grant usage on schema research, crm, integrations, automation, audit to service_role;
grant all privileges on all tables in schema research, crm, integrations, automation, audit to service_role;
grant all privileges on all sequences in schema research, crm, integrations, automation, audit to service_role;

comment on schema research is 'Urania product research and evidence';
comment on schema crm is 'Urania accounts, contacts and sales lifecycle';
comment on schema integrations is 'Urania data providers, permissions and usage accounting';
comment on schema automation is 'Urania async jobs, task runs and human approvals';
comment on schema audit is 'Urania append-oriented audit events';
