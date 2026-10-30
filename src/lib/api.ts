import { supabase, requireRole } from "./supabase";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export type AccountRecord = {
  id: string;
  company_name: string;
  website_url: string | null;
  domain: string | null;
  country_code: string | null;
  industry: string | null;
  account_type: string;
  lifecycle_stage: string;
  verification_status: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductRecord = {
  id: string;
  canonical_name: string;
  description: string | null;
  category_path: string[];
  brand: string | null;
  attributes?: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
};

export type LeadRecord = {
  id: string;
  lead_name: string;
  status: string;
  score: number | null;
  source_url: string | null;
  next_action_at: string | null;
  created_at: string;
  company_name: string | null;
  country_code: string | null;
  contact_name: string | null;
};

async function rpc<T>(name: string, args: Record<string, unknown>, roles: Array<"admin" | "researcher" | "sales">): Promise<T> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { session } = await requireRole(roles);
  if (apiBase) {
    let response: Response;
    try {
      response = await fetch(apiBase + "/api/v1/rpc/" + name, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + session.access_token },
        body: JSON.stringify(args),
      });
    } catch (cause) {
      // Availability fallback for a temporarily unreachable API edge only.
      // Supabase still validates the same user JWT and enforces database grants/RLS.
      if (cause instanceof TypeError) {
        const { data, error } = await supabase.rpc(name as never, args as never);
        if (error) throw error;
        return data as T;
      }
      throw cause;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiError = (payload as { message?: string; error?: string }).error;
      // Fail over only when the API explicitly reports missing backend configuration.
      // Never fall back on authorization, validation, or upstream business errors.
      if (response.status === 503 && apiError === "backend_not_configured") {
        const { data, error } = await supabase.rpc(name as never, args as never);
        if (error) throw error;
        return data as T;
      }
      const message = (payload as { message?: string; error?: string }).message || apiError;
      throw new Error(message || "Urania API request failed (" + response.status + ")");
    }
    return payload as T;
  }
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw error;
  return data as T;
}

export async function listAccounts(search = ""): Promise<AccountRecord[]> {
  const result = await rpc<{ data?: AccountRecord[] }>("urania_list_accounts", { p_search: search || null, p_limit: 100 }, ["admin", "sales", "researcher"]);
  return result.data ?? [];
}

export async function createAccount(input: {
  company_name: string;
  website_url?: string | null;
  country_code?: string | null;
  industry?: string | null;
  account_type?: string;
  notes?: string | null;
}): Promise<AccountRecord> {
  const result = await rpc<{ data: AccountRecord }>("urania_create_account", {
    p_company_name: input.company_name,
    p_website_url: input.website_url || null,
    p_country_code: input.country_code || null,
    p_industry: input.industry || null,
    p_account_type: input.account_type || "unknown",
    p_notes: input.notes || null,
  }, ["admin", "sales"]);
  return result.data;
}

export async function listLeads(search = ""): Promise<LeadRecord[]> {
  const result = await rpc<{ data?: LeadRecord[] }>("urania_list_leads", { p_search: search || null, p_limit: 100 }, ["admin", "sales", "researcher"]);
  return result.data ?? [];
}

export async function createLead(input: {
  lead_name: string;
  account_id?: string | null;
  source_url?: string | null;
  next_action_at?: string | null;
}): Promise<LeadRecord> {
  const result = await rpc<{ data: LeadRecord }>("urania_create_lead", {
    p_lead_name: input.lead_name,
    p_account_id: input.account_id || null,
    p_contact_id: null,
    p_source_url: input.source_url || null,
    p_next_action_at: input.next_action_at || null,
  }, ["admin", "sales"]);
  return result.data;
}

export async function listProducts(search = ""): Promise<ProductRecord[]> {
  const result = await rpc<{ data?: ProductRecord[] }>("urania_list_products", { p_search: search || null, p_limit: 100 }, ["admin", "researcher", "sales"]);
  return result.data ?? [];
}

export async function createProduct(input: { canonical_name: string; description?: string; category_path?: string[]; brand?: string }): Promise<ProductRecord> {
  const result = await rpc<{ data: ProductRecord }>("urania_create_product", {
    p_canonical_name: input.canonical_name,
    p_description: input.description || null,
    p_category_path: input.category_path || [],
    p_brand: input.brand || null,
  }, ["admin", "researcher"]);
  return result.data;
}

export async function listDataSources(): Promise<unknown[]> {
  const result = await rpc<{ data?: unknown[] }>("urania_list_data_sources", {}, ["admin", "researcher"]);
  return result.data ?? [];
}

export async function createCollectionJob(input: {
  job_type: string;
  provider_key?: string | null;
  market_country?: string | null;
  input_payload?: Record<string, unknown>;
  idempotency_key: string;
}): Promise<{ id: string; status: string }> {
  if (apiBase) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { session } = await requireRole(["admin", "researcher"]);
    const response = await fetch(apiBase + "/api/v1/jobs", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + session.access_token },
      body: JSON.stringify(input),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = (payload as { message?: string; error?: string }).message || (payload as { error?: string }).error;
      throw new Error(message || "Unable to enqueue research job (" + response.status + ")");
    }
    return (payload as { data: { id: string; status: string } }).data;
  }
  const result = await rpc<{ data: { id: string; status: string } }>("urania_create_collection_job", {
    p_job_type: input.job_type,
    p_provider_key: input.provider_key || null,
    p_market_country: input.market_country || null,
    p_input_payload: input.input_payload || {},
    p_idempotency_key: input.idempotency_key,
  }, ["admin", "researcher"]);
  return result.data;
}

export type CollectionJobRecord = {
  id: string;
  job_type: string;
  provider_key: string | null;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";
  market_country: string | null;
  query: string;
  attempts: number;
  max_attempts: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  result_count: number;
  results: Array<{title:string;url:string|null;snippet:string|null;displayed_url:string|null;rank:number;fetched_at:string}>;
};

export async function listCollectionJobs(limit = 20): Promise<CollectionJobRecord[]> {
  const result = await rpc<{data?: CollectionJobRecord[]}>(
    "urania_list_collection_jobs", {p_limit: Math.max(1, Math.min(50, Math.floor(limit)))}, ["admin", "researcher"]
  );
  return result.data ?? [];
}

export async function saveProviderCredential(providerKey: string, apiKey: string): Promise<{provider_key:string;credential_configured:boolean;status:string}> {
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(providerKey)) throw new Error("无效的供应商标识。");
  if (apiKey.trim().length < 8 || apiKey.length > 4096) throw new Error("API 密钥长度无效。");
  const result = await rpc<{data:{provider_key:string;credential_configured:boolean;status:string}}>(
    "urania_set_provider_credential",
    {p_provider_key:providerKey,p_api_key:apiKey},
    ["admin"],
  );
  return result.data;
}

export async function updateProviderState(input: {
  provider_key: string;
  status: string;
  authorization_status: string;
  license_scope: string;
  retention_days: number;
}) {
  const result = await rpc<{data:{provider_key:string;status:string;authorization_status:string;license_scope:string;retention_days:number}}>(
    "urania_set_provider_state",
    {
      p_provider_key: input.provider_key,
      p_status: input.status,
      p_authorization_status: input.authorization_status,
      p_license_scope: input.license_scope,
      p_retention_days: input.retention_days,
    },
    ["admin"],
  );
  return result.data;
}

export type ContactRecord = {
  id: string;
  account_id: string;
  company_name: string;
  full_name: string;
  job_title: string | null;
  work_email: string | null;
  phone: string | null;
  profile_url: string | null;
  country_code: string | null;
  verification_status: string;
  lawful_basis: string | null;
  consent_status: string;
  do_not_contact: boolean;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityRecord = {
  id: string;
  account_id: string;
  company_name: string;
  name: string;
  stage: string;
  amount: number | null;
  currency: string;
  probability: number | null;
  expected_close_date: string | null;
  owner_id: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
};

export async function listContacts(search = ""): Promise<ContactRecord[]> {
  const result = await rpc<{data?:ContactRecord[]}>("urania_list_contacts",{p_search:search||null,p_limit:100},["admin","sales"]);
  return result.data ?? [];
}

export async function createContact(input: {
  account_id: string; full_name: string; job_title?: string; work_email?: string; phone?: string;
  profile_url?: string; country_code?: string; lawful_basis: string; do_not_contact?: boolean;
}): Promise<Partial<ContactRecord>> {
  const result = await rpc<{data:Partial<ContactRecord>}>("urania_create_contact",{
    p_account_id:input.account_id,p_full_name:input.full_name,p_job_title:input.job_title||null,
    p_work_email:input.work_email||null,p_phone:input.phone||null,p_profile_url:input.profile_url||null,
    p_country_code:input.country_code||null,p_lawful_basis:input.lawful_basis,p_do_not_contact:input.do_not_contact||false
  },["admin","sales"]);
  return result.data;
}

export async function listOpportunities(search = ""): Promise<OpportunityRecord[]> {
  const result = await rpc<{data?:OpportunityRecord[]}>("urania_list_opportunities",{p_search:search||null,p_limit:100},["admin","sales"]);
  return result.data ?? [];
}

export async function createOpportunity(input: {
  account_id:string; name:string; amount?:number|null; currency?:string; probability?:number; expected_close_date?:string|null; stage?:string;
}): Promise<Partial<OpportunityRecord>> {
  const result = await rpc<{data:Partial<OpportunityRecord>}>("urania_create_opportunity",{
    p_account_id:input.account_id,p_name:input.name,p_amount:input.amount??null,p_currency:input.currency||"USD",
    p_probability:input.probability??0.1,p_expected_close_date:input.expected_close_date||null,p_stage:input.stage||"qualification"
  },["admin","sales"]);
  return result.data;
}


export type ActivityRecord = {
  id:string; account_id:string|null; contact_id:string|null; opportunity_id:string|null;
  activity_type:string; subject:string; body:string|null; due_at:string|null; completed_at:string|null;
  direction:string|null; created_by:string|null; created_at:string; company_name:string|null;
  contact_name:string|null; opportunity_name:string|null;
};
export type QuoteRecord = {
  id:string; account_id:string; opportunity_id:string|null; quote_number:string; version:number;
  status:string; currency:string; valid_until:string|null; incoterm:string|null; payment_terms:string|null;
  subtotal:number; shipping_cost:number; tax_cost:number; total:number; created_at:string; company_name:string;
};
export type OrderRecord = {
  id:string; account_id:string; quote_id:string|null; order_number:string; status:string; currency:string;
  total:number; incoterm:string|null; payment_status:string; order_date:string|null; delivery_date:string|null;
  created_at:string; company_name:string;
};
export async function listActivities(search=""):Promise<ActivityRecord[]> {
  const result=await rpc<{data?:ActivityRecord[]}>("urania_list_activities",{p_search:search||null,p_limit:100},["admin","sales"]);
  return result.data??[];
}
export async function createActivity(input:{activity_type:string;subject:string;account_id?:string|null;contact_id?:string|null;opportunity_id?:string|null;body?:string;due_at?:string|null;direction?:string}):Promise<Partial<ActivityRecord>> {
  const result=await rpc<{data:Partial<ActivityRecord>}>("urania_create_activity",{
    p_activity_type:input.activity_type,p_subject:input.subject,p_account_id:input.account_id||null,
    p_contact_id:input.contact_id||null,p_opportunity_id:input.opportunity_id||null,p_body:input.body||null,
    p_due_at:input.due_at||null,p_direction:input.direction||"internal"
  },["admin","sales"]);
  return result.data;
}
export async function listQuotes(search=""):Promise<QuoteRecord[]> {
  const result=await rpc<{data?:QuoteRecord[]}>("urania_list_quotes",{p_search:search||null,p_limit:100},["admin","sales"]);
  return result.data??[];
}
export async function createQuote(input:{account_id:string;currency:string;items:Array<{description:string;quantity:number;unit_price:number}>;opportunity_id?:string|null;valid_until?:string|null;incoterm?:string;payment_terms?:string;shipping_cost?:number;tax_cost?:number}):Promise<Partial<QuoteRecord>> {
  const result=await rpc<{data:Partial<QuoteRecord>}>("urania_create_quote",{
    p_account_id:input.account_id,p_currency:input.currency,p_items:input.items,p_opportunity_id:input.opportunity_id||null,
    p_valid_until:input.valid_until||null,p_incoterm:input.incoterm||null,p_payment_terms:input.payment_terms||null,
    p_shipping_cost:input.shipping_cost||0,p_tax_cost:input.tax_cost||0
  },["admin","sales"]);
  return result.data;
}
export async function setQuoteStatus(quoteId:string,status:string):Promise<Partial<QuoteRecord>> {
  const result=await rpc<{data:Partial<QuoteRecord>}>("urania_set_quote_status",{p_quote_id:quoteId,p_status:status},["admin","sales"]);
  return result.data;
}
export async function listOrders(search=""):Promise<OrderRecord[]> {
  const result=await rpc<{data?:OrderRecord[]}>("urania_list_orders",{p_search:search||null,p_limit:100},["admin","sales"]);
  return result.data??[];
}
export async function createOrder(input:{account_id:string;currency?:string;total?:number|null;quote_id?:string|null;incoterm?:string;order_date?:string|null;delivery_date?:string|null}):Promise<Partial<OrderRecord>> {
  const result=await rpc<{data:Partial<OrderRecord>}>("urania_create_order",{
    p_account_id:input.account_id,p_currency:input.currency||"USD",p_total:input.total??null,
    p_quote_id:input.quote_id||null,p_incoterm:input.incoterm||null,p_order_date:input.order_date||null,p_delivery_date:input.delivery_date||null
  },["admin","sales"]);
  return result.data;
}

export type ApprovalRecord = {
  id:string; approval_type:"outbound_email"|"report"|"supplier"|"data_source"|"other";
  subject_type:string; subject_id:string; status:"pending"|"approved"|"rejected"|"cancelled";
  requested_by:string|null; reviewed_by:string|null; review_note:string|null;
  requested_at:string; reviewed_at:string|null; payload:Record<string,unknown>;
};
export async function listApprovals():Promise<ApprovalRecord[]> {
  const result=await rpc<{data?:ApprovalRecord[]}>("urania_list_approvals",{p_limit:100},["admin","sales"]);
  return result.data??[];
}
export async function createEmailApproval(input:{contact_id:string;subject:string;body:string}):Promise<{id:string;subject_id:string;status:string;requested_at:string}> {
  const result=await rpc<{data:{id:string;subject_id:string;status:string;requested_at:string}}>(
    "urania_create_email_approval",{p_contact_id:input.contact_id,p_subject:input.subject,p_body:input.body},["admin","sales"]
  );
  return result.data;
}
export async function reviewApproval(id:string,decision:"approved"|"rejected",note?:string):Promise<Pick<ApprovalRecord,"id"|"status"|"reviewed_by"|"reviewed_at">> {
  const result=await rpc<{data:Pick<ApprovalRecord,"id"|"status"|"reviewed_by"|"reviewed_at">}>(
    "urania_review_approval",{p_approval_id:id,p_decision:decision,p_review_note:note||null},["admin","sales"]
  );
  return result.data;
}

export type ProfitScenarioRecord = {
  id:string;
  scenario_type:"b2c"|"b2b";
  currency:string;
  input_values:Record<string,number>;
  output_values:Record<string,number|null>;
  created_at:string;
};
export async function createProfitScenario(input:{
  scenario_type:"b2c"|"b2b";currency:string;inputs:Record<string,number>;product_id?:string|null;assumptions?:string;
}):Promise<{id:string;scenario_type:"b2c"|"b2b";currency:string;input_values:Record<string,number>;output_values:Record<string,number|null>;created_at:string}> {
  const result=await rpc<{data:{id:string;scenario_type:"b2c"|"b2b";currency:string;input_values:Record<string,number>;output_values:Record<string,number|null>;created_at:string}}>(
    "urania_create_profit_scenario",
    {p_scenario_type:input.scenario_type,p_currency:input.currency,p_inputs:input.inputs,p_product_id:input.product_id||null,p_assumptions:input.assumptions||null},
    ["admin","researcher","sales"]
  );
  return result.data;
}

export type ProductScoreRecord = {
  id:string; product_id:string; score:number; score_version:string;
  component_scores:Record<string,number>; risk_flags:string[]; confidence:number|null;
  evidence_count:number; notes:string|null; coverage_weight:number; hard_stop:boolean; scored_at:string;
};
export async function createProductScore(input:{
  product_id:string;component_scores:Record<string,number>;risk_flags:string[];confidence:number;notes?:string;score_version?:string;
}):Promise<ProductScoreRecord>{
  const result=await rpc<{data:ProductScoreRecord}>("urania_create_product_score",{
    p_product_id:input.product_id,p_component_scores:input.component_scores,p_risk_flags:input.risk_flags,
    p_confidence:input.confidence,p_score_version:input.score_version||"v1.0",p_notes:input.notes||null
  },["admin","researcher"]);
  return result.data;
}


export type ResearchProjectRecord = {
  id:string; name:string; objective:string; status:string; geographies:string[];
  industries:string[]; investment_horizon:string; created_at:string;
};
export type ResearchOpportunityRecord = {
  id:string; project_id:string; title:string; summary:string|null; opportunity_type:string;
  target_markets:string[]; stage:string; decision_status:string; created_at:string;
};
export type ResearchEvidenceRecord = {
  id:string; finding_id:string|null; opportunity_id:string; evidence_source_id:string;
  publisher:string|null; source_type:string; source_url:string|null; source_title:string|null;
  evidence_class:string; claim_supported:string; metric_name:string|null; metric_value:number|null;
  metric_unit:string|null; geography:string|null; published_at:string|null; observed_at:string|null;
  collected_at:string; methodology:string|null; verification_status:string; confidence:number|null;
};
export async function listResearchProjects():Promise<ResearchProjectRecord[]> {
  return await rpc<ResearchProjectRecord[]>("urania_research_list_projects",{},["admin","researcher"]);
}
export async function createResearchProject(input:{
  name:string;objective:string;geographies?:string[];industries?:string[];
  investment_horizon?:"under_1y"|"1_3y"|"3_5y"|"over_5y";
  investment_budget?:Record<string,unknown>;approval_policy?:"owner"|"committee"|"tiered";
}):Promise<ResearchProjectRecord> {
  return await rpc<ResearchProjectRecord>("urania_research_create_project",{
    p_name:input.name,p_objective:input.objective,p_geographies:input.geographies||[],
    p_industries:input.industries||[],p_investment_horizon:input.investment_horizon||"1_3y",
    p_investment_budget:input.investment_budget||{},p_approval_policy:input.approval_policy||"tiered"
  },["admin","researcher"]);
}
export async function listResearchOpportunities(projectId:string):Promise<ResearchOpportunityRecord[]> {
  return await rpc<ResearchOpportunityRecord[]>("urania_research_list_opportunities",{p_project_id:projectId},["admin","researcher"]);
}
export async function createResearchOpportunity(input:{
  project_id:string;title:string;summary?:string;opportunity_type?:"product"|"software"|"service"|"technology"|"industry"|"business_model"|"other";target_markets?:string[];
}):Promise<ResearchOpportunityRecord> {
  return await rpc<ResearchOpportunityRecord>("urania_research_create_opportunity",{
    p_project_id:input.project_id,p_title:input.title,p_summary:input.summary||null,
    p_opportunity_type:input.opportunity_type||"product",p_target_markets:input.target_markets||[]
  },["admin","researcher"]);
}
export async function createResearchFinding(input:{
  opportunity_id:string;stage:string;claim:string;explanation?:string;
  finding_type?:"claim"|"observation"|"estimate"|"contradiction"|"gap";confidence?:number|null;
}):Promise<Record<string,unknown>> {
  return await rpc<Record<string,unknown>>("urania_research_create_finding",{
    p_opportunity_id:input.opportunity_id,p_stage:input.stage,p_claim:input.claim,
    p_explanation:input.explanation||null,p_finding_type:input.finding_type||"claim",p_confidence:input.confidence??null
  },["admin","researcher"]);
}
export async function createResearchEvidenceSource(input:{
  publisher:string;source_type:string;source_url?:string;title?:string;license_name?:string;license_scope?:string;retention_days?:number|null;
}):Promise<Record<string,unknown>> {
  return await rpc<Record<string,unknown>>("urania_research_create_evidence_source",{
    p_publisher:input.publisher,p_source_type:input.source_type,p_source_url:input.source_url||null,
    p_title:input.title||null,p_license_name:input.license_name||null,p_license_scope:input.license_scope||null,
    p_retention_days:input.retention_days??null
  },["admin","researcher"]);
}
export async function createResearchEvidence(input:{
  opportunity_id:string;evidence_source_id:string;evidence_class:string;claim_supported:string;finding_id?:string|null;
  metric_name?:string;metric_value?:number|null;metric_unit?:string;geography?:string;
  published_at?:string|null;observed_at?:string|null;methodology?:string;raw_excerpt?:string;confidence?:number|null;
}):Promise<Record<string,unknown>> {
  return await rpc<Record<string,unknown>>("urania_research_create_evidence_record",{
    p_opportunity_id:input.opportunity_id,p_evidence_source_id:input.evidence_source_id,
    p_evidence_class:input.evidence_class,p_claim_supported:input.claim_supported,p_finding_id:input.finding_id||null,
    p_metric_name:input.metric_name||null,p_metric_value:input.metric_value??null,p_metric_unit:input.metric_unit||null,
    p_geography:input.geography||null,p_published_at:input.published_at||null,p_observed_at:input.observed_at||null,
    p_methodology:input.methodology||null,p_raw_excerpt:input.raw_excerpt||null,p_confidence:input.confidence??null
  },["admin","researcher"]);
}
export async function listResearchEvidence(opportunityId:string):Promise<ResearchEvidenceRecord[]> {
  return await rpc<ResearchEvidenceRecord[]>("urania_research_list_evidence",{p_opportunity_id:opportunityId},["admin","researcher"]);
}

export async function listResearchEvidenceSources():Promise<Array<{id:string;publisher:string;source_type:string;source_url:string|null;title:string|null;license_name:string|null;license_scope:string|null;created_at:string}>> {
  return await rpc<Array<{id:string;publisher:string;source_type:string;source_url:string|null;title:string|null;license_name:string|null;license_scope:string|null;created_at:string}>>("urania_research_list_evidence_sources",{},["admin","researcher"]);
}


export type ResearchFinancialModelRecord = {
  id:string;opportunity_id:string;model_version:number;currency:string;horizon_months:number;
  inputs:Record<string,unknown>;outputs:Record<string,unknown>;calculation_engine_version:string;
  status:string;calculated_at:string|null;created_at:string;
};
export async function saveResearchFinancialModel(input:{
  opportunity_id:string;currency:string;horizon_months:number;inputs:Record<string,unknown>;
  outputs:Record<string,unknown>;calculation_engine_version:string;assumptions_snapshot?:Record<string,unknown>;
}):Promise<ResearchFinancialModelRecord>{
  return await rpc<ResearchFinancialModelRecord>("urania_research_save_financial_model",{
    p_opportunity_id:input.opportunity_id,p_currency:input.currency,p_horizon_months:input.horizon_months,
    p_inputs:input.inputs,p_outputs:input.outputs,p_engine_version:input.calculation_engine_version,
    p_assumptions_snapshot:input.assumptions_snapshot||{}
  },["admin","researcher"]);
}
export async function listResearchFinancialModels(opportunityId:string):Promise<ResearchFinancialModelRecord[]>{
  return await rpc<ResearchFinancialModelRecord[]>("urania_research_list_financial_models",{p_opportunity_id:opportunityId},["admin","researcher"]);
}


export type ResearchRiskRecord = {
  id:string;opportunity_id:string;risk_category:string;description:string;severity:string;
  likelihood:string;hard_veto:boolean;status:string;mitigation_plan:string|null;created_at:string;
};
export async function createResearchRisk(input:{
  opportunity_id:string;risk_category:string;description:string;severity:string;likelihood:string;
  hard_veto:boolean;mitigation_plan?:string;
}):Promise<ResearchRiskRecord>{
  return await rpc<ResearchRiskRecord>("urania_research_create_risk",{
    p_opportunity_id:input.opportunity_id,p_risk_category:input.risk_category,p_description:input.description,
    p_severity:input.severity,p_likelihood:input.likelihood,p_hard_veto:input.hard_veto,
    p_mitigation_plan:input.mitigation_plan||null
  },["admin","researcher"]);
}
export async function listResearchRisks(opportunityId:string):Promise<ResearchRiskRecord[]>{
  return await rpc<ResearchRiskRecord[]>("urania_research_list_risks",{p_opportunity_id:opportunityId},["admin","researcher"]);
}
