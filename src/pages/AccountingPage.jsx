import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  canEditCommissionRate,
  canViewAccounting,
  commissionsCsv,
  formatMoney,
  ledgerRows,
  percentFromRate,
  summarizeByReferrer,
} from "../accounting";
import { roleLabel } from "../course";
import { Pending, Shell, useAuthedProfile } from "../components/Shell";
import { useStore } from "../store";

const COLUMNS = ["日期", "六位帳號（識別碼）", "介紹人", "被介紹人", "計劃", "金額", "佣金", "狀態"];

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
  const summaries = summarizeByReferrer(store.db.commissions);
  const rows = ledgerRows(store.db.commissions);
  const ratePercent = percentFromRate(store.db.commissionRate);
  const [draft, setDraft] = useState(String(ratePercent));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(String(ratePercent));
  }, [ratePercent]);

  function exportCsv() {
    const csv = commissionsCsv(store.db.commissions);
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
        只有成功支付才記入佣金。基礎會員在首次支付時計一次，再次支付不會再計。VIP 每次支付或續費都計。註冊本身不計佣金。六位帳號是介紹人的會員編號。
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          目前佣金比例 <span className="font-semibold text-gold">{ratePercent}%</span>
        </p>
        <button type="button" className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-bg" onClick={exportCsv}>
          匯出 CSV
        </button>
      </div>
      {canEditCommissionRate(profile) ? (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            try {
              store.setCommissionRate(draft);
              setNotice("佣金比例已更新");
              setError("");
            } catch (err) {
              setNotice("");
              setError(err instanceof Error ? err.message : "未能更新佣金比例");
            }
          }}
        >
          <label className="text-sm" htmlFor="commission-rate">
            調整比例（%）
          </label>
          <input
            id="commission-rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            className="rate-input rounded-lg border border-line bg-bg px-3 py-2"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-gold">
            儲存
          </button>
        </form>
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
        <h2 className="text-lg font-semibold">明細</h2>
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
                    還沒有佣金紀錄
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
