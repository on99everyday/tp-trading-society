import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyCommissionRate,
  applySuccessfulPayment,
  canEditCommissionRate,
  canViewAccounting,
  commissionsCsv,
  DEFAULT_COMMISSION_RATE,
  ensureLedger,
  filterCommissions,
  headerLinks,
  ledgerRows,
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
  assert.equal(db.basicCommissionRate, 0.1);
  assert.equal(db.vipCommissionRate, 0.1);
  assert.equal(Object.hasOwn(db, "commissionRate"), false);
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
  applyCommissionRate(db, "basic", 20);
  const second = applySuccessfulPayment(db, buyer.id, "basic", new Date("2026-12-01T00:00:00.000Z"));
  assert.equal(second, null);
  assert.equal(db.commissions.length, 1);
  assert.equal(db.commissions[0].rate, 0.1);
  assert.equal(db.commissions[0].commissionAmount, 149.9);
  assert.equal(db.vipCommissionRate, 0.1);
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
  applyCommissionRate(db, "vip", 20);
  assert.equal(db.basicCommissionRate, 0.1);
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

test("ledger filters keep matching detail rows and the CSV follows them", () => {
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
  applySuccessfulPayment(db, buyer.id, "vip", new Date("2026-12-06T08:30:00.000Z"));
  applySuccessfulPayment(db, other.id, "vip", new Date("2026-11-20T00:00:00.000Z"));
  db.commissions.push({
    id: 99,
    at: "2026-10-01T00:00:00.000Z",
    date: "2026-10-01",
    referrerId: "u-missing",
    referrerName: "Gone",
    referrerAccountCode: "ZZ9999",
    buyerId: "u-void",
    buyerName: "Voided",
    buyerAccountCode: "ZZ8888",
    plan: "vip",
    paymentAmount: 1500,
    commissionAmount: 150,
    rate: 0.1,
    status: "void",
  });

  const all = filterCommissions(db.commissions, {}, db.users);
  assert.equal(all.length, 4);
  assert.deepEqual(
    all.map((row) => row.id),
    db.commissions.map((row) => row.id),
  );
  assert.equal(filterCommissions(db.commissions, { name: "  ", accountCode: "" }, db.users).length, 4);

  const byReferrerCode = filterCommissions(db.commissions, { accountCode: "tp1002" }, db.users);
  assert.deepEqual(byReferrerCode.map((row) => row.buyerName), ["Other"]);
  const byBuyerCode = filterCommissions(db.commissions, { accountCode: buyer.accountCode.toLowerCase() }, db.users);
  assert.deepEqual(byBuyerCode.map((row) => row.buyerName), ["Buyer", "Buyer"]);

  const byReferrerInvite = filterCommissions(db.commissions, { inviteCode: "admin001" }, db.users);
  assert.deepEqual(byReferrerInvite.map((row) => row.buyerId), ["u-buyer", "u-buyer"]);
  const byBuyerInvite = filterCommissions(db.commissions, { inviteCode: buyer.inviteCode.slice(0, 4) }, db.users);
  assert.deepEqual(byBuyerInvite.map((row) => row.buyerId), ["u-buyer", "u-buyer"]);
  assert.equal(filterCommissions(db.commissions, { inviteCode: "ADMIN001" }).length, 0);

  assert.deepEqual(filterCommissions(db.commissions, { name: "OTH" }, db.users).map((row) => row.buyerName), ["Other"]);
  assert.deepEqual(
    filterCommissions(db.commissions, { name: "admin" }, db.users).map((row) => row.referrerName),
    ["admin", "admin"],
  );

  assert.deepEqual(filterCommissions(db.commissions, { plan: "basic" }, db.users).map((row) => row.plan), ["basic"]);
  assert.equal(filterCommissions(db.commissions, { plan: "VIP 會員" }, db.users).length, 3);
  assert.equal(filterCommissions(db.commissions, { status: "recorded" }, db.users).length, 3);
  assert.deepEqual(filterCommissions(db.commissions, { status: "已記錄" }, db.users).map((row) => row.status), [
    "recorded",
    "recorded",
    "recorded",
  ]);
  assert.deepEqual(filterCommissions(db.commissions, { status: "void" }, db.users).map((row) => row.buyerName), ["Voided"]);

  assert.deepEqual(
    filterCommissions(db.commissions, { dateFrom: "2026-11-20" }, db.users).map((row) => row.date),
    ["2026-12-06", "2026-11-20"],
  );
  assert.deepEqual(
    filterCommissions(db.commissions, { dateTo: "2026-11-06" }, db.users).map((row) => row.date),
    ["2026-11-06", "2026-10-01"],
  );
  assert.deepEqual(
    filterCommissions(db.commissions, { dateFrom: "2026-11-20", dateTo: "2026-11-20" }, db.users).map((row) => row.buyerName),
    ["Other"],
  );
  assert.equal(filterCommissions(db.commissions, { dateFrom: "2026-12-31", dateTo: "2026-01-01" }, db.users).length, 0);
  assert.equal(filterCommissions(db.commissions, { dateFrom: "not-a-date" }, db.users).length, 4);

  const combined = filterCommissions(
    db.commissions,
    {
      accountCode: "TP1001",
      inviteCode: "ADMIN001",
      name: "Buyer",
      plan: "vip",
      status: "recorded",
      dateFrom: "2026-12-01",
      dateTo: "2026-12-31",
    },
    db.users,
  );
  assert.equal(combined.length, 1);
  assert.equal(combined[0].date, "2026-12-06");
  assert.equal(combined[0].plan, "vip");

  const csv = commissionsCsv(combined).replace(/^\uFEFF/, "").split("\r\n");
  assert.deepEqual(csv, [
    "日期,六位帳號（識別碼）,介紹人,被介紹人,計劃,金額,佣金,狀態",
    "2026-12-06,TP1001,admin,Buyer,VIP 會員,1500,150,已記錄",
  ]);
  assert.equal(db.commissions.length, 4);
});

test("the admin can set each rate and invalid percentages are rejected", () => {
  const db = seedDatabase();
  assert.equal(applyCommissionRate(db, "basic", "12.5"), 0.125);
  assert.equal(db.basicCommissionRate, 0.125);
  assert.equal(db.vipCommissionRate, 0.1);
  assert.equal(percentFromRate(db.basicCommissionRate), 12.5);
  assert.equal(applyCommissionRate(db, "vip", 8), 0.08);
  assert.equal(db.basicCommissionRate, 0.125);
  assert.equal(percentFromRate(db.vipCommissionRate), 8);
  assert.throws(() => applyCommissionRate(db, "basic", 101), /佣金比例須為 0 到 100/);
  assert.throws(() => applyCommissionRate(db, "vip", -1), /佣金比例須為 0 到 100/);
  assert.throws(() => applyCommissionRate(db, "basic", "nope"), /佣金比例須為 0 到 100/);
  assert.throws(() => applyCommissionRate(db, "gold", 10), /佣金比例須為 0 到 100/);
  assert.equal(db.basicCommissionRate, 0.125);
  assert.equal(db.vipCommissionRate, 0.08);
  assert.equal(canEditCommissionRate({ role: "admin" }), true);
  assert.equal(canEditCommissionRate({ role: "accountant" }), false);
  assert.equal(canEditCommissionRate({ role: "staff" }), false);
});

test("basic and vip payments use their own rates and the report shows rate and plan", () => {
  const db = seedDatabase();
  const buyer = addMember(db, {
    id: "u-buyer",
    name: "Buyer",
    email: "buyer@example.com",
    password: "password1",
    inviteCode: "ADMIN001",
  });
  applyCommissionRate(db, "basic", 15);
  applyCommissionRate(db, "vip", 25);
  const basic = applySuccessfulPayment(db, buyer.id, "basic", paidAt);
  const vip = applySuccessfulPayment(db, buyer.id, "vip", paidAt);
  assert.equal(basic.plan, "basic");
  assert.equal(basic.rate, 0.15);
  assert.equal(basic.commissionAmount, 224.85);
  assert.equal(vip.plan, "vip");
  assert.equal(vip.rate, 0.25);
  assert.equal(vip.commissionAmount, 375);
  applyCommissionRate(db, "basic", 40);
  const renewal = applySuccessfulPayment(db, buyer.id, "vip", new Date("2026-12-06T08:30:00.000Z"));
  assert.equal(renewal.plan, "vip");
  assert.equal(renewal.rate, 0.25);
  assert.equal(renewal.commissionAmount, 375);
  assert.equal(applySuccessfulPayment(db, buyer.id, "basic", new Date("2026-12-07T00:00:00.000Z")), null);
  assert.equal(db.commissions.length, 3);

  const rows = ledgerRows(db.commissions);
  assert.deepEqual(
    rows.map((row) => [row.計劃, row.佣金比例, row.佣金]),
    [
      ["基礎會員", "15%", "224.85"],
      ["VIP 會員", "25%", "375"],
      ["VIP 會員", "25%", "375"],
    ],
  );
  const csv = commissionsCsv(db.commissions).replace(/^\uFEFF/, "").split("\r\n");
  assert.equal(csv[0], "日期,六位帳號（識別碼）,介紹人,被介紹人,計劃,金額,佣金,狀態");
  assert.equal(csv[0].includes("佣金比例"), false);
  assert.equal(csv[1], "2026-11-06,TP1001,admin,Buyer,基礎會員,1499,224.85,已記錄");
  assert.equal(csv[2], "2026-11-06,TP1001,admin,Buyer,VIP 會員,1500,375,已記錄");
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
  assert.equal(prepared.db.basicCommissionRate, 0.1);
  assert.equal(prepared.db.vipCommissionRate, 0.1);
  assert.equal(Object.hasOwn(prepared.db, "commissionRate"), false);
  assert.deepEqual(prepared.db.commissions, []);
  assert.equal(prepared.db.powers.find((row) => row.role === "staff" && row.permission === "upload").enabled, false);
  assert.equal(prepared.db.powers.find((row) => row.role === "accountant" && row.permission === "accounting").enabled, true);
  assert.equal(prepared.db.powers.find((row) => row.role === "accountant" && row.permission === "upload").enabled, false);
  assert.equal(prepared.db.powers.find((row) => row.role === "admin" && row.permission === "accounting").enabled, true);
  assert.equal(prepared.db.powers.find((row) => row.role === "staff" && row.permission === "accounting").enabled, false);
  assert.equal(prepared.db.videos[0].title, "keep");
  assert.equal(ensureLedger(prepared.db), false);
});

function legacyStore(extra = {}) {
  return {
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
        inviteCode: "OLD00001",
        referredBy: null,
      },
    ],
    powers: defaultPowerRows(),
    commissions: [],
    videos: [],
    ...extra,
  };
}

test("a stored commission rate migrates onto both plans without resetting it", () => {
  const prepared = prepareDatabase(legacyStore({ commissionRate: 0.18 }), () => 0);
  assert.equal(ensureLedger(prepared.db), true);
  assert.equal(prepared.db.basicCommissionRate, 0.18);
  assert.equal(prepared.db.vipCommissionRate, 0.18);
  assert.equal(Object.hasOwn(prepared.db, "commissionRate"), false);
  assert.equal(prepared.db.users[0].accountCode, "ZZ1000");
  assert.equal(prepared.db.users[0].inviteCode, "OLD00001");
  assert.equal(ensureLedger(prepared.db), false);

  const partial = prepareDatabase(
    legacyStore({ commissionRate: 0.18, basicCommissionRate: 0.12 }),
    () => 0,
  );
  assert.equal(ensureLedger(partial.db), true);
  assert.equal(partial.db.basicCommissionRate, 0.12);
  assert.equal(partial.db.vipCommissionRate, 0.18);
  assert.equal(Object.hasOwn(partial.db, "commissionRate"), false);

  const zeros = prepareDatabase(
    legacyStore({ commissionRate: 0.18, basicCommissionRate: 0, vipCommissionRate: 0 }),
    () => 0,
  );
  assert.equal(ensureLedger(zeros.db), true);
  assert.equal(zeros.db.basicCommissionRate, 0);
  assert.equal(zeros.db.vipCommissionRate, 0);
  assert.equal(Object.hasOwn(zeros.db, "commissionRate"), false);

  const free = prepareDatabase(legacyStore({ commissionRate: 0 }), () => 0);
  assert.equal(ensureLedger(free.db), true);
  assert.equal(free.db.basicCommissionRate, 0);
  assert.equal(free.db.vipCommissionRate, 0);

  const broken = prepareDatabase(legacyStore({ commissionRate: 2 }), () => 0);
  assert.equal(ensureLedger(broken.db), true);
  assert.equal(broken.db.basicCommissionRate, 0.1);
  assert.equal(broken.db.vipCommissionRate, 0.1);
  assert.equal(Object.hasOwn(broken.db, "commissionRate"), false);
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
    "/powers",
  ]);
  assert.deepEqual(headerLinks(toProfile(db.users.find((user) => user.name === "student01"), db)), []);
  const staff = {
    role: "staff",
    powers: enabledPowers(db, "staff"),
  };
  assert.deepEqual(headerLinks(staff), [{ href: "/staff", label: "後台" }]);
});

test("角色權力 is its own header link and stays editable on the powers page", () => {
  const db = seedDatabase();
  const admin = toProfile(db.users.find((user) => user.role === "admin"), db);
  assert.equal(admin.powers.includes("powers"), true);
  assert.deepEqual(headerLinks(admin), [
    { href: "/accounting", label: "帳目" },
    { href: "/staff", label: "後台" },
    { href: "/powers", label: "角色權力" },
  ]);

  const staffPowers = enabledPowers(db, "staff");
  assert.equal(staffPowers.includes("powers"), false);
  assert.deepEqual(headerLinks({ role: "staff", powers: staffPowers }), [{ href: "/staff", label: "後台" }]);
  assert.deepEqual(headerLinks({ role: "staff", powers: [...staffPowers, "powers"] }), [
    { href: "/staff", label: "後台" },
    { href: "/powers", label: "角色權力" },
  ]);
  assert.deepEqual(headerLinks({ role: "student", powers: ["watch"] }), []);
  assert.deepEqual(headerLinks({ role: "accountant", powers: ["accounting"] }), [
    { href: "/accounting", label: "帳目" },
  ]);

  const staffPage = readFileSync(new URL("./pages/StaffPage.jsx", import.meta.url), "utf8");
  const powersPage = readFileSync(new URL("./pages/PowersPage.jsx", import.meta.url), "utf8");
  assert.equal(staffPage.includes("PowerTable"), false);
  assert.equal(staffPage.includes("setPower"), false);
  assert.equal(powersPage.includes("<PowerTable"), true);
  assert.equal(powersPage.includes("setPower"), true);
});

test("the accounting page filters the detail ledger and exports those rows", () => {
  const page = readFileSync(new URL("./pages/AccountingPage.jsx", import.meta.url), "utf8");
  assert.match(page, /filterCommissions\(/);
  assert.match(page, /commissionsCsv\(\s*filtered\s*\)/);
  for (const label of ["會員識別碼", "邀請碼", "介紹人／被介紹人", "計劃", "狀態", "日期由", "日期至"]) {
    assert.equal(page.includes(label), true, label);
  }
});

test("the accounting page edits basic and vip rates separately", () => {
  const page = readFileSync(new URL("./pages/AccountingPage.jsx", import.meta.url), "utf8");
  const store = readFileSync(new URL("./store.jsx", import.meta.url), "utf8");
  assert.match(page, /id="basic-commission-rate"/);
  assert.match(page, /id="vip-commission-rate"/);
  assert.match(page, /setCommissionRate\(\s*"basic"/);
  assert.match(page, /setCommissionRate\(\s*"vip"/);
  assert.equal(page.includes("佣金比例"), true);
  assert.equal(page.includes('id="commission-rate"'), false);
  assert.match(store, /basicCommissionRate: db\.basicCommissionRate/);
  assert.match(store, /vipCommissionRate: db\.vipCommissionRate/);
  assert.equal(store.includes("db.commissionRate"), false);
  assert.equal(store.includes("next.commissionRate ="), false);
});

test("setRole can assign accountant and still rejects an unknown role", () => {
  assert.doesNotThrow(() => assertAssignableRole("accountant"));
  assert.doesNotThrow(() => assertAssignableRole("staff"));
  assert.doesNotThrow(() => assertAssignableRole("student"));
  assert.doesNotThrow(() => assertAssignableRole("admin"));
  assert.throws(() => assertAssignableRole("sales"), /更新失敗/);
  assert.throws(() => assertAssignableRole(""), /更新失敗/);
});
