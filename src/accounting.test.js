import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCommissionRate,
  applySuccessfulPayment,
  canEditCommissionRate,
  canViewAccounting,
  commissionsCsv,
  DEFAULT_COMMISSION_RATE,
  ensureLedger,
  headerLinks,
  percentFromRate,
  summarizeByReferrer,
} from "./accounting.js";
import {
  applyMembership,
  assertAssignableRole,
  defaultPowerRows,
  enabledPowers,
  memberFromSignup,
  membershipView,
  PERMISSIONS,
  PLANS,
  prepareDatabase,
  ROLES,
  roleLabel,
  seedDatabase,
  STAFF_KEYS,
  toProfile,
  videosOpen,
  vipActive,
} from "./course.js";

const paidAt = new Date("2026-11-06T08:30:00.000Z");

function planPrice(id) {
  return Number(PLANS.find((plan) => plan.id === id).price);
}

function addMember(db, fields, random = () => 0) {
  const created = memberFromSignup(db.users, fields, random);
  db.users.push(created);
  return created;
}

test("the database defaults to a 10% commission rate and an empty ledger", () => {
  const db = seedDatabase();
  assert.equal(DEFAULT_COMMISSION_RATE, 0.1);
  assert.equal(db.commissionRate, 0.1);
  assert.deepEqual(db.commissions, []);
});

test("registration stores the referrer and does not record a commission", () => {
  const db = seedDatabase();
  const created = addMember(db, {
    id: "u-buyer",
    name: "Buyer",
    email: "buyer@example.com",
    password: "password1",
    inviteCode: "ADMIN001",
  });
  assert.equal(created.referredBy, "u-admin");
  assert.equal(created.basic, false);
  assert.equal(db.commissions.length, 0);
});

test("changing membership without pay does not record a commission", () => {
  const db = seedDatabase();
  const buyer = addMember(db, {
    id: "u-buyer",
    name: "Buyer",
    email: "buyer@example.com",
    password: "password1",
    inviteCode: "ADMIN001",
  });
  applyMembership(buyer, { basic: true, vip: true, vipUntil: "2026-12-20" });
  assert.equal(buyer.basic, true);
  assert.equal(buyer.vip, true);
  assert.equal(db.commissions.length, 0);
});

test("the first basic payment records one commission and a repeat payment does not", () => {
  const db = seedDatabase();
  const buyer = addMember(db, {
    id: "u-buyer",
    name: "Buyer",
    email: "buyer@example.com",
    password: "password1",
    inviteCode: "ADMIN001",
  });
  const first = applySuccessfulPayment(db, buyer.id, "basic", paidAt);
  assert.equal(buyer.basic, true);
  assert.deepEqual(first, {
    id: 1,
    at: "2026-11-06T08:30:00.000Z",
    date: "2026-11-06",
    referrerId: "u-admin",
    referrerName: "admin",
    referrerAccountCode: "TP1001",
    buyerId: "u-buyer",
    buyerName: "Buyer",
    buyerAccountCode: "TP0000",
    plan: "basic",
    paymentAmount: planPrice("basic"),
    commissionAmount: 149.9,
    rate: 0.1,
    status: "recorded",
  });
  assert.equal(first.paymentAmount, 1499);
  applyCommissionRate(db, 20);
  const second = applySuccessfulPayment(db, buyer.id, "basic", new Date("2026-12-01T00:00:00.000Z"));
  assert.equal(second, null);
  assert.equal(db.commissions.length, 1);
  assert.equal(db.commissions[0].rate, 0.1);
  assert.equal(db.commissions[0].commissionAmount, 149.9);
});

test("a basic payment still commissions once when basic was granted without pay", () => {
  const db = seedDatabase();
  const buyer = addMember(db, {
    id: "u-buyer",
    name: "Buyer",
    email: "buyer@example.com",
    password: "password1",
    inviteCode: "ADMIN001",
  });
  applyMembership(buyer, { basic: true });
  const entry = applySuccessfulPayment(db, buyer.id, "basic", paidAt);
  assert.equal(entry?.plan, "basic");
  assert.equal(db.commissions.length, 1);
  assert.equal(applySuccessfulPayment(db, buyer.id, "basic", paidAt), null);
});

test("every successful VIP payment and renewal records a commission", () => {
  const db = seedDatabase();
  const buyer = addMember(db, {
    id: "u-buyer",
    name: "Buyer",
    email: "buyer@example.com",
    password: "password1",
    inviteCode: "ADMIN001",
  });
  const first = applySuccessfulPayment(db, buyer.id, "vip", paidAt);
  assert.equal(buyer.vip, true);
  assert.equal(first.plan, "vip");
  assert.equal(first.paymentAmount, 1500);
  assert.equal(first.paymentAmount, planPrice("vip"));
  assert.equal(first.commissionAmount, 150);
  assert.equal(first.rate, 0.1);
  assert.equal(first.status, "recorded");
  const until = new Date(buyer.vipUntil);
  assert.ok(until > paidAt);
  applyCommissionRate(db, 20);
  const renewal = applySuccessfulPayment(db, buyer.id, "vip", new Date("2026-12-06T08:30:00.000Z"));
  assert.equal(renewal.plan, "vip");
  assert.equal(renewal.paymentAmount, 1500);
  assert.equal(renewal.commissionAmount, 300);
  assert.equal(renewal.rate, 0.2);
  assert.equal(db.commissions.length, 2);
  assert.equal(db.commissions[0].rate, 0.1);
  assert.equal(db.commissions[0].commissionAmount, 150);
});

test("a walk-in payment opens membership and records no commission", () => {
  const db = seedDatabase();
  const buyer = addMember(db, {
    id: "u-walk",
    name: "Walker",
    email: "walk@example.com",
    password: "password1",
    inviteCode: "",
  });
  assert.equal(buyer.referredBy, null);
  assert.equal(applySuccessfulPayment(db, buyer.id, "basic", paidAt), null);
  assert.equal(buyer.basic, true);
  assert.equal(applySuccessfulPayment(db, buyer.id, "vip", paidAt), null);
  assert.equal(buyer.vip, true);
  assert.equal(db.commissions.length, 0);
});

test("a missing referrer still opens membership and records no commission", () => {
  const db = seedDatabase();
  const buyer = addMember(db, {
    id: "u-buyer",
    name: "Buyer",
    email: "buyer@example.com",
    password: "password1",
    inviteCode: "ADMIN001",
  });
  buyer.referredBy = "u-gone";
  assert.equal(applySuccessfulPayment(db, buyer.id, "basic", paidAt), null);
  assert.equal(buyer.basic, true);
  assert.equal(db.commissions.length, 0);
});

test("an unknown plan does not change membership or the ledger", () => {
  const db = seedDatabase();
  const buyer = addMember(db, {
    id: "u-buyer",
    name: "Buyer",
    email: "buyer@example.com",
    password: "password1",
    inviteCode: "ADMIN001",
  });
  assert.throws(() => applySuccessfulPayment(db, buyer.id, "gold", paidAt), /未能完成繳費/);
  assert.equal(buyer.basic, false);
  assert.equal(buyer.vip, false);
  assert.equal(db.commissions.length, 0);
});

test("commission summaries group by referrer and the CSV uses the ledger columns", () => {
  const db = seedDatabase();
  const buyer = addMember(db, {
    id: "u-buyer",
    name: "Buyer",
    email: "buyer@example.com",
    password: "password1",
    inviteCode: "ADMIN001",
  });
  const other = addMember(
    db,
    {
      id: "u-other",
      name: "Other",
      email: "other@example.com",
      password: "password1",
      inviteCode: "DEMO0001",
    },
    () => 0.1,
  );
  applySuccessfulPayment(db, buyer.id, "basic", paidAt);
  applySuccessfulPayment(db, buyer.id, "vip", paidAt);
  applySuccessfulPayment(db, other.id, "vip", paidAt);
  assert.deepEqual(summarizeByReferrer(db.commissions), [
    {
      referrerId: "u-admin",
      referrerName: "admin",
      referrerAccountCode: "TP1001",
      count: 2,
      paymentTotal: 2999,
      commissionTotal: 299.9,
    },
    {
      referrerId: "u-demo",
      referrerName: "demo",
      referrerAccountCode: "TP1002",
      count: 1,
      paymentTotal: 1500,
      commissionTotal: 150,
    },
  ]);
  const csv = commissionsCsv(db.commissions);
  const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
  assert.equal(lines[0], "日期,六位帳號（識別碼）,介紹人,被介紹人,計劃,金額,佣金,狀態");
  assert.equal(lines[1], "2026-11-06,TP1001,admin,Buyer,基礎會員,1499,149.9,已記錄");
  assert.equal(lines[2], "2026-11-06,TP1001,admin,Buyer,VIP 會員,1500,150,已記錄");
  assert.equal(lines[3], `2026-11-06,TP1002,demo,Other,VIP 會員,1500,150,已記錄`);
  assert.equal(other.accountCode.startsWith("TP"), true);
});

test("the admin can set a new rate and invalid percentages are rejected", () => {
  const db = seedDatabase();
  assert.equal(applyCommissionRate(db, "12.5"), 0.125);
  assert.equal(db.commissionRate, 0.125);
  assert.equal(percentFromRate(db.commissionRate), 12.5);
  assert.throws(() => applyCommissionRate(db, 101), /佣金比例須為 0 到 100/);
  assert.throws(() => applyCommissionRate(db, -1), /佣金比例須為 0 到 100/);
  assert.throws(() => applyCommissionRate(db, "nope"), /佣金比例須為 0 到 100/);
  assert.equal(db.commissionRate, 0.125);
  assert.equal(canEditCommissionRate({ role: "admin" }), true);
  assert.equal(canEditCommissionRate({ role: "accountant" }), false);
  assert.equal(canEditCommissionRate({ role: "staff" }), false);
});

test("old databases gain the default rate, an empty ledger, and accounting powers", () => {
  const stored = {
    users: [
      {
        id: "u-old",
        name: "OldUser",
        email: "old@example.com",
        password: "secret123",
        role: "student",
        basic: false,
        vip: false,
        vipUntil: null,
        locked: false,
        accountCode: "ZZ1000",
        teamPrefix: "ZZ",
        referredBy: null,
      },
    ],
    powers: [
      { role: "student", permission: "watch", enabled: true },
      { role: "staff", permission: "upload", enabled: false },
      { role: "admin", permission: "powers", enabled: true },
    ],
    videos: [{ id: 9, title: "keep" }],
  };
  const prepared = prepareDatabase(stored, () => 0);
  assert.equal(ensureLedger(prepared.db), true);
  assert.equal(prepared.db.commissionRate, 0.1);
  assert.deepEqual(prepared.db.commissions, []);
  assert.equal(prepared.db.powers.find((row) => row.role === "staff" && row.permission === "upload").enabled, false);
  assert.equal(prepared.db.powers.find((row) => row.role === "accountant" && row.permission === "accounting").enabled, true);
  assert.equal(prepared.db.powers.find((row) => row.role === "accountant" && row.permission === "upload").enabled, false);
  assert.equal(prepared.db.powers.find((row) => row.role === "admin" && row.permission === "accounting").enabled, true);
  assert.equal(prepared.db.powers.find((row) => row.role === "staff" && row.permission === "accounting").enabled, false);
  assert.equal(prepared.db.videos[0].title, "keep");
  assert.equal(ensureLedger(prepared.db), false);
});

test("accountant access is only the accounting power", () => {
  const db = seedDatabase();
  const accountantRows = defaultPowerRows().filter((row) => row.role === "accountant");
  assert.equal(accountantRows.length, PERMISSIONS.length);
  assert.deepEqual(
    accountantRows.filter((row) => row.enabled).map((row) => row.permission),
    ["accounting"],
  );
  assert.deepEqual(enabledPowers(db, "accountant"), ["accounting"]);
  assert.equal(enabledPowers(db, "admin").includes("accounting"), true);
  assert.equal(enabledPowers(db, "staff").includes("accounting"), false);
  assert.equal(enabledPowers(db, "staff").includes("upload"), true);
  assert.equal(enabledPowers(db, "student").includes("accounting"), false);
  assert.equal(STAFF_KEYS.includes("accounting"), false);
  assert.equal(roleLabel("accountant"), "會計");
  assert.equal(roleLabel("staff"), "工作人員");
  assert.deepEqual(
    ROLES.map((role) => role.id),
    ["student", "staff", "accountant", "admin"],
  );
  assert.equal(canViewAccounting({ powers: ["accounting"] }), true);
  assert.equal(canViewAccounting({ powers: ["upload", "accounts"] }), false);
  assert.equal(canViewAccounting(null), false);

  const unpaid = { role: "accountant", basic: false, vip: false, vipUntil: null };
  assert.deepEqual(membershipView(unpaid, paidAt.getTime()).labels, ["未付費"]);
  assert.equal(vipActive(unpaid, paidAt.getTime()), false);
  assert.equal(videosOpen(unpaid), false);
  const profile = toProfile(
    {
      id: "u-books",
      name: "Books",
      email: "books@example.com",
      role: "accountant",
      basic: false,
      vip: false,
      vipUntil: null,
      locked: false,
      accountCode: "TP9999",
    },
    db,
  );
  assert.equal(profile.basic, false);
  assert.equal(profile.vip, false);
  assert.equal(profile.videos, false);
  assert.deepEqual(profile.powers, ["accounting"]);
  assert.deepEqual(headerLinks(profile), [{ href: "/accounting", label: "帳目" }]);
  assert.deepEqual(headerLinks(toProfile(db.users.find((user) => user.role === "admin"), db)).map((link) => link.href), [
    "/accounting",
    "/staff",
  ]);
  assert.deepEqual(headerLinks(toProfile(db.users.find((user) => user.name === "student01"), db)), []);
  const staff = {
    role: "staff",
    powers: enabledPowers(db, "staff"),
  };
  assert.deepEqual(headerLinks(staff), [{ href: "/staff", label: "後台" }]);
});

test("setRole can assign accountant and still rejects an unknown role", () => {
  assert.doesNotThrow(() => assertAssignableRole("accountant"));
  assert.doesNotThrow(() => assertAssignableRole("staff"));
  assert.doesNotThrow(() => assertAssignableRole("student"));
  assert.doesNotThrow(() => assertAssignableRole("admin"));
  assert.throws(() => assertAssignableRole("sales"), /更新失敗/);
  assert.throws(() => assertAssignableRole(""), /更新失敗/);
});
