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
    const response = await fetch(apiBase + "/api/v1/rpc/" + name, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + session.access_token },
      body: JSON.stringify(args),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = (payload as { message?: string; error?: string }).message || (payload as { error?: string }).error;
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
