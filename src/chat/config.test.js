import assert from "node:assert/strict";
import test from "node:test";
import { CHAT_NOT_CONFIGURED, readChatConfig } from "./config.js";

test("missing Supabase env is not configured and the notice names both keys", () => {
  const config = readChatConfig({});
  assert.equal(config.configured, false);
  assert.equal(config.url, "");
  assert.equal(config.anonKey, "");
  assert.match(CHAT_NOT_CONFIGURED, /即時通訊尚未設定/);
  assert.match(CHAT_NOT_CONFIGURED, /VITE_SUPABASE_URL/);
  assert.match(CHAT_NOT_CONFIGURED, /VITE_SUPABASE_ANON_KEY/);
});

test("blank env values do not count as configured", () => {
  const config = readChatConfig({ VITE_SUPABASE_URL: "  ", VITE_SUPABASE_ANON_KEY: "key" });
  assert.equal(config.configured, false);
});

test("both env values configure chat", () => {
  const config = readChatConfig({
    VITE_SUPABASE_URL: " https://abc.supabase.co ",
    VITE_SUPABASE_ANON_KEY: " anon-key ",
  });
  assert.equal(config.configured, true);
  assert.equal(config.url, "https://abc.supabase.co");
  assert.equal(config.anonKey, "anon-key");
});
