import { validateNewPassword } from "../auth/reset.js";
import { accountTaken, membershipView, sameFold } from "../course.js";

export const DEMO_PASSWORD_UPDATED =
  "這部瀏覽器的課程密碼已更新。目前沒有 Supabase Auth 登入階段，雲端密碼沒有改。";
export const REMOTE_AND_LOCAL = "雲端密碼與這部瀏覽器的課程密碼都已更新。";
export const REMOTE_ONLY = "雲端密碼已更新。這部瀏覽器沒有相同電郵的課程帳號，課程登入密碼未改。";
export const LOCAL_PASSWORD_MISMATCH = "雲端密碼已更新。目前密碼與這部瀏覽器的課程帳號不符，課程登入密碼未改。";
export const CURRENT_PASSWORD_WRONG = "目前密碼不正確。";

export const NOTIFICATION_OPTIONS = [
  { key: "course", label: "課程與測驗更新", detail: "新單元、新短片或測驗開放時通知。" },
  { key: "vip", label: "覆盤區新消息", detail: "VIP 頻道有新消息時通知。" },
  { key: "membership", label: "會籍到期提醒", detail: "VIP 即將到期時提醒。" },
];

export function defaultMemberSettings() {
  return {
    course: true,
    vip: true,
    membership: true,
    twoFactor: false,
  };
}

export function readMemberSettings(user) {
  const raw = user?.settings && typeof user.settings === "object" ? user.settings : {};
  const base = defaultMemberSettings();
  return {
    course: typeof raw.course === "boolean" ? raw.course : base.course,
    vip: typeof raw.vip === "boolean" ? raw.vip : base.vip,
    membership: typeof raw.membership === "boolean" ? raw.membership : base.membership,
    twoFactor: raw.twoFactor === true,
  };
}

export function applySettingsPatch(user, patch) {
  const next = readMemberSettings(user);
  for (const key of ["course", "vip", "membership", "twoFactor"]) {
    if (typeof patch?.[key] === "boolean") next[key] = patch[key];
  }
  return next;
}

export function renameMember(users, userId, name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { ok: false, message: "請填寫顯示名稱。" };
  if ([...trimmed].length > 40) return { ok: false, message: "顯示名稱最多 40 字。" };
  if (!users.some((user) => user.id === userId)) return { ok: false, message: "未能更新顯示名稱。" };
  const others = users.filter((user) => user.id !== userId);
  if (accountTaken(others, { name: trimmed })) return { ok: false, message: "此名稱已有人使用" };
  return { ok: true, name: trimmed };
}

export function subscriptionSummary(profile, now = Date.now()) {
  const view = membershipView(profile, now);
  return {
    labels: view.labels,
    expiry: view.expiry,
    basic: view.basic,
    vip: view.vip,
    billing: "收費尚未接到付款服務。這裡只顯示目前的基礎會員與 VIP 狀態。",
  };
}

export function twoFactorCopy(enabled) {
  if (enabled) {
    return "偏好已儲存。兩步驗證尚未接通，暫時不會要求驗證碼。正式啟用後會沿用這個設定。";
  }
  return "關閉。開啟只會先記住偏好，不會立即啟用驗證碼。";
}

export function passwordUpdateError(error) {
  const text = String(error?.message || "");
  if (/weak|at least|password/i.test(text) && /short|least|weak|character/i.test(text)) {
    return "新密碼不符合要求。請用至少 8 位。";
  }
  if (/session|jwt|not authenticated/i.test(text)) return "登入階段已失效。請重新登入後再試。";
  return "未能更新雲端密碼。請稍後再試。";
}

export async function passwordMode(client) {
  if (!client) return { mode: "unconfigured", email: "" };
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session) return { mode: "local", email: "" };
  return { mode: "session", email: data.session.user?.email || "" };
}

export async function changeMemberPassword({ client, user, currentPassword, nextPassword, confirm }) {
  const problem = validateNewPassword(nextPassword, confirm);
  if (problem) return { ok: false, message: problem, updatedLocal: false, updatedRemote: false };

  const mode = await passwordMode(client);
  const localMatches = Boolean(user) && user.password === currentPassword;
  if (mode.mode !== "session") {
    if (!localMatches) {
      return { ok: false, message: CURRENT_PASSWORD_WRONG, updatedLocal: false, updatedRemote: false };
    }
    return { ok: true, message: DEMO_PASSWORD_UPDATED, updatedLocal: true, updatedRemote: false };
  }

  const { error } = await client.auth.updateUser({ password: nextPassword });
  if (error) {
    return { ok: false, message: passwordUpdateError(error), updatedLocal: false, updatedRemote: false };
  }
  const sameEmail = Boolean(user) && sameFold(user.email, mode.email);
  if (!sameEmail) {
    return { ok: true, message: REMOTE_ONLY, updatedLocal: false, updatedRemote: true };
  }
  if (!localMatches) {
    return { ok: true, message: LOCAL_PASSWORD_MISMATCH, updatedLocal: false, updatedRemote: true };
  }
  return { ok: true, message: REMOTE_AND_LOCAL, updatedLocal: true, updatedRemote: true };
}

export async function mirrorSettings(client, settings) {
  if (!client) return { mirrored: false, reason: "unconfigured" };
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session) return { mirrored: false, reason: "no-session" };
  const { error: updateError } = await client.auth.updateUser({ data: { tpSettings: settings } });
  if (updateError) return { mirrored: false, reason: "error" };
  return { mirrored: true, reason: "session" };
}

export function passwordModeCopy(mode) {
  if (mode === "session") {
    return "已偵測 Supabase Auth 登入階段。新密碼會更新雲端帳號；電郵相符時，也會更新這部瀏覽器的課程登入密碼。";
  }
  if (mode === "unconfigured") {
    return "雲端密碼尚未設定。在這裡更改的是這部瀏覽器的課程登入密碼。";
  }
  return "目前沒有 Supabase Auth 登入階段。在這裡更改的是這部瀏覽器的課程登入密碼。";
}

export function persistNote(mirror) {
  if (mirror?.mirrored) return "已儲存在這部瀏覽器，並同步到 Supabase 帳號。";
  if (mirror?.reason === "error") return "已儲存在這部瀏覽器。同步到 Supabase 失敗。";
  return "已儲存在這部瀏覽器。";
}
