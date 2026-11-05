import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PLANS } from "../course";
import { Pending, Shell, useAuthedProfile } from "../components/Shell";
import { useStore } from "../store";

export function JoinPage() {
  const { profile, pending } = useAuthedProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!pending && !profile) navigate("/login");
  }, [pending, profile, navigate]);

  if (pending || !profile) return <Pending />;
  return <Join profile={profile} />;
}

function Join({ profile }) {
  const { pay } = useStore();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  return (
    <Shell profile={profile}>
      <p className="text-sm text-gold">註冊完成</p>
      <h1 className="mt-1 text-3xl font-semibold">收費頁面</h1>
      <p className="mt-2 max-w-xl text-muted">
        基礎會員只付一次，永久瀏覽視頻。VIP 會員每月付費，可以瀏覽視頻及進入覆盤區。
      </p>
      <p className="mt-2 max-w-xl text-sm text-muted">示範環境不會扣款，按下支付會直接開通。</p>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {PLANS.map((plan) => {
          const owned = plan.id === "basic" ? profile.basic : profile.vip;
          const until = plan.id === "vip" && profile.vipUntil ? profile.vipUntil.slice(0, 10) : "";
          return (
            <article key={plan.id} className="rounded-xl border border-line bg-surface p-5">
              <p className="text-xs font-medium text-gold">{plan.kind}</p>
              <h2 className="mt-1 text-xl font-semibold">{plan.name}</h2>
              <p className="mt-4 text-sm text-muted">費用</p>
              <p className="text-4xl font-semibold text-gold">{plan.price}</p>
              <p className="mt-1 text-sm">{plan.term}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{plan.detail}</p>
              {plan.id === "basic" && owned ? <p className="mt-3 text-sm text-gold">已付費，永久開通</p> : null}
              {plan.id === "vip" && until ? <p className="mt-3 text-sm text-gold">已付費，開通至 {until}</p> : null}
              {plan.id === "vip" && !profile.vip ? (
                <p className="mt-3 text-sm text-muted">未付費或已到期，視頻與覆盤區未開啟</p>
              ) : null}
              <button
                type="button"
                disabled={busy !== null || owned}
                className="mt-5 rounded-lg bg-gold px-5 py-3 font-semibold text-bg disabled:opacity-50"
                onClick={() => {
                  setBusy(plan.id);
                  setError("");
                  try {
                    pay(plan.id);
                    if (plan.id === "basic") navigate("/videos");
                    else navigate("/vip");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "未能完成繳費");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {owned && plan.id === "basic"
                  ? "已永久開通"
                  : owned && plan.id === "vip"
                    ? "本月已開通"
                    : busy === plan.id
                      ? "處理中…"
                      : plan.action}
              </button>
            </article>
          );
        })}
      </div>
    </Shell>
  );
}
