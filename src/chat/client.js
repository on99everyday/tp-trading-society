import { createClient } from "@supabase/supabase-js";
import { readChatConfig } from "./config.js";

export function createChatClient(env) {
  const config = readChatConfig(env);
  if (!config.configured) return null;
  try {
    return createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return null;
  }
}

let cached;
export function getChatClient() {
  if (cached === undefined) {
    cached = createChatClient({
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    });
  }
  return cached;
}
