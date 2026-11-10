import { defaultPowerRows, PLANS, STAFF_KEYS } from "./course.js";

/** Fraction of the payment. 0.1 is 10%. */
export const DEFAULT_COMMISSION_RATE = 0.1;

const LEDGER_HEADERS = ["日期", "六位帳號（識別碼）", "介紹人", "被介紹人", "計劃", "金額", "佣金", "狀態"];

function validRate(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function ensureLedger(db) {
  if (!db || typeof db !== "object") return false;
  let changed = false;
  if (!Array.isArray(db.commissions)) {
    db.commissions = [];
    changed = true;
  }
  const legacy = validRate(db.commissionRate) ? db.commissionRate : null;
  if (!validRate(db.basicCommissionRate)) {
    db.basicCommissionRate = legacy ?? DEFAULT_COMMISSION_RATE;
    changed = true;
  }
  if (!validRate(db.vipCommissionRate)) {
    db.vipCommissionRate = legacy ?? DEFAULT_COMMISSION_RATE;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(db, "commissionRate")) {
    delete db.commissionRate;
    changed = true;
  }
  if (!Array.isArray(db.powers)) {
    db.powers = defaultPowerRows();
    return true;
  }
  const have = new Set(db.powers.map((row) => `${row.role}:${row.permission}`));
  for (const row of defaultPowerRows()) {
    if (have.has(`${row.role}:${row.permission}`)) continue;
    db.powers.push({ role: row.role, permission: row.permission, enabled: row.enabled });
    changed = true;
  }
  return changed;
}

export function percentFromRate(rate) {
  const safe = validRate(rate) ? rate : DEFAULT_COMMISSION_RATE;
  return Math.round(safe * 10000) / 100;
}

export function applyCommissionRate(db, plan, percent) {
  const field = plan === "basic" ? "basicCommissionRate" : plan === "vip" ? "vipCommissionRate" : "";
  const number = Number(percent);
  if (!field || !Number.isFinite(number) || number < 0 || number > 100) {
    throw new Error("佣金比例須為 0 到 100");
  }
  ensureLedger(db);
  db[field] = Math.round(number * 100) / 10000;
  return db[field];
}

function paymentAmountFor(plan) {
  const amount = Number(PLANS.find((item) => item.id === plan)?.price);
  if (!Number.isFinite(amount)) throw new Error("未能完成繳費");
  return amount;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function formatMoney(value) {
  const rounded = roundMoney(value);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function commissionAmount(paymentAmount, rate) {
  const cents = Math.round(Number(paymentAmount) * 100);
  return Math.round(cents * Number(rate)) / 100;
}

function nextCommissionId(commissions) {
  return commissions.reduce((max, row) => Math.max(max, Number(row?.id) || 0), 0) + 1;
}

function basicAlreadyRecorded(commissions, buyerId) {
  return commissions.some((row) => row.buyerId === buyerId && row.plan === "basic" && row.status === "recorded");
}

/**
 * Successful pay(plan). Registration and manual membership edits must not call this.
 * Basic commissions once per buyer. VIP commissions on every payment, including renewal.
 */
export function applySuccessfulPayment(db, buyerId, plan, now = new Date()) {
  if (plan !== "basic" && plan !== "vip") throw new Error("未能完成繳費");
  const buyer = (db?.users ?? []).find((user) => user && user.id === buyerId);
  if (!buyer) throw new Error("未能完成繳費");
  ensureLedger(db);
  const referrer = buyer.referredBy
    ? db.users.find((user) => user && user.id === buyer.referredBy)
    : null;
  const repeatBasic = plan === "basic" && basicAlreadyRecorded(db.commissions, buyer.id);
  let entry = null;
  if (referrer && !repeatBasic) {
    const atDate = now instanceof Date ? now : new Date(now);
    const at = atDate.toISOString();
    const rateField = plan === "vip" ? "vipCommissionRate" : "basicCommissionRate";
    const rate = validRate(db[rateField]) ? db[rateField] : DEFAULT_COMMISSION_RATE;
    const paymentAmount = paymentAmountFor(plan);
    entry = {
      id: nextCommissionId(db.commissions),
      at,
      date: at.slice(0, 10),
      referrerId: referrer.id,
      referrerName: String(referrer.name ?? ""),
      referrerAccountCode: String(referrer.accountCode ?? ""),
      buyerId: buyer.id,
      buyerName: String(buyer.name ?? ""),
      buyerAccountCode: String(buyer.accountCode ?? ""),
      plan,
      paymentAmount,
      commissionAmount: commissionAmount(paymentAmount, rate),
      rate,
      status: "recorded",
    };
  }
  if (plan === "basic") buyer.basic = true;
  if (plan === "vip") {
    const until = new Date(now);
    until.setDate(until.getDate() + 30);
    buyer.vip = true;
    buyer.vipUntil = until.toISOString();
  }
  if (entry) db.commissions.push(entry);
  return entry;
}

export function summarizeByReferrer(commissions) {
  const grouped = new Map();
  for (const row of commissions ?? []) {
    const current = grouped.get(row.referrerId) ?? {
      referrerId: row.referrerId,
      referrerName: row.referrerName,
      referrerAccountCode: row.referrerAccountCode,
      count: 0,
      paymentTotal: 0,
      commissionTotal: 0,
    };
    current.referrerName = row.referrerName;
    current.referrerAccountCode = row.referrerAccountCode;
    current.count += 1;
    current.paymentTotal = roundMoney(current.paymentTotal + Number(row.paymentAmount));
    current.commissionTotal = roundMoney(current.commissionTotal + Number(row.commissionAmount));
    grouped.set(row.referrerId, current);
  }
  return [...grouped.values()].sort((left, right) =>
    String(left.referrerAccountCode).localeCompare(String(right.referrerAccountCode)),
  );
}

function planLabel(plan) {
  return PLANS.find((item) => item.id === plan)?.name ?? plan;
}

function statusLabel(status) {
  return status === "recorded" ? "已記錄" : String(status ?? "");
}

export function ledgerRows(commissions) {
  return (commissions ?? []).map((row) => ({
    日期: row.date,
    "六位帳號（識別碼）": row.referrerAccountCode,
    介紹人: row.referrerName,
    被介紹人: row.buyerName,
    計劃: planLabel(row.plan),
    佣金比例: `${percentFromRate(row.rate)}%`,
    金額: formatMoney(row.paymentAmount),
    佣金: formatMoney(row.commissionAmount),
    狀態: statusLabel(row.status),
  }));
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function commissionsCsv(commissions) {
  const lines = [LEDGER_HEADERS.join(",")];
  for (const row of ledgerRows(commissions)) {
    lines.push(LEDGER_HEADERS.map((header) => csvCell(row[header])).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

const LEDGER_DATE = /^\d{4}-\d{2}-\d{2}$/;

function filterText(value) {
  return String(value ?? "").trim();
}

function includesText(value, query, upper) {
  const text = String(value ?? "");
  if (upper) return text.toUpperCase().includes(query.toUpperCase());
  return text.toLowerCase().includes(query.toLowerCase());
}

function matchesAny(values, query, upper) {
  return values.some((value) => includesText(value, query, upper));
}

function canonicalPlan(value) {
  if (!value) return "";
  const byId = PLANS.find((item) => item.id === value);
  if (byId) return byId.id;
  const byName = PLANS.find((item) => item.name === value);
  return byName ? byName.id : value;
}

function canonicalStatus(value) {
  if (!value) return "";
  if (value === "已記錄") return "recorded";
  return value;
}

/**
 * Narrow commission rows for the detail list and CSV.
 * Text matches either party. Plan, status, and dates are exact.
 * Invite codes come from the current member record (they are not stored on the row).
 */
export function filterCommissions(commissions, filters = {}, users = []) {
  const rows = Array.isArray(commissions) ? commissions : [];
  const accountCode = filterText(filters.accountCode);
  const inviteCode = filterText(filters.inviteCode);
  const name = filterText(filters.name);
  const plan = canonicalPlan(filterText(filters.plan));
  const status = canonicalStatus(filterText(filters.status));
  const fromText = filterText(filters.dateFrom);
  const toText = filterText(filters.dateTo);
  const dateFrom = LEDGER_DATE.test(fromText) ? fromText : "";
  const dateTo = LEDGER_DATE.test(toText) ? toText : "";
  const inviteById = new Map();
  for (const user of Array.isArray(users) ? users : []) {
    if (!user || user.id == null) continue;
    inviteById.set(user.id, user.inviteCode);
  }
  return rows.filter((row) => {
    if (!row || typeof row !== "object") return false;
    if (accountCode && !matchesAny([row.referrerAccountCode, row.buyerAccountCode], accountCode, true)) return false;
    if (inviteCode && !matchesAny([inviteById.get(row.referrerId), inviteById.get(row.buyerId)], inviteCode, true)) {
      return false;
    }
    if (name && !matchesAny([row.referrerName, row.buyerName], name, false)) return false;
    if (plan && row.plan !== plan) return false;
    if (status && row.status !== status) return false;
    const date = String(row.date ?? "");
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  });
}

export function canViewAccounting(profile) {
  return Boolean(profile?.powers?.includes("accounting"));
}

export function canEditCommissionRate(profile) {
  return profile?.role === "admin";
}

export function headerLinks(profile) {
  if (!profile) return [];
  const links = [];
  if (canViewAccounting(profile)) links.push({ href: "/accounting", label: "帳目" });
  if (profile.powers?.some((power) => STAFF_KEYS.includes(power))) {
    links.push({ href: "/staff", label: "後台" });
  }
  if (profile.powers?.includes("powers")) {
    links.push({ href: "/powers", label: "角色權力" });
  }
  return links;
}
