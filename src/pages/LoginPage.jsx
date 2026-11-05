import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { useStore } from "../store";

const PROVIDERS = [
  { providerId: "grok-google", label: "Google" },
  { providerId: "grok-x", label: "X" },
];

export function LoginPage() {
  const { signIn, signUp, nameTaken } = useStore();
  const [mode, setMode] = useState("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("xau-login:")) sessionStorage.removeItem(key);
    }
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const trimmed = name.trim();
      if (mode === "up") {
        if (nameTaken(trimmed)) {
          setError("此名稱已有人使用");
          return;
        }
        const result = signUp({ name: trimmed, email, password });
        if (result.taken) {
          setError("此名稱已有人使用");
          return;
        }
        window.location.assign("/join");
        return;
      }
      try {
        signIn(trimmed, password);
      } catch {
        setError("名稱或密碼不正確");
        return;
      }
      window.location.assign("/");
    } catch {
      setError(mode === "up" ? "註冊失敗" : "登入服務暫時無法使用");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-none sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-gold text-bg">
            <Icon name="candle" className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">TP Trading Society</h1>
            <p className="text-sm text-muted">註冊後會前往收費頁。登入請用註冊時的名稱。</p>
          </div>
        </div>
        <div className="mb-5 grid grid-cols-2 rounded-lg bg-bg p-1">
          <button
            type="button"
            className={`rounded-lg py-2 text-sm font-medium ${mode === "in" ? "bg-gold text-bg" : "text-muted"}`}
            onClick={() => setMode("in")}
          >
            登入
          </button>
          <button
            type="button"
            className={`rounded-lg py-2 text-sm font-medium ${mode === "up" ? "bg-gold text-bg" : "text-muted"}`}
            onClick={() => setMode("up")}
          >
            註冊
          </button>
        </div>
        <form className="space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm text-muted">
            名稱
            <input
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg outline-none focus:border-gold"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          {mode === "up" ? (
            <label className="block text-sm text-muted">
              電郵
              <input
                type="email"
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg outline-none focus:border-gold"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
          ) : null}
          <label className="block text-sm text-muted">
            密碼
            <span className="relative mt-1 block">
              <input
                type={show ? "text" : "password"}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                className="w-full rounded-lg border border-line bg-bg px-3 py-3 pr-12 text-fg outline-none focus:border-gold"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={mode === "up" ? 8 : 6}
                required
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
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gold py-3 font-semibold text-bg disabled:opacity-60"
          >
            {busy ? "處理中…" : mode === "up" ? "建立帳號" : "登入"}
          </button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          或
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="space-y-2">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              onClick={() => setError("此環境未設定 Grok OAuth。請用名稱與密碼登入。")}
              className="w-full rounded-lg border border-line py-3 text-sm font-medium hover:border-gold"
            >
              使用 {provider.label} 繼續
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
