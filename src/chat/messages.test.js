import assert from "node:assert/strict";
import test from "node:test";
import {
  chatErrorMessage,
  mergeMessages,
  normalizeMessage,
  presenceList,
  validateBody,
  validateChannelName,
} from "./messages.js";

test("validateBody trims and rejects empty or oversized text", () => {
  assert.equal(validateBody("  今晚金價  "), "今晚金價");
  assert.throws(() => validateBody("   "), /請輸入訊息/);
  assert.throws(() => validateBody("字".repeat(1001)), /1000/);
});

test("validateChannelName trims and rejects empty names", () => {
  assert.equal(validateChannelName("  倫敦盤  "), "倫敦盤");
  assert.throws(() => validateChannelName("  "), /頻道名稱/);
  assert.throws(() => validateChannelName("名".repeat(41)), /40/);
});

test("normalizeMessage maps a Supabase row", () => {
  assert.deepEqual(
    normalizeMessage({
      id: "uuid",
      channel_id: 1,
      body: "hi",
      author_id: "u-demo",
      author_name: "demo",
      author_role: "student",
      kind: "announcement",
      created_at: "2026-11-05T01:02:03.000Z",
    }),
    {
      id: "uuid",
      channelId: 1,
      body: "hi",
      authorId: "u-demo",
      authorName: "demo",
      authorRole: "student",
      kind: "announcement",
      createdAt: "2026-11-05T01:02:03.000Z",
    },
  );
});

test("unknown message kinds fall back to chat", () => {
  assert.equal(normalizeMessage({ id: "1", kind: "broadcast" }).kind, "chat");
});

test("mergeMessages dedupes by id and sorts oldest first", () => {
  const merged = mergeMessages(
    [{ id: "a", createdAt: "2026-11-05T00:00:02.000Z", body: "2" }],
    { id: "b", createdAt: "2026-11-05T00:00:01.000Z", body: "1" },
  );
  assert.deepEqual(
    merged.map((item) => item.id),
    ["b", "a"],
  );
  const again = mergeMessages(merged, { id: "a", createdAt: "2026-11-05T00:00:02.000Z", body: "2" });
  assert.equal(again.length, 2);
});

test("presenceList returns unique online members", () => {
  const people = presenceList({
    "u-demo": [{ userId: "u-demo", name: "demo" }],
    "u-admin": [{ userId: "u-admin", name: "admin" }, { userId: "u-admin", name: "admin" }],
  });
  assert.deepEqual(people, [
    { userId: "u-demo", name: "demo" },
    { userId: "u-admin", name: "admin" },
  ]);
});

test("chatErrorMessage explains a missing table in Traditional Chinese", () => {
  const message = chatErrorMessage({ message: 'relation "public.vip_messages" does not exist' });
  assert.match(message, /資料表尚未建立/);
  assert.match(message, /SQL/);
});

test("chatErrorMessage explains a bad API key", () => {
  assert.match(chatErrorMessage({ message: "Invalid API key" }), /VITE_SUPABASE_ANON_KEY/);
});

test("chatErrorMessage explains a rejected row policy", () => {
  assert.match(chatErrorMessage({ message: "new row violates row-level security policy" }), /權限不足/);
});

test("chatErrorMessage has a generic Traditional Chinese fallback", () => {
  assert.match(chatErrorMessage({ message: "fetch failed" }), /暫時連不上/);
});
