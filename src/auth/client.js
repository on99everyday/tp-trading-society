import { createClient } from "@supabase/supabase-js";
import { readChatConfig } from "../chat/config.js";

export function createAuthClient(env) {
  const config = readChatConfig(env);
  if (!config.configured) return null;
  try {
    return createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
        storageKey: "tp-trading-auth",
      },
    });
  } catch {
    return null;
  }
}

let cached;
export function getAuthClient() {
  if (cached === undefined) {
    cached = createAuthClient({
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    });
  }
  return cached;
}
