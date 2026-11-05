import assert from "node:assert/strict";
import test from "node:test";
import { createChatClient } from "./client.js";

test("createChatClient returns null when Supabase env is missing", () => {
  assert.equal(createChatClient({}), null);
  assert.equal(createChatClient({ VITE_SUPABASE_URL: "https://abc.supabase.co" }), null);
});

test("createChatClient returns a client when both keys are present", () => {
  const client = createChatClient({
    VITE_SUPABASE_URL: "https://abc.supabase.co",
    VITE_SUPABASE_ANON_KEY: "public-anon-key",
  });
  assert.ok(client);
  assert.equal(typeof client.from, "function");
  assert.equal(typeof client.channel, "function");
});
