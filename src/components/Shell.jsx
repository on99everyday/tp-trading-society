import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { headerLinks } from "../accounting";
import { PERMISSIONS, ROLES } from "../course";
import { Icon } from "../icons";
import { useStore } from "../store";

export function Pending() {
  return <p className="px-6 py-16 text-center text-muted">正在確認登入狀態…</p>;
}

export function useAuthedProfile() {
  const { profile } = useStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return { profile, pending: !ready };
}

export function Shell({ profile, children }) {
  const { recordLogin } = useStore();
  const apiRef = useRef({ recordLogin });
  apiRef.current.recordLogin = recordLogin;

  useEffect(() => {
    if (!profile?.email) return;
    const key = `xau-login:${profile.email}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const device = navigator.userAgent.slice(0, 180);
    (async () => {
      let region = "";
      try {
        const response = await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(2500) });
        const data = await response.json();
        if (data.success) region = [data.region, data.city].filter(Boolean).join(" · ");
      } catch {
        region = "";
      }
      apiRef.current.recordLogin(device, region);
    })();
  }, [profile?.email]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gold text-bg">
              <Icon name="candle" className="size-5" />
            </span>
            <span className="site-brand nowrap text-sm font-semibold tracking-wide">
              TP Trading <span className="text-gold">Society</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {headerLinks(profile).map((link) => (
              <Link key={link.href} to={link.href} className="nowrap text-sm font-medium text-gold">
                {link.label}
              </Link>
            ))}
            <Notifications enabled={profile != null} />
            <AccountMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {profile?.locked ? (
          <p className="rounded-xl border border-line bg-surface p-5 text-danger">
            這個帳號已被封控。請聯絡工作人員或管理員。
          </p>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

function AccountMenu() {
  const { profile, signOut } = useStore();
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const label = profile.displayName || profile.email || "Account";
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20">
        {label.charAt(0).toUpperCase()}
      </span>
      <span className="account-name text-sm font-medium">{label}</span>
      <Link to="/settings" className="nowrap text-sm font-medium text-gold">
        設定
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          signOut();
          window.location.assign("/login");
        }}
        className="nowrap cursor-pointer text-sm font-medium text-muted hover:text-gold disabled:cursor-wait"
      >
        {busy ? "登出中…" : "登出"}
      </button>
    </div>
  );
}

function Notifications({ enabled }) {
  const { notificationsForMe, markNotifications } = useStore();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState("unsupported");
  const seen = useRef(null);
  const snapshot = enabled ? notificationsForMe() : { items: [], unread: 0 };
  const signature = snapshot.items.map((item) => `${item.id}:${item.read}`).join(",");

  useEffect(() => {
    if (!enabled) return;
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (seen.current == null) {
      seen.current = new Set(snapshot.items.map((item) => item.id));
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      for (const item of snapshot.items) {
        if (!item.read && !seen.current.has(item.id)) {
          new Notification(item.title, { body: item.body });
        }
      }
    }
    seen.current = new Set(snapshot.items.map((item) => item.id));
  }, [enabled, signature]);

  if (!enabled) return null;

  return (
    <div className="relative">
      <button
        type="button"
        className="relative grid size-10 place-items-center rounded-lg text-gold"
        aria-label="通知"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="bell" className="size-5" />
        {snapshot.unread > 0 ? (
          <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-semibold text-bg">
            {snapshot.unread > 9 ? "9+" : snapshot.unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-medium">通知</p>
            <button
              type="button"
              className="text-xs text-gold"
              onClick={() => markNotifications({})}
            >
              全部已讀
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {snapshot.items.length === 0 ? (
              <li className="px-3 py-4 text-sm text-muted">還沒有通知</li>
            ) : null}
            {snapshot.items.map((item) => (
              <li key={item.id} className="border-t border-line">
                <a
                  href={item.href}
                  className="block px-3 py-3"
                  onClick={() => {
                    if (!item.read) markNotifications({ id: item.id });
                  }}
                >
                  <p className={`text-sm ${item.read ? "text-muted" : "font-medium"}`}>{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{item.body}</p>
                </a>
              </li>
            ))}
          </ul>
          {permission === "default" ? (
            <button
              type="button"
              className="w-full border-t border-line px-3 py-2 text-left text-xs text-gold"
              onClick={() => {
                Notification.requestPermission().then((result) => setPermission(result));
              }}
            >
              開啟桌面通知
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PowerTable({ rows, onChange }) {
  function enabled(role, permission) {
    return rows.find((row) => row.role === role && row.permission === permission)?.enabled ?? false;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="powers-table w-full text-left text-sm">
        <thead className="border-b border-line text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">功能</th>
            {ROLES.map((role) => (
              <th key={role.id} className="px-4 py-3 font-medium">
                {role.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((permission) => (
            <tr key={permission.key} className="border-t border-line">
              <td className="px-4 py-3">
                <p className="font-medium">{permission.label}</p>
                <p className="mt-0.5 text-xs text-muted">{permission.detail}</p>
              </td>
              {ROLES.map((role) => {
                const on = enabled(role.id, permission.key);
                const locked = role.id === "admin" && permission.key === "powers";
                return (
                  <td key={role.id} className="px-4 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${role.label}${permission.label}`}
                      disabled={locked || rows.length === 0}
                      title={locked ? "管理員必須保留這項，以免無法再改設定" : undefined}
                      onClick={() => onChange(role.id, permission.key, !on)}
                      className={`relative h-7 w-12 shrink-0 rounded-full disabled:opacity-60 ${on ? "bg-gold" : "bg-line"}`}
                    >
                      <span className={`absolute top-0.5 size-6 rounded-full bg-bg ${on ? "left-5" : "left-0.5"}`} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
