/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_E2E_BYPASS_AUTH?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
