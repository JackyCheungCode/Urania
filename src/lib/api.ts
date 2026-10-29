import { supabase, requireRole } from "./supabase";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\\/$/, "");

async function rpc<T>(name: string, args: Record<string, unknown>, roles: Array<"admin" | "researcher" | "sales">): Promise<T> {
  const client = supabase;
  if (!client) throw new Error("Supabase is not configured.");
  const { session } = await requireRole(roles);
  if (apiBase) {
    const response = await fetch(apiBase + "/api/v1/rpc/" + name, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + session.access_token },
      body: JSON.stringify(args),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((payload as {message?: string; error?: string}).message || (payload as {error?: string}).error || "Urania API request failed (" + response.status + ")");
    return payload as T;
  }
  const { data, error } = await client.rpc(name as never, args as never);
  if (error) throw error;
  return data as T;
}

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

async function assertConfigured() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function listAccounts(search = ""): Promise<AccountRecord[]> {
  const client = await assertConfigured();
  await requireRole(["admin", "sales", "researcher"]);
  const { data, error } = await client.rpc("urania_list_accounts", { p_search: search || null, p_limit: 100 });
  if (error) throw error;
  return ((data as { data?: AccountRecord[] } | null)?.data ?? []);
}

export async function createAccount(input: {
  company_name: string;
  website_url?: string | null;
  country_code?: string | null;
  industry?: string | null;
  account_type?: string;
  notes?: string | null;
}): Promise<AccountRecord> {
  const client = await assertConfigured();
  await requireRole(["admin", "sales"]);
  const { data, error } = await client.rpc("urania_create_account", {
    p_company_name: input.company_name,
    p_website_url: input.website_url || null,
    p_country_code: input.country_code || null,
    p_industry: input.industry || null,
    p_account_type: input.account_type || "unknown",
    p_notes: input.notes || null,
  });
  if (error) throw error;
  return (data as { data: AccountRecord }).data;
}

export async function listLeads(search = ""): Promise<LeadRecord[]> {
  const client = await assertConfigured();
  await requireRole(["admin", "sales", "researcher"]);
  const { data, error } = await client.rpc("urania_list_leads", { p_search: search || null, p_limit: 100 });
  if (error) throw error;
  return ((data as { data?: LeadRecord[] } | null)?.data ?? []);
}

export async function createLead(input: {
  lead_name: string;
  account_id?: string | null;
  source_url?: string | null;
  next_action_at?: string | null;
}): Promise<LeadRecord> {
  const client = await assertConfigured();
  await requireRole(["admin", "sales"]);
  const { data, error } = await client.rpc("urania_create_lead", {
    p_lead_name: input.lead_name,
    p_account_id: input.account_id || null,
    p_contact_id: null,
    p_source_url: input.source_url || null,
    p_next_action_at: input.next_action_at || null,
  });
  if (error) throw error;
  return (data as { data: LeadRecord }).data;
}

export async function listProducts(search = "") {
  const client = await assertConfigured();
  await requireRole(["admin", "researcher", "sales"]);
  const { data, error } = await client.rpc("urania_list_products", { p_search: search || null, p_limit: 100 });
  if (error) throw error;
  return ((data as { data?: unknown[] } | null)?.data ?? []);
}

export async function listDataSources() {
  const client = await assertConfigured();
  await requireRole(["admin", "researcher"]);
  const { data, error } = await client.rpc("urania_list_data_sources");
  if (error) throw error;
  return ((data as { data?: unknown[] } | null)?.data ?? []);
}

export async function createCollectionJob(input: {
  job_type: string;
  provider_key?: string | null;
  market_country?: string | null;
  input_payload?: Record<string, unknown>;
  idempotency_key: string;
}) {
  const client = await assertConfigured();
  await requireRole(["admin", "researcher"]);
  const { data, error } = await client.rpc("urania_create_collection_job", {
    p_job_type: input.job_type,
    p_provider_key: input.provider_key || null,
    p_market_country: input.market_country || null,
    p_input_payload: input.input_payload || {},
    p_idempotency_key: input.idempotency_key,
  });
  if (error) throw error;
  return (data as { data: { id: string; status: string } }).data;
}
