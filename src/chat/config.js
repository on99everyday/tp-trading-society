export const CHAT_NOT_CONFIGURED =
  "即時通訊尚未設定。請在 Vercel 加入 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY，並在 Supabase 執行 supabase/migrations 的 SQL。未設定時，頻道消息只保存在這部瀏覽器。";

export function readChatConfig(env) {
  const source = env && typeof env === "object" ? env : {};
  const url = String(source.VITE_SUPABASE_URL ?? "").trim();
  const anonKey = String(source.VITE_SUPABASE_ANON_KEY ?? "").trim();
  return { url, anonKey, configured: Boolean(url && anonKey) };
}
