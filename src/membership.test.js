import assert from "node:assert/strict";
import test from "node:test";
import {
  accountTaken,
  applyMembership,
  membershipView,
  personRecord,
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
