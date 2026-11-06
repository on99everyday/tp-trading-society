import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { useStore } from "../store";

export function LoginPage() {
  const { signIn, signUp, nameTaken } = useStore();
  const [mode, setMode] = useState("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("xau-login:")) sessionStorage.removeItem(key);
    }
  }, []);

  function switchMode(next) {
    setMode(next);
    setError("");
  }

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
        const result = signUp({ name: trimmed, email, password, inviteCode });
        if (result.taken) {
          setError(result.field === "email" ? "此電郵已有人使用" : "此名稱已有人使用");
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(mode === "up" ? message || "註冊失敗" : "登入服務暫時無法使用");
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
            onClick={() => switchMode("in")}
          >
            登入
          </button>
          <button
            type="button"
            className={`rounded-lg py-2 text-sm font-medium ${mode === "up" ? "bg-gold text-bg" : "text-muted"}`}
            onClick={() => switchMode("up")}
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
          {mode === "up" ? (
            <>
              <label className="block text-sm text-muted">
                會員邀請碼
                <input
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg outline-none focus:border-gold"
                  placeholder="選填，例如 TP1001"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                />
              </label>
              <p className="text-xs text-muted">有邀請碼會加入對方的團隊。留空則是無團隊自來客。</p>
            </>
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
        {mode === "in" ? <ForgotPassword /> : null}
      </div>
    </main>
  );
}

function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const [{ getAuthClient }, { requestPasswordReset }] = await Promise.all([
        import("../auth/client"),
        import("../auth/reset"),
      ]);
      const result = await requestPasswordReset(getAuthClient(), email);
      if (result.ok) setMessage(result.message);
      else setError(result.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex justify-end">
        <button type="button" className="text-sm font-medium text-gold" onClick={() => setOpen((value) => !value)}>
          忘記密碼
        </button>
      </div>
      {open ? (
        <form className="mt-3 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm text-muted">
            登記電郵
            <input
              type="email"
              autoComplete="email"
              required
              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg outline-none focus:border-gold"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {message ? <p className="text-sm text-muted">{message}</p> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg border border-gold py-3 font-semibold text-gold disabled:opacity-60"
          >
            {busy ? "寄出中…" : "寄出重設連結"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
