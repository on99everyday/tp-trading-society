import assert from "node:assert/strict";
import test from "node:test";
import { applyMembership, membershipView, personRecord } from "./course.js";

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
