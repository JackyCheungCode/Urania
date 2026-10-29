import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && publishableKey);
export const supabase = isSupabaseConfigured
  ? createClient<Database>(url!, publishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type UraniaRole = "admin" | "researcher" | "sales";

export async function requireRole(allowed: UraniaRole[]) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error("Sign in required.");
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const role = user.app_metadata?.urania_role as UraniaRole | undefined;
  if (!role || !allowed.includes(role)) throw new Error("Your account has no Urania workspace role. Ask an administrator.");
  return { session, user, role };
}
