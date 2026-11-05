import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAuthClient } from "../auth/client";
import {
  RESET_UNCONFIGURED,
  openRecovery,
  saveNewPassword,
  validateNewPassword,
} from "../auth/reset";
import { Icon } from "../icons";
import { useStore } from "../store";

export default function ResetPage() {
  const { setPasswordForEmail } = useStore();
  const [status, setStatus] = useState("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [localUpdated, setLocalUpdated] = useState(false);

  useEffect(() => {
    const client = getAuthClient();
    if (!client) {
      setStatus("invalid");
      setError(RESET_UNCONFIGURED);
      return;
    }
    let active = true;
    let ready = false;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        ready = true;
        setEmail(session.user.email || "");
        setStatus("ready");
        setError("");
      }
    });
    openRecovery(client, window.location.href).then((result) => {
      if (!active || ready) return;
      if (result.ok) {
        ready = true;
        setEmail(result.email || "");
        setStatus("ready");
        setError("");
        return;
      }
      setStatus("invalid");
      setError(result.message);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    const problem = validateNewPassword(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    const client = getAuthClient();
    if (!client || status !== "ready") {
      setError(RESET_UNCONFIGURED);
      return;
    }
    setBusy(true);
    try {
      const saved = await saveNewPassword(client, password);
      if (!saved.ok) {
        setError(saved.message);
        return;
      }
      const updated = email ? setPasswordForEmail(email, password) : false;
      setLocalUpdated(updated);
      await client.auth.signOut();
      setStatus("done");
    } finally {
      setBusy(false);
    }
  }

  const formReady = status === "ready";

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-gold text-bg">
            <Icon name="candle" className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">TP Trading Society</h1>
            <p className="text-sm text-muted">設定新密碼</p>
          </div>
        </div>
        {status === "checking" ? <p className="text-sm text-muted">正在確認重設連結…</p> : null}
        {status === "done" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {localUpdated
                ? "密碼已更新。請用新密碼，以原本的登入名稱登入。"
                : "登入服務的密碼已更新，但這部瀏覽器沒有相同電郵的課程帳號，課程登入密碼未改。"}
            </p>
            <Link to="/login" className="inline-block text-sm font-medium text-gold">
              返回登入
            </Link>
          </div>
        ) : status === "checking" ? null : (
          <form className="space-y-3" onSubmit={onSubmit}>
            {email ? <p className="text-sm text-muted">電郵：{email}</p> : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {!formReady && !error ? <p className="text-sm text-muted">請從電郵中的連結開啟此頁。</p> : null}
            <label className="block text-sm text-muted">
              新密碼
              <span className="relative mt-1 block">
                <input
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-line bg-bg px-3 py-3 pr-12 text-fg outline-none focus:border-gold"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                  disabled={!formReady || busy}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center text-gold"
                  onClick={() => setShow((value) => !value)}
                  aria-pressed={show}
                  aria-label={show ? "隱藏密碼" : "顯示密碼"}
                >
                  <Icon name={show ? "eye-off" : "eye"} className="size-5" />
                </button>
              </span>
            </label>
            <label className="block text-sm text-muted">
              再輸入一次
              <input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg outline-none focus:border-gold"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                minLength={8}
                required
                disabled={!formReady || busy}
              />
            </label>
            <button
              type="submit"
              disabled={!formReady || busy}
              className="w-full rounded-lg bg-gold py-3 font-semibold text-bg disabled:opacity-60"
            >
              {busy ? "更新中…" : "更新密碼"}
            </button>
            <Link to="/login" className="inline-block text-sm font-medium text-gold">
              返回登入
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
