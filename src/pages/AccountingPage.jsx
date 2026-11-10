import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  canEditCommissionRate,
  canViewAccounting,
  commissionsCsv,
  filterCommissions,
  formatMoney,
  ledgerRows,
  percentFromRate,
  summarizeByReferrer,
} from "../accounting";
import { PLANS, roleLabel } from "../course";
import { Pending, Shell, useAuthedProfile } from "../components/Shell";
import { useStore } from "../store";

const COLUMNS = ["日期", "六位帳號（識別碼）", "介紹人", "被介紹人", "計劃", "佣金比例", "金額", "佣金", "狀態"];

const EMPTY_FILTERS = {
  accountCode: "",
  inviteCode: "",
  name: "",
  plan: "",
  status: "",
  dateFrom: "",
  dateTo: "",
};

const FIELD_CLASS = "mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-fg outline-none focus:border-gold";

export function AccountingPage() {
  const { profile, pending } = useAuthedProfile();
  const navigate = useNavigate();
  const allowed = canViewAccounting(profile);

  useEffect(() => {
    if (pending) return;
    if (!profile) navigate("/login");
    else if (!allowed) navigate("/");
  }, [pending, profile, allowed, navigate]);

  if (pending || !profile || !allowed) return <Pending />;
  return <Accounting profile={profile} />;
}

function Accounting({ profile }) {
  const store = useStore();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const summaries = summarizeByReferrer(store.db.commissions);
  const filtered = filterCommissions(store.db.commissions, filters, store.db.users);
  const rows = ledgerRows(filtered);
  const basicPercent = percentFromRate(store.db.basicCommissionRate);
  const vipPercent = percentFromRate(store.db.vipCommissionRate);
  const [basicDraft, setBasicDraft] = useState(String(basicPercent));
  const [vipDraft, setVipDraft] = useState(String(vipPercent));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const filtering = Object.values(filters).some((value) => String(value).trim());

  useEffect(() => {
    setBasicDraft(String(basicPercent));
  }, [basicPercent]);

  useEffect(() => {
    setVipDraft(String(vipPercent));
  }, [vipPercent]);

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function exportCsv() {
    const csv = commissionsCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "佣金帳目.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Shell profile={profile}>
      <p className="text-sm text-gold">{roleLabel(profile.role)}</p>
      <h1 className="mt-1 text-3xl font-semibold">佣金帳目</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        只有成功支付才記入佣金。基礎會員用基礎佣金比例，只在首次支付時計一次。VIP 用 VIP 佣金比例，每次支付或續費都計。註冊本身不計佣金。六位帳號是介紹人的會員編號。明細列出該筆使用的計劃和佣金比例。
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p>
            目前基礎佣金比例 <span className="font-semibold text-gold">{basicPercent}%</span>
          </p>
          <p>
            目前 VIP 佣金比例 <span className="font-semibold text-gold">{vipPercent}%</span>
          </p>
        </div>
        <button type="button" className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-bg" onClick={exportCsv}>
          匯出 CSV
        </button>
      </div>
      {canEditCommissionRate(profile) ? (
        <div className="mt-4 grid gap-3">
          <form
            className="flex flex-wrap items-center gap-2"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              try {
                store.setCommissionRate("basic", basicDraft);
                setNotice("基礎佣金比例已更新");
                setError("");
              } catch (err) {
                setNotice("");
                setError(err instanceof Error ? err.message : "未能更新佣金比例");
              }
            }}
          >
            <label className="text-sm" htmlFor="basic-commission-rate">
              基礎比例（%）
            </label>
            <input
              id="basic-commission-rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="rate-input rounded-lg border border-line bg-bg px-3 py-2"
              value={basicDraft}
              onChange={(event) => setBasicDraft(event.target.value)}
            />
            <button type="submit" className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-gold">
              儲存
            </button>
          </form>
          <form
            className="flex flex-wrap items-center gap-2"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              try {
                store.setCommissionRate("vip", vipDraft);
                setNotice("VIP 佣金比例已更新");
                setError("");
              } catch (err) {
                setNotice("");
                setError(err instanceof Error ? err.message : "未能更新佣金比例");
              }
            }}
          >
            <label className="text-sm" htmlFor="vip-commission-rate">
              VIP 比例（%）
            </label>
            <input
              id="vip-commission-rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="rate-input rounded-lg border border-line bg-bg px-3 py-2"
              value={vipDraft}
              onChange={(event) => setVipDraft(event.target.value)}
            />
            <button type="submit" className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-gold">
              儲存
            </button>
          </form>
        </div>
      ) : null}
      {notice ? <p className="mt-4 text-sm text-gold">{notice}</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <section className="mt-6">
        <h2 className="text-lg font-semibold">按介紹人</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">六位帳號（識別碼）</th>
                <th className="px-4 py-3 font-medium">介紹人</th>
                <th className="px-4 py-3 font-medium">筆數</th>
                <th className="px-4 py-3 font-medium">金額</th>
                <th className="px-4 py-3 font-medium">佣金</th>
              </tr>
            </thead>
            <tbody>
              {summaries.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-muted" colSpan={5}>
                    還沒有佣金紀錄
                  </td>
                </tr>
              ) : null}
              {summaries.map((row) => (
                <tr key={row.referrerId} className="border-t border-line">
                  <td className="px-4 py-3">{row.referrerAccountCode}</td>
                  <td className="px-4 py-3">{row.referrerName}</td>
                  <td className="px-4 py-3 tabular-nums">{row.count}</td>
                  <td className="px-4 py-3 tabular-nums">{formatMoney(row.paymentTotal)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatMoney(row.commissionTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">明細</h2>
          <p className="text-sm text-muted">共 {rows.length} 筆</p>
        </div>
        <p className="mt-1 text-sm text-muted">篩選會同時套用到這張明細和 CSV。上方按介紹人的合計維持全部紀錄。</p>
        <form className="ledger-filters mt-3 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 md:grid-cols-3">
          <label className="block text-sm text-muted">
            會員識別碼
            <input
              className={FIELD_CLASS}
              value={filters.accountCode}
              autoComplete="off"
              placeholder="例如 TP1001"
              onChange={(event) => setFilter("accountCode", event.target.value)}
            />
          </label>
          <label className="block text-sm text-muted">
            邀請碼
            <input
              className={FIELD_CLASS}
              value={filters.inviteCode}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="例如 ADMIN001"
              onChange={(event) => setFilter("inviteCode", event.target.value)}
            />
          </label>
          <label className="block text-sm text-muted">
            介紹人／被介紹人
            <input
              className={FIELD_CLASS}
              value={filters.name}
              autoComplete="off"
              placeholder="姓名"
              onChange={(event) => setFilter("name", event.target.value)}
            />
          </label>
          <label className="block text-sm text-muted">
            計劃
            <select
              className={FIELD_CLASS}
              value={filters.plan}
              onChange={(event) => setFilter("plan", event.target.value)}
            >
              <option value="">全部</option>
              {PLANS.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-muted">
            狀態
            <select
              className={FIELD_CLASS}
              value={filters.status}
              onChange={(event) => setFilter("status", event.target.value)}
            >
              <option value="">全部</option>
              <option value="recorded">已記錄</option>
            </select>
          </label>
          <label className="block text-sm text-muted">
            日期由
            <input
              className={`${FIELD_CLASS} ledger-date`}
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilter("dateFrom", event.target.value)}
            />
          </label>
          <label className="block text-sm text-muted">
            日期至
            <input
              className={`${FIELD_CLASS} ledger-date`}
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilter("dateTo", event.target.value)}
            />
          </label>
          {filtering ? (
            <div className="flex items-end">
              <button type="button" className="text-sm text-gold" onClick={() => setFilters(EMPTY_FILTERS)}>
                清除篩選
              </button>
            </div>
          ) : null}
        </form>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="ledger-table w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column} className="px-4 py-3 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-muted" colSpan={COLUMNS.length}>
                    {store.db.commissions.length === 0 ? "還沒有佣金紀錄" : "沒有符合條件的紀錄"}
                  </td>
                </tr>
              ) : null}
              {rows.map((row, index) => (
                <tr key={`${row["日期"]}-${row["被介紹人"]}-${row["計劃"]}-${index}`} className="border-t border-line">
                  {COLUMNS.map((column) => (
                    <td key={column} className="px-4 py-3">
                      {row[column]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}
