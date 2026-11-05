import { sameFold } from "../course.js";

export const RESET_SITE_ORIGIN = "https://tp-trading-society.vercel.app";
export const RESET_UNCONFIGURED = "重設密碼尚未設定。請聯絡工作人員。";
export const RESET_SENT = "如果這個電郵已登記，我們已寄出重設連結。請查看收件箱。";
export const RESET_EXPIRED = "這個重設連結無效或已過期。請回到登入頁再申請一次。";
export const RESET_OPEN_FROM_EMAIL = "請從電郵中的連結開啟此頁。";

export function resetRedirect() {
  return new URL("/reset", RESET_SITE_ORIGIN).toString();
}

export function validateNewPassword(password, confirm) {
  if (password.length < 8) return "密碼至少 8 位。";
  if (password !== confirm) return "兩次輸入的密碼不相同。";
  return "";
}

export function resetErrorMessage(error) {
  const code = String(error?.code || "");
  const text = String(error?.message || "");
  if (code === "over_request_rate_limit" || /rate limit/i.test(text)) return "要求太頻繁，請稍後再試。";
  if (/redirect/i.test(text)) return "重設連結的網址未獲允許。請聯絡工作人員。";
  return "未能寄出重設連結。請稍後再試。";
}

export function applyLocalPassword(users, email, password) {
  let updated = false;
  const next = users.map((user) => {
    if (!sameFold(user.email, email)) return user;
    updated = true;
    return { ...user, password };
  });
  return { users: next, updated };
}

export async function requestPasswordReset(client, email) {
  if (!client) return { ok: false, message: RESET_UNCONFIGURED };
  const { error } = await client.auth.resetPasswordForEmail(String(email || "").trim(), {
    redirectTo: resetRedirect(),
  });
  if (error) return { ok: false, message: resetErrorMessage(error) };
  return { ok: true, message: RESET_SENT };
}

export async function openRecovery(client, href) {
  const url = new URL(href);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  if (tokenHash && type === "recovery") {
    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (error) return { ok: false, message: RESET_EXPIRED };
    return { ok: true, email: data?.user?.email || data?.session?.user?.email || "" };
  }
  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, message: RESET_EXPIRED };
    return { ok: true, email: data?.session?.user?.email || data?.user?.email || "" };
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  if (hash.get("access_token") && hash.get("type") === "recovery") {
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) return { ok: false, message: RESET_EXPIRED };
    return { ok: true, email: data.session.user?.email || "" };
  }
  return { ok: false, message: RESET_OPEN_FROM_EMAIL };
}

export async function saveNewPassword(client, password) {
  const { error } = await client.auth.updateUser({ password });
  if (error) return { ok: false, message: "未能更新密碼。請從電郵重新開啟連結。" };
  return { ok: true };
}
