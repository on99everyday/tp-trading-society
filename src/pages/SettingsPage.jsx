import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../icons";
import { Pending, Shell, useAuthedProfile } from "../components/Shell";
import {
  NOTIFICATION_OPTIONS,
  passwordMode,
  passwordModeCopy,
  persistNote,
  readMemberSettings,
  subscriptionSummary,
  twoFactorCopy,
} from "../settings/account";
import { useStore } from "../store";

export function SettingsPage() {
  const { profile, pending } = useAuthedProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!pending && !profile) navigate("/login", { replace: true });
  }, [pending, profile, navigate]);

  if (pending || !profile) return <Pending />;
  return <Settings profile={profile} />;
}

function Settings({ profile }) {
  return (
    <Shell profile={profile}>
      <p className="text-sm text-gold">會員</p>
      <h1 className="mt-1 text-3xl font-semibold">設定</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">管理顯示名稱、會籍、通知及登入安全。</p>
      <Link to="/" className="mt-3 inline-block text-sm font-medium text-gold">
        返回課程首頁
      </Link>
      <div className="mt-6 max-w-2xl space-y-6">
        <AccountSection profile={profile} />
        <SubscriptionSection profile={profile} />
        <NotificationSection />
        <SecuritySection />
      </div>
    </Shell>
  );
}

function AccountSection({ profile }) {
  const { updateDisplayName } = useStore();
  const [name, setName] = useState(profile.displayName || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const saved = updateDisplayName(name);
      setName(saved);
      setMessage("顯示名稱已更新。之後請用這個名稱登入。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "未能更新顯示名稱。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">基本資料</h2>
      <p className="mt-1 text-sm text-muted">顯示名稱也是登入名稱。電郵暫時不能在這裡修改。</p>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <label className="block text-sm text-muted">
          顯示名稱
          <input
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg outline-none focus:border-gold"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="nickname"
            maxLength={40}
            required
          />
        </label>
        <label className="block text-sm text-muted">
          電郵
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg outline-none"
            value={profile.email || ""}
            readOnly
            aria-readonly="true"
          />
        </label>
        <p className="text-xs text-muted">電郵用於重設密碼，暫時不能在這裡修改。</p>
        <label className="block text-sm text-muted">
          會員編號
          <input
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg outline-none"
            value={profile.accountCode || ""}
            readOnly
            aria-readonly="true"
          />
        </label>
        <p className="text-xs text-muted">
          這是你的會員編號。其他人註冊時可填作邀請碼，並會加入你的團隊。ZZ 開頭是無團隊自來客。
        </p>
        {message ? <p className="text-sm text-gold">{message}</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-gold px-5 py-3 font-semibold text-bg disabled:opacity-60"
        >
          {busy ? "儲存中…" : "儲存名稱"}
        </button>
      </form>
    </section>
  );
}

function SubscriptionSection({ profile }) {
  const summary = subscriptionSummary(profile);
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">會籍狀態</h2>
      <p className="mt-1 text-sm text-muted">{summary.billing}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {summary.labels.map((label) => (
          <span key={label} className={badgeClass(label)}>
            {label}
          </span>
        ))}
      </div>
      {summary.expiry ? <p className="membership-expiry">{summary.expiry}</p> : null}
      <Link to="/join" className="mt-4 inline-block text-sm font-medium text-gold">
        查看收費頁
      </Link>
    </section>
  );
}

function NotificationSection() {
  const { user, updateSettings } = useStore();
  const settings = readMemberSettings(user);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  async function toggle(key) {
    setError("");
    setBusyKey(key);
    try {
      const result = await updateSettings({ [key]: !settings[key] });
      setNote(persistNote(result.mirror));
    } catch (err) {
      setError(err instanceof Error ? err.message : "未能儲存通知偏好");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">通知偏好</h2>
      <p className="mt-1 text-sm text-muted">這些選項會儲存。正式電郵尚未接通，暫時不會因此寄出。</p>
      <ul className="mt-4 space-y-4">
        {NOTIFICATION_OPTIONS.map((option) => (
          <li key={option.key} className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">{option.detail}</span>
            </span>
            <Toggle
              on={Boolean(settings[option.key])}
              label={option.label}
              disabled={busyKey !== ""}
              onClick={() => toggle(option.key)}
            />
          </li>
        ))}
      </ul>
      {note ? <p className="mt-4 text-sm text-gold">{note}</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
    </section>
  );
}

function SecuritySection() {
  const { user, updateSettings, changePassword } = useStore();
  const settings = readMemberSettings(user);
  const [mode, setMode] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [factorNote, setFactorNote] = useState("");
  const [factorError, setFactorError] = useState("");
  const [factorBusy, setFactorBusy] = useState(false);

  useEffect(() => {
    let active = true;
    import("../auth/client")
      .then(({ getAuthClient }) => passwordMode(getAuthClient()))
      .then((result) => {
        if (active) setMode(result);
      })
      .catch(() => {
        if (active) setMode({ mode: "local", email: "" });
      });
    return () => {
      active = false;
    };
  }, []);

  async function onPassword(event) {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");
    setPasswordBusy(true);
    try {
      const result = await changePassword({ currentPassword, nextPassword, confirm });
      if (!result.ok) {
        setPasswordError(result.message);
        return;
      }
      setCurrentPassword("");
      setNextPassword("");
      setConfirm("");
      setPasswordMessage(result.message);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "未能更新密碼");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function toggleFactor() {
    setFactorError("");
    setFactorBusy(true);
    try {
      const result = await updateSettings({ twoFactor: !settings.twoFactor });
      setFactorNote(persistNote(result.mirror));
    } catch (err) {
      setFactorError(err instanceof Error ? err.message : "未能儲存兩步驗證偏好");
    } finally {
      setFactorBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">安全</h2>
      <h3 className="mt-4 text-sm font-semibold">更改密碼</h3>
      <p className="mt-1 text-sm text-muted">
        {mode ? passwordModeCopy(mode.mode) : "正在確認登入階段…"}
      </p>
      {mode?.email ? <p className="mt-1 text-xs text-muted">雲端帳號電郵：{mode.email}</p> : null}
      <form className="mt-3 space-y-3" onSubmit={onPassword}>
        <label className="block text-sm text-muted">
          目前密碼
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg outline-none focus:border-gold"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm text-muted">
          新密碼
          <span className="relative mt-1 block">
            <input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              className="w-full rounded-lg border border-line bg-bg px-3 py-3 pr-12 text-fg outline-none focus:border-gold"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              minLength={8}
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
          />
        </label>
        {passwordMessage ? <p className="text-sm text-gold">{passwordMessage}</p> : null}
        {passwordError ? <p className="text-sm text-danger">{passwordError}</p> : null}
        <button
          type="submit"
          disabled={passwordBusy}
          className="rounded-lg bg-gold px-5 py-3 font-semibold text-bg disabled:opacity-60"
        >
          {passwordBusy ? "更新中…" : "更新密碼"}
        </button>
      </form>
      <div className="mt-6 border-t border-line pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">兩步驗證</h3>
            <p className="mt-1 text-sm text-muted">{twoFactorCopy(settings.twoFactor)}</p>
          </div>
          <Toggle
            on={settings.twoFactor}
            label="兩步驗證"
            disabled={factorBusy}
            onClick={toggleFactor}
          />
        </div>
        {factorNote ? <p className="mt-3 text-sm text-gold">{factorNote}</p> : null}
        {factorError ? <p className="mt-3 text-sm text-danger">{factorError}</p> : null}
      </div>
    </section>
  );
}

function Toggle({ on, label, disabled, onClick }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full disabled:opacity-60 ${on ? "bg-gold" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 size-6 rounded-full bg-bg ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

function badgeClass(label) {
  if (label === "VIP") return "badge badge-vip";
  if (label === "基礎") return "badge badge-basic";
  return "badge badge-unpaid";
}
