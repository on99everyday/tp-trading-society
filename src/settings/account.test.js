import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_PASSWORD_UPDATED,
  LOCAL_PASSWORD_MISMATCH,
  NOTIFICATION_OPTIONS,
  REMOTE_AND_LOCAL,
  REMOTE_ONLY,
  applySettingsPatch,
  changeMemberPassword,
  mirrorSettings,
  passwordMode,
  readMemberSettings,
  renameMember,
  subscriptionSummary,
  twoFactorCopy,
} from "./account.js";

const now = new Date("2026-11-05T00:00:00.000Z").getTime();

test("notification options are stored boolean preferences", () => {
  const settings = readMemberSettings({});
  assert.deepEqual(
    NOTIFICATION_OPTIONS.map((option) => option.key),
    ["course", "vip", "membership"],
  );
  for (const option of NOTIFICATION_OPTIONS) assert.equal(typeof settings[option.key], "boolean");
});

test("missing settings use the member defaults", () => {
  assert.deepEqual(readMemberSettings({}), {
    course: true,
    vip: true,
    membership: true,
    twoFactor: false,
  });
  assert.deepEqual(readMemberSettings({ settings: { course: false, twoFactor: true } }), {
    course: false,
    vip: true,
    membership: true,
    twoFactor: true,
  });
});

test("settings patch only changes boolean keys", () => {
  const next = applySettingsPatch(
    { settings: { course: true, vip: true, membership: true, twoFactor: false } },
    { vip: false, twoFactor: true, role: "admin" },
  );
  assert.deepEqual(next, { course: true, vip: false, membership: true, twoFactor: true });
});

test("display name is trimmed and must stay unique", () => {
  const users = [
    { id: "u-demo", name: "demo" },
    { id: "u-locked01", name: "locked01" },
  ];
  assert.equal(renameMember(users, "u-demo", "  demo  ").name, "demo");
  assert.equal(renameMember(users, "u-demo", "LOCKED01").ok, false);
  assert.match(renameMember(users, "u-demo", "   ").message, /顯示名稱/);
  assert.equal(renameMember(users, "u-demo", "fresh-name").name, "fresh-name");
});

test("subscription summary reuses basic and VIP labels and stays read-only", () => {
  const summary = subscriptionSummary(
    { role: "student", basic: true, vip: true, vipUntil: "2026-12-05T00:00:00.000Z" },
    now,
  );
  assert.deepEqual(summary.labels, ["基礎", "VIP"]);
  assert.equal(summary.expiry, "至 2026-12-05");
  assert.match(summary.billing, /尚未接到付款/);
});

test("two-factor copy saves the preference and says verification is not live", () => {
  assert.match(twoFactorCopy(false), /不會立即啟用/);
  assert.match(twoFactorCopy(true), /尚未接通/);
  assert.match(twoFactorCopy(true), /偏好已儲存/);
});

test("password mode distinguishes a Supabase session from the demo account", async () => {
  assert.deepEqual(await passwordMode(null), { mode: "unconfigured", email: "" });
  const local = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  };
  assert.deepEqual(await passwordMode(local), { mode: "local", email: "" });
  const signedIn = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { email: "demo@tp-trading.local" } } },
        error: null,
      }),
    },
  };
  assert.deepEqual(await passwordMode(signedIn), { mode: "session", email: "demo@tp-trading.local" });
});

test("demo password change updates only the browser account", async () => {
  const user = { email: "demo@tp-trading.local", password: "demo1234" };
  const wrong = await changeMemberPassword({
    client: null,
    user,
    currentPassword: "nope",
    nextPassword: "Newpass99",
    confirm: "Newpass99",
  });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.updatedLocal, false);

  const saved = await changeMemberPassword({
    client: {
      auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    },
    user,
    currentPassword: "demo1234",
    nextPassword: "Newpass99",
    confirm: "Newpass99",
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.updatedLocal, true);
  assert.equal(saved.updatedRemote, false);
  assert.equal(saved.message, DEMO_PASSWORD_UPDATED);
  assert.equal(user.password, "demo1234");
});

test("a Supabase session updates Auth and the matching course password", async () => {
  const calls = [];
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { email: "Demo@tp-trading.local" } } },
        error: null,
      }),
      updateUser(body) {
        calls.push(body);
        return Promise.resolve({ data: { user: {} }, error: null });
      },
    },
  };
  const matched = await changeMemberPassword({
    client,
    user: { email: "demo@tp-trading.local", password: "demo1234" },
    currentPassword: "demo1234",
    nextPassword: "Newpass99",
    confirm: "Newpass99",
  });
  assert.equal(matched.ok, true);
  assert.equal(matched.updatedRemote, true);
  assert.equal(matched.updatedLocal, true);
  assert.equal(matched.message, REMOTE_AND_LOCAL);
  assert.deepEqual(calls[0], { password: "Newpass99" });

  const remoteOnly = await changeMemberPassword({
    client,
    user: { email: "other@tp-trading.local", password: "demo1234" },
    currentPassword: "demo1234",
    nextPassword: "Newpass99",
    confirm: "Newpass99",
  });
  assert.equal(remoteOnly.message, REMOTE_ONLY);
  assert.equal(remoteOnly.updatedLocal, false);

  const mismatch = await changeMemberPassword({
    client,
    user: { email: "demo@tp-trading.local", password: "demo1234" },
    currentPassword: "wrong-local",
    nextPassword: "Newpass99",
    confirm: "Newpass99",
  });
  assert.equal(mismatch.message, LOCAL_PASSWORD_MISMATCH);
  assert.equal(mismatch.updatedRemote, true);
  assert.equal(mismatch.updatedLocal, false);
});

test("preferences mirror to Supabase only when a session exists", async () => {
  const none = await mirrorSettings(null, { course: true });
  assert.equal(none.mirrored, false);
  assert.equal(none.reason, "unconfigured");

  const local = await mirrorSettings(
    { auth: { getSession: async () => ({ data: { session: null }, error: null }) } },
    { course: false },
  );
  assert.equal(local.reason, "no-session");

  const calls = [];
  const mirrored = await mirrorSettings(
    {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: "auth-1" } } }, error: null }),
        updateUser(body) {
          calls.push(body);
          return Promise.resolve({ error: null });
        },
      },
    },
    { course: false, twoFactor: true },
  );
  assert.equal(mirrored.mirrored, true);
  assert.deepEqual(calls[0], { data: { tpSettings: { course: false, twoFactor: true } } });
});
