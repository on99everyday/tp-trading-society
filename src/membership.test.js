import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as course from "./course.js";
import {
  accountTaken,
  allocateAccountCode,
  applyMembership,
  assignTeamPrefix,
  ensureAccountCodes,
  ensureInviteCodes,
  isAccountCode,
  isInviteCode,
  memberFromSignup,
  membershipView,
  personRecord,
  prepareDatabase,
  referrerIdForInvite,
  seedDatabase,
  toProfile,
  userByLoginName,
} from "./course.js";

const now = new Date("2026-11-05T00:00:00.000Z").getTime();

test("unpaid student is labelled 未付費", () => {
  const view = membershipView({ role: "student", basic: false, vip: false, vipUntil: null }, now);
  assert.deepEqual(view.labels, ["未付費"]);
  assert.equal(view.basic, false);
  assert.equal(view.vip, false);
  assert.equal(view.expiry, "");
});

test("basic student is labelled 基礎", () => {
  const view = membershipView({ role: "student", basic: true, vip: false, vipUntil: null }, now);
  assert.deepEqual(view.labels, ["基礎"]);
  assert.equal(view.basic, true);
  assert.equal(view.vip, false);
});

test("active VIP student shows 基礎, VIP, and the expiry date", () => {
  const view = membershipView(
    { role: "student", basic: true, vip: true, vipUntil: "2026-12-05T00:00:00.000Z" },
    now,
  );
  assert.deepEqual(view.labels, ["基礎", "VIP"]);
  assert.equal(view.vip, true);
  assert.equal(view.vipUntil, "2026-12-05T00:00:00.000Z");
  assert.equal(view.expiry, "至 2026-12-05");
});

test("expired VIP without basic is 未付費 and keeps the expiry", () => {
  const view = membershipView(
    { role: "student", basic: false, vip: true, vipUntil: "2026-10-01T00:00:00.000Z" },
    now,
  );
  assert.deepEqual(view.labels, ["未付費"]);
  assert.equal(view.vip, false);
  assert.equal(view.expiry, "已於 2026-10-01 到期");
});

test("expired VIP with basic stays 基礎 and shows the expiry", () => {
  const view = membershipView(
    { role: "student", basic: true, vip: true, vipUntil: "2026-10-01T00:00:00.000Z" },
    now,
  );
  assert.deepEqual(view.labels, ["基礎"]);
  assert.equal(view.vip, false);
  assert.equal(view.expiry, "已於 2026-10-01 到期");
});

test("VIP without a stored expiry is not active", () => {
  const view = membershipView({ role: "student", basic: false, vip: true, vipUntil: null }, now);
  assert.deepEqual(view.labels, ["未付費"]);
  assert.equal(view.vip, false);
});

test("staff and admin count as VIP without a paid expiry", () => {
  for (const role of ["staff", "admin"]) {
    const view = membershipView({ role, basic: false, vip: false, vipUntil: null }, now);
    assert.deepEqual(view.labels, ["VIP"]);
    assert.equal(view.vip, true);
    assert.equal(view.basic, true);
    assert.equal(view.expiry, "");
  }
});

test("personRecord includes basic, active vip, and vipUntil", () => {
  const person = personRecord(
    {
      id: "u-demo",
      name: "demo",
      email: "demo@tp-trading.local",
      role: "student",
      basic: true,
      vip: true,
      vipUntil: "2026-12-05T00:00:00.000Z",
    },
    now,
  );
  assert.equal(person.userId, "u-demo");
  assert.equal(person.displayName, "demo");
  assert.equal(person.email, "demo@tp-trading.local");
  assert.equal(person.role, "student");
  assert.equal(person.basic, true);
  assert.equal(person.vip, true);
  assert.equal(person.vipUntil, "2026-12-05T00:00:00.000Z");
  assert.deepEqual(person.labels, ["基礎", "VIP"]);
});

test("applyMembership stores an explicit expiry and basic flag", () => {
  const user = { basic: false, vip: false, vipUntil: null };
  applyMembership(user, { basic: true, vip: true, vipUntil: "2026-12-20" });
  assert.equal(user.basic, true);
  assert.equal(user.vip, true);
  assert.equal(user.vipUntil, "2026-12-20T23:59:59.999Z");
});

test("applyMembership gives a new VIP about 30 days when no expiry is set", () => {
  const user = { basic: false, vip: false, vipUntil: null };
  const start = new Date("2026-11-05T12:00:00.000Z");
  applyMembership(user, { vip: true, vipUntil: null }, start);
  const days = (new Date(user.vipUntil) - start) / (24 * 60 * 60 * 1000);
  assert.ok(days > 29 && days < 31, user.vipUntil);
});

test("applyMembership rejects an unreadable expiry", () => {
  const user = { basic: false, vip: false, vipUntil: null };
  assert.throws(() => applyMembership(user, { vipUntil: "nope" }), /到期日不正確/);
});

test("login name matches regardless of letter case and leaves the stored name", () => {
  const db = seedDatabase();
  const stored = db.users.find((user) => user.name === "locked01");
  assert.equal(userByLoginName(db.users, "LOCKED01")?.id, "u-locked01");
  assert.equal(userByLoginName(db.users, "Locked01")?.id, "u-locked01");
  assert.equal(userByLoginName(db.users, " locked01 ")?.id, "u-locked01");
  assert.equal(userByLoginName(db.users, "locked123"), null);
  assert.equal(stored.name, "locked01");
  assert.equal(stored.password, "locked123");
});

test("sign-up treats the same name or email as taken ignoring case", () => {
  const db = seedDatabase();
  assert.equal(accountTaken(db.users, { name: "LOCKED01" }), "name");
  assert.equal(accountTaken(db.users, { email: "LOCKED01@tp-trading.local" }), "email");
  assert.equal(accountTaken(db.users, { name: "newstudent", email: "Admin@tp-trading.local" }), "email");
  assert.equal(accountTaken(db.users, { name: "fresh-name", email: "fresh@example.com" }), null);
});

test("seed includes locked01 and a locked region-jump alert", () => {
  const db = seedDatabase();
  const locked = db.users.find((user) => user.name === "locked01");
  assert.ok(locked);
  assert.equal(locked.id, "u-locked01");
  assert.equal(locked.password, "locked123");
  assert.equal(locked.role, "student");
  assert.equal(locked.basic, false);
  assert.equal(locked.vip, false);
  assert.equal(locked.vipUntil, null);
  assert.equal(locked.locked, true);
  assert.equal(toProfile(locked, db).locked, true);

  const alert = db.alerts.find((item) => item.userId === locked.id);
  assert.ok(alert);
  assert.equal(alert.displayName, "locked01");
  assert.equal(alert.locked, true);
  assert.equal(alert.detail, "locked01 在 8 秒內由「廣東 · 廣州」改為「北京 · 北京」登入");

  for (const name of ["admin", "demo", "student01", "student02"]) {
    const user = db.users.find((item) => item.name === name);
    assert.ok(user);
    assert.equal(user.locked, false);
  }
});

const SEED_ACCOUNT_CODES = {
  admin: "TP1001",
  demo: "TP1002",
  student01: "TP1003",
  student02: "TP1004",
  student03: "TP1005",
  student04: "TP1006",
  student05: "TP1007",
  locked01: "TP1008",
};

const SEED_INVITE_CODES = {
  admin: "ADMIN001",
  demo: "DEMO0001",
  student01: "STUD0001",
  student02: "STUD0002",
  student03: "STUD0003",
  student04: "STUD0004",
  student05: "STUD0005",
  locked01: "LOCK0001",
};

test("seed users have stable team codes and no referrer", () => {
  const db = seedDatabase();
  const codes = new Set();
  const suffixes = new Set();
  const invites = new Set();
  for (const [name, code] of Object.entries(SEED_ACCOUNT_CODES)) {
    const user = db.users.find((item) => item.name === name);
    assert.ok(user, name);
    assert.equal(user.accountCode, code);
    assert.equal(user.teamPrefix, "TP");
    assert.equal(isAccountCode(user.accountCode), true);
    assert.equal(user.inviteCode, SEED_INVITE_CODES[name]);
    assert.equal(isInviteCode(user.inviteCode), true);
    assert.equal(user.referredBy, null);
    codes.add(code);
    suffixes.add(code.slice(2));
    invites.add(user.inviteCode);
  }
  assert.equal(codes.size, db.users.length);
  assert.equal(suffixes.size, db.users.length);
  assert.equal(invites.size, db.users.length);
  const again = seedDatabase();
  assert.equal(again.users.find((user) => user.name === "admin").accountCode, "TP1001");
  assert.equal(again.users.find((user) => user.name === "demo").accountCode, "TP1002");
});

test("account codes are a team prefix plus four digits", () => {
  assert.equal(isAccountCode("AB1234"), true);
  assert.equal(isAccountCode("TP0000"), true);
  assert.equal(isAccountCode("TP9999"), true);
  assert.equal(isAccountCode("ab1234"), false);
  assert.equal(isAccountCode("100001"), false);
  assert.equal(isAccountCode("TP123"), false);
  assert.equal(isAccountCode("TP12345"), false);
  assert.equal(isAccountCode("A11234"), false);
  assert.equal(isAccountCode("12AB34"), false);
  assert.equal(isAccountCode(""), false);
  assert.equal(isAccountCode(null), false);
});

test("allocateAccountCode uses the prefix and keeps the last four unique inside it", () => {
  assert.equal(allocateAccountCode([], () => 0.5), "TP5000");
  assert.equal(allocateAccountCode([{ accountCode: "TP0000", teamPrefix: "TP" }], () => 0), "TP0001");
  assert.equal(
    allocateAccountCode([{ accountCode: "AB5000", teamPrefix: "AB" }], () => 0.5, "TP"),
    "TP5000",
  );
  assert.equal(
    allocateAccountCode([{ accountCode: "TP5000", teamPrefix: "TP" }], () => 0.5, "tp"),
    "TP0000",
  );
  const seeded = seedDatabase().users;
  const created = allocateAccountCode(seeded, () => 0);
  assert.equal(created, "TP0000");
  assert.equal(seeded.some((user) => user.accountCode === created), false);
  assert.equal(seeded.some((user) => user.accountCode.slice(2) === created.slice(2)), false);
});

test("ensureAccountCodes backfills missing codes without wiping other fields", () => {
  const users = [
    {
      id: "u-staff",
      name: "Staffer",
      email: "staff@example.com",
      password: "staffpass",
      role: "staff",
      basic: false,
      vip: false,
      vipUntil: null,
      locked: false,
      notes: "keep-me",
      teamPrefix: "hk",
    },
    {
      id: "u-kept",
      name: "Kept",
      email: "kept@example.com",
      password: "keptpass1",
      role: "admin",
      accountCode: "AB1008",
      teamPrefix: "AB",
      referredBy: "u-staff",
      basic: true,
    },
  ];
  assert.equal(ensureAccountCodes(users, () => 0.5), true);
  assert.equal(users[0].accountCode, "HK5000");
  assert.equal(users[0].teamPrefix, "HK");
  assert.equal(users[0].referredBy, null);
  assert.equal(users[0].name, "Staffer");
  assert.equal(users[0].password, "staffpass");
  assert.equal(users[0].role, "staff");
  assert.equal(users[0].notes, "keep-me");
  assert.equal(users[1].accountCode, "AB1008");
  assert.equal(users[1].teamPrefix, "AB");
  assert.equal(users[1].referredBy, "u-staff");
  assert.equal(users[1].basic, true);
  assert.equal(ensureAccountCodes(users, () => 0), false);
  assert.equal(users[0].accountCode, "HK5000");
});

test("ensureAccountCodes replaces legacy, invalid, and duplicate codes", () => {
  const users = [
    { id: "a", name: "A", accountCode: "TP1001", teamPrefix: "TP", referredBy: "keep", password: "a" },
    { id: "b", name: "B", accountCode: "TP1001", teamPrefix: "TP", password: "b" },
    { id: "c", name: "C", accountCode: "100001", email: "c@example.com" },
    { id: "d", name: "D", accountCode: "hk1234", teamPrefix: "HK" },
    { id: "e", name: "E", accountCode: "AB1234", teamPrefix: "AB", referredBy: null },
  ];
  ensureAccountCodes(users, () => 0);
  assert.equal(users[0].accountCode, "TP1001");
  assert.equal(users[0].referredBy, "keep");
  assert.equal(users[1].accountCode, "TP0000");
  assert.equal(users[1].teamPrefix, "TP");
  assert.equal(users[1].password, "b");
  assert.equal(users[1].referredBy, null);
  assert.equal(users[2].accountCode, "ZZ0000");
  assert.equal(users[2].teamPrefix, "ZZ");
  assert.equal(users[2].email, "c@example.com");
  assert.equal(users[3].accountCode, "HK1234");
  assert.equal(users[3].teamPrefix, "HK");
  assert.equal(users[4].accountCode, "AB1234");
  const codes = users.map((user) => user.accountCode);
  assert.equal(new Set(codes).size, codes.length);
  const tpSuffixes = users.filter((user) => user.accountCode.startsWith("TP")).map((user) => user.accountCode.slice(2));
  assert.equal(new Set(tpSuffixes).size, tpSuffixes.length);
  for (const code of codes) assert.equal(isAccountCode(code), true);
});

test("prepareDatabase backfills old localStorage users and keeps the rest of the database", () => {
  const stored = {
    users: [
      {
        id: "u-old",
        name: "OldUser",
        email: "old@example.com",
        password: "secret123",
        role: "student",
        basic: true,
        vip: true,
        vipUntil: "2026-12-01T00:00:00.000Z",
        locked: true,
      },
    ],
    videos: [{ id: 42, title: "mine", sourceUrl: "https://example.com/v" }],
    alerts: [{ id: 7, userId: "u-old", detail: "custom", locked: false }],
    sessionId: "u-old",
    watches: [{ userId: "u-old", viewCount: 4 }],
    nextId: 250,
  };
  const first = prepareDatabase(stored, () => 0.25);
  assert.equal(first.changed, true);
  assert.equal(stored.users[0].accountCode, undefined);
  assert.equal(first.db.users.length, 1);
  assert.equal(first.db.users[0].name, "OldUser");
  assert.equal(first.db.users[0].password, "secret123");
  assert.equal(first.db.users[0].locked, true);
  assert.equal(first.db.users[0].basic, true);
  assert.equal(first.db.users[0].vipUntil, "2026-12-01T00:00:00.000Z");
  assert.equal(first.db.users[0].referredBy, null);
  assert.equal(first.db.users[0].teamPrefix, "ZZ");
  assert.equal(first.db.users[0].accountCode, "ZZ2500");
  assert.equal(first.db.users[0].inviteCode, "JJJJJJJJ");
  assert.equal(first.db.sessionId, "u-old");
  assert.equal(first.db.videos.length, 1);
  assert.equal(first.db.videos[0].id, 42);
  assert.equal(first.db.videos[0].title, "mine");
  assert.equal(first.db.alerts.length, 1);
  assert.equal(first.db.alerts[0].detail, "custom");
  assert.equal(first.db.watches[0].viewCount, 4);
  assert.equal(first.db.nextId, 250);

  const second = prepareDatabase(first.db, () => 0);
  assert.equal(second.changed, false);
  assert.equal(second.db.users[0].accountCode, first.db.users[0].accountCode);
  assert.equal(second.db.users[0].inviteCode, first.db.users[0].inviteCode);
  assert.equal(second.db.videos[0].title, "mine");
});

test("blank invite code has no referrer and a valid invite code is the referrer's id", () => {
  const users = seedDatabase().users;
  const admin = users.find((user) => user.name === "admin");
  assert.equal(referrerIdForInvite(users, ""), null);
  assert.equal(referrerIdForInvite(users, "   "), null);
  assert.equal(referrerIdForInvite(users, null), null);
  assert.equal(referrerIdForInvite(users, admin.inviteCode), "u-admin");
  assert.equal(referrerIdForInvite(users, ` ${admin.inviteCode.toLowerCase()} `), "u-admin");
});

test("account codes and unknown invite codes are rejected", () => {
  const users = seedDatabase().users;
  const admin = users.find((user) => user.name === "admin");
  for (const code of [admin.accountCode, "tp1001", "123", "100001", "TP1009", "AB12345", "ZZZZZZZZ", "ADMIN001X", "ADMIN00!"]) {
    assert.throws(() => referrerIdForInvite(users, code), /會員邀請碼不正確/);
  }
});

test("registration looks up inviteCode, inherits teamPrefix, and mints a new invite code", () => {
  const users = seedDatabase().users.map((user) => ({ ...user }));
  const admin = users.find((user) => user.name === "admin");
  const created = memberFromSignup(
    users,
    {
      id: "u-new",
      name: " newbie ",
      email: " new@example.com ",
      password: "password1",
      inviteCode: admin.inviteCode,
    },
    () => 0,
  );
  assert.equal(created.name, "newbie");
  assert.equal(created.email, "new@example.com");
  assert.equal(created.role, "student");
  assert.equal(created.referredBy, "u-admin");
  assert.equal(created.accountCode, "TP0000");
  assert.equal(created.teamPrefix, "TP");
  assert.equal(created.inviteCode, "AAAAAAAA");
  assert.equal(created.basic, false);
  assert.equal(created.locked, false);
  assert.equal(users.some((user) => user.inviteCode === created.inviteCode), false);
  users.push(created);

  const blank = memberFromSignup(
    users,
    {
      id: "u-new2",
      name: "second",
      email: "second@example.com",
      password: "password1",
      inviteCode: "  ",
      role: "staff",
      teamPrefix: "ab",
    },
    () => 0.5,
  );
  assert.equal(blank.referredBy, null);
  assert.equal(blank.role, "staff");
  assert.equal(blank.teamPrefix, "ZZ");
  assert.equal(blank.accountCode, "ZZ5000");
  assert.equal(isInviteCode(blank.inviteCode), true);
  assert.notEqual(blank.inviteCode, created.inviteCode);
  assert.equal(users.some((user) => user.accountCode === blank.accountCode), false);
  users.push(blank);
  users.push({
    id: "u-agent",
    name: "agent",
    email: "agent@example.com",
    accountCode: "TP7777",
    teamPrefix: "AB",
    inviteCode: "ABAGENT1",
    referredBy: null,
  });

  const downline = memberFromSignup(
    users,
    {
      id: "u-down",
      name: "downline",
      email: "down@example.com",
      password: "password1",
      inviteCode: "abagent1",
      teamPrefix: "TP",
    },
    () => 0,
  );
  assert.equal(downline.referredBy, "u-agent");
  assert.equal(downline.teamPrefix, "AB");
  assert.equal(downline.accountCode, "AB0000");
  assert.notEqual(downline.inviteCode, "ABAGENT1");
  assert.equal(isInviteCode(downline.inviteCode), true);

  assert.throws(
    () =>
      memberFromSignup(users, {
        id: "u-bad",
        name: "third",
        email: "third@example.com",
        password: "password1",
        inviteCode: admin.accountCode,
      }),
    /會員邀請碼不正確/,
  );
  assert.throws(
    () =>
      memberFromSignup(users, {
        id: "u-missing",
        name: "fourth",
        email: "fourth@example.com",
        password: "password1",
        inviteCode: "NOTEXIST",
      }),
    /會員邀請碼不正確/,
  );
});

test("invite codes stay unique and a valid code is not replaced", () => {
  const users = [
    { id: "a", name: "A", inviteCode: "KEEPCODE" },
    { id: "b", name: "B", inviteCode: "keepcode" },
    { id: "c", name: "C", inviteCode: "short" },
    { id: "d", name: "D" },
  ];
  assert.equal(ensureInviteCodes(users, () => 0), true);
  assert.equal(users[0].inviteCode, "KEEPCODE");
  assert.equal(isInviteCode(users[1].inviteCode), true);
  assert.equal(isInviteCode(users[2].inviteCode), true);
  assert.equal(isInviteCode(users[3].inviteCode), true);
  const codes = users.map((user) => user.inviteCode);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(codes.filter((code) => code === "KEEPCODE").length, 1);
  assert.equal(ensureInviteCodes(users, () => 0.9), false);
  assert.deepEqual(
    users.map((user) => user.inviteCode),
    codes,
  );
});

test("person and profile records expose the account code and invite code", () => {
  const db = seedDatabase();
  const demo = db.users.find((user) => user.name === "demo");
  assert.equal(personRecord(demo).accountCode, "TP1002");
  assert.equal(personRecord(demo).inviteCode, "DEMO0001");
  assert.equal(toProfile(demo, db).accountCode, "TP1002");
  assert.equal(toProfile(demo, db).inviteCode, "DEMO0001");
});

test("login name lookup still ignores letter case after account codes exist", () => {
  const db = seedDatabase();
  assert.equal(userByLoginName(db.users, "ADMIN")?.id, "u-admin");
  assert.equal(userByLoginName(db.users, "admin")?.accountCode, "TP1001");
  assert.equal(userByLoginName(db.users, "TP1001"), null);
});

test("changing the team prefix keeps the last four digits", () => {
  const users = [
    { id: "u-admin", accountCode: "TP1001", teamPrefix: "TP", referredBy: null },
    { id: "u-other", accountCode: "AB1001", teamPrefix: "AB", referredBy: null },
  ];
  assert.equal(assignTeamPrefix(users[0], users, "hk"), "HK1001");
  assert.equal(users[0].teamPrefix, "HK");
  assert.equal(users[0].accountCode, "HK1001");
  assert.throws(() => assignTeamPrefix(users[0], users, "AB"), /此會員編號已被使用/);
  assert.equal(users[0].accountCode, "HK1001");
  assert.equal(users[0].teamPrefix, "HK");
  assert.equal(users[1].accountCode, "AB1001");
  assert.throws(() => assignTeamPrefix(users[0], users, "A1"), /團隊前綴須為 2 個英文字母/);
  assert.equal(users[0].accountCode, "HK1001");
});

test("the last four digits cannot be reminted", () => {
  assert.equal(Object.hasOwn(course, "remintAccountSuffix"), false);
  const staff = readFileSync(new URL("./pages/StaffPage.jsx", import.meta.url), "utf8");
  const store = readFileSync(new URL("./store.jsx", import.meta.url), "utf8");
  const courseSource = readFileSync(new URL("./course.js", import.meta.url), "utf8");
  assert.equal(staff.includes("重發後4位"), false);
  assert.equal(staff.includes("remintAccountCode"), false);
  assert.equal(store.includes("remintAccountCode"), false);
  assert.equal(store.includes("remintAccountSuffix"), false);
  assert.equal(courseSource.includes("remintAccountSuffix"), false);
  assert.equal(store.includes("setTeamPrefix"), true);
  assert.equal(courseSource.includes("assignTeamPrefix"), true);
});
