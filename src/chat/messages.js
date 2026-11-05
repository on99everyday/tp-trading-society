const MAX_BODY = 1000;
const MAX_CHANNEL = 40;

function characterLength(value) {
  return [...value].length;
}

export function validateBody(body) {
  const text = String(body ?? "").trim();
  if (!text) throw new Error("請輸入訊息");
  if (characterLength(text) > MAX_BODY) throw new Error("訊息最長 1000 字");
  return text;
}

export function validateChannelName(name) {
  const text = String(name ?? "").trim();
  if (!text) throw new Error("請輸入頻道名稱");
  if (characterLength(text) > MAX_CHANNEL) throw new Error("頻道名稱最長 40 字");
  return text;
}

export function normalizeChannel(row) {
  const id = Number(row?.id);
  return { id: Number.isFinite(id) ? id : row?.id, name: row?.name ?? "" };
}

export function normalizeMessage(row) {
  const channelId = Number(row?.channel_id);
  return {
    id: row?.id ?? "",
    channelId: Number.isFinite(channelId) ? channelId : (row?.channel_id ?? null),
    body: row?.body ?? "",
    authorId: row?.author_id ?? "",
    authorName: row?.author_name ?? "",
    authorRole: row?.author_role ?? "student",
    kind: row?.kind === "announcement" ? "announcement" : "chat",
    createdAt: row?.created_at ?? "",
  };
}

export function mergeMessages(list, incoming) {
  const map = new Map();
  for (const item of list || []) {
    if (item && item.id != null) map.set(item.id, item);
  }
  const extra = Array.isArray(incoming) ? incoming : [incoming];
  for (const item of extra) {
    if (item && item.id != null) map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function presenceList(state) {
  const people = [];
  const seen = new Set();
  for (const entries of Object.values(state || {})) {
    const rows = Array.isArray(entries) ? entries : [entries];
    for (const entry of rows) {
      const userId = entry?.userId;
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      people.push({ userId, name: entry.name || "會員" });
    }
  }
  return people;
}

export function chatErrorMessage(error) {
  const raw = String(error?.message || error || "");
  if (/Invalid API key|JWT|apikey/i.test(raw)) {
    return "Supabase 金鑰不正確。請檢查 Vercel 的 VITE_SUPABASE_ANON_KEY。";
  }
  if (/row-level security|permission denied/i.test(raw)) {
    return "即時通訊權限不足。請確認已執行遷移 SQL 的授權與政策。";
  }
  if (/does not exist|schema cache|Could not find the table/i.test(raw)) {
    return "即時通訊資料表尚未建立。請在 Supabase SQL 編輯器執行 supabase/migrations 裡的 SQL。";
  }
  return "即時通訊暫時連不上。請稍後再試。";
}
