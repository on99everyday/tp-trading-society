import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { STAFF_KEYS, formatDuration, roleLabel } from "../course";
import { Icon } from "../icons";
import { Pending, PowerTable, Shell, useAuthedProfile } from "../components/Shell";
import { useStore } from "../store";

export function StaffPage() {
  const { profile, pending } = useAuthedProfile();
  const navigate = useNavigate();
  const allowed = profile?.powers.some((power) => STAFF_KEYS.includes(power));

  useEffect(() => {
    if (pending) return;
    if (!profile) navigate("/login");
    else if (!allowed) navigate("/");
  }, [pending, profile, allowed, navigate]);

  if (pending || !profile || !allowed) return <Pending />;
  return <Staff profile={profile} />;
}

function Staff({ profile }) {
  const store = useStore();
  const firstTab = profile.powers.includes("upload")
    ? "upload"
    : profile.powers.includes("remove")
      ? "clips"
      : profile.powers.includes("logs")
        ? "logs"
        : "access";
  const [tab, setTab] = useState(firstTab);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const tabs = [
    ...(profile.powers.includes("upload") ? [["upload", "上架短片"]] : []),
    ...(profile.powers.includes("upload") || profile.powers.includes("remove") ? [["clips", "已上架"]] : []),
    ...(profile.powers.includes("logs") ? [["logs", "觀看紀錄"]] : []),
    ...(profile.powers.includes("roles") || profile.powers.includes("accounts") || profile.powers.includes("powers")
      ? [["access", "權限設定"]]
      : []),
    ...(profile.role === "admin" || profile.role === "staff" ? [["guard", "登入封控"]] : []),
  ];

  return (
    <Shell profile={profile}>
      <p className="text-sm text-gold">{profile.role === "admin" ? "管理員" : "工作人員"}</p>
      <h1 className="mt-1 text-3xl font-semibold">後台</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        短片檔案請放到你的雲端（例如 Cloudflare R2、Amazon S3，或 YouTube 非公開影片）。這裡只保存可播放的 https
        網址，以及每位學員的觀看次數與累計時間。學員看不到這些紀錄。
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === id ? "bg-gold text-bg" : "bg-surface text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {notice ? <p className="mt-4 text-sm text-gold">{notice}</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {tab === "guard" ? <Guard /> : null}
      {tab === "upload" ? (
        <UploadForm
          onDone={() => {
            setNotice("短片已上架");
            setError("");
            setTab("clips");
          }}
          onError={(message) => {
            setNotice("");
            setError(message);
          }}
        />
      ) : null}
      {tab === "clips" ? (
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
          {store.db.videos.length === 0 ? <li className="p-5 text-muted">還沒有短片</li> : null}
          {store.db.videos.map((video) => (
            <li key={video.id} className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-xs text-gold">{video.moduleCode}</p>
                <p className="font-medium">{video.title}</p>
                <p className="mt-1 break-all text-sm text-muted">{video.sourceUrl}</p>
              </div>
              {profile.powers.includes("remove") ? (
                <button
                  type="button"
                  className="shrink-0 text-sm text-danger"
                  onClick={() => store.removeVideo(video.id)}
                >
                  移除
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "logs" ? <Logs /> : null}
      {tab === "access" &&
      (profile.powers.includes("roles") || profile.powers.includes("accounts") || profile.powers.includes("powers")) ? (
        <>
          {profile.powers.includes("powers") ? (
            <section className="mt-6">
              <h2 className="text-lg font-semibold">角色權力</h2>
              <p className="mt-1 mb-3 text-sm text-muted">
                開關學員、工作人員和管理員可以使用的功能。管理員的「修改角色權力」不能關閉。
              </p>
              <PowerTable
                rows={store.db.powers}
                onChange={(role, permission, enabled) => {
                  try {
                    store.setPower(role, permission, enabled);
                    setNotice("權限已更新");
                    setError("");
                  } catch (err) {
                    setNotice("");
                    setError(err instanceof Error ? err.message : "更新失敗");
                  }
                }}
              />
            </section>
          ) : null}
          {profile.powers.includes("roles") || profile.powers.includes("accounts") ? (
            <Accounts
              selfEmail={profile.email}
              canAccounts={profile.powers.includes("accounts")}
              canRoles={profile.powers.includes("roles")}
              onChange={(message) => {
                setNotice(message);
                setError("");
              }}
              onError={(message) => {
                setNotice("");
                setError(message);
              }}
            />
          ) : null}
        </>
      ) : null}
    </Shell>
  );
}

function UploadForm({ onDone, onError }) {
  const { db, addVideo, addModule } = useStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [moduleCode, setModuleCode] = useState(db.modules[0]?.code || "");
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  const [blurb, setBlurb] = useState("");

  return (
    <form
      className="mt-6 space-y-3 rounded-xl border border-line bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        try {
          addVideo({ title, description, moduleCode, sourceUrl });
          setTitle("");
          setDescription("");
          setSourceUrl("");
          onDone();
        } catch (err) {
          onError(err instanceof Error ? err.message : "上架失敗");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm text-muted">
        標題
        <input
          className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </label>
      <label className="block text-sm text-muted">
        說明
        <textarea
          className="mt-1 min-h-24 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-muted">
            單元
            <select
              className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg"
              value={moduleCode}
              onChange={(event) => setModuleCode(event.target.value)}
              required
            >
              {db.modules.map((module) => (
                <option key={module.code} value={module.code}>
                  {module.code} {module.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="mt-2 text-sm text-gold" onClick={() => setCreating((value) => !value)}>
            {creating ? "取消新增" : "新增單元"}
          </button>
        </div>
        <label className="block text-sm text-muted">
          雲端或 YouTube 網址
          <input
            className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg"
            placeholder="https://"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            required
          />
        </label>
      </div>
      {creating ? (
        <div className="grid gap-3 rounded-lg border border-line bg-bg p-4 sm:grid-cols-3">
          <input
            className="rounded-lg border border-line bg-surface px-3 py-3"
            placeholder="編號，例如 UNIT 07"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <input
            className="rounded-lg border border-line bg-surface px-3 py-3"
            placeholder="單元名稱"
            value={moduleTitle}
            onChange={(event) => setModuleTitle(event.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border border-gold px-4 py-3 font-semibold text-gold"
            onClick={() => {
              try {
                const created = addModule({ code, title: moduleTitle, blurb });
                setModuleCode(created.code);
                setCode("");
                setModuleTitle("");
                setBlurb("");
                setCreating(false);
              } catch (err) {
                onError(err instanceof Error ? err.message : "新增單元失敗");
              }
            }}
          >
            建立單元
          </button>
          <input
            className="rounded-lg border border-line bg-surface px-3 py-3 sm:col-span-3"
            placeholder="簡介（可留空）"
            value={blurb}
            onChange={(event) => setBlurb(event.target.value)}
          />
        </div>
      ) : null}
      <button type="submit" disabled={busy} className="rounded-lg bg-gold px-5 py-3 font-semibold text-bg">
        {busy ? "上架中…" : "上架短片"}
      </button>
    </form>
  );
}

function Logs() {
  const { db, people } = useStore();
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [picked, setPicked] = useState("");
  const needle = applied.trim().toLowerCase();
  const directory = people();
  const matches = needle
    ? directory.filter(
        (person) =>
          person.displayName.toLowerCase().includes(needle) || person.email.toLowerCase().includes(needle),
      )
    : [];
  const person = matches.find((item) => item.email.toLowerCase() === picked.toLowerCase()) ?? null;
  const rows = person
    ? db.watches.filter((item) => item.email.toLowerCase() === person.email.toLowerCase())
    : db.watches;

  return (
    <div className="mt-6 space-y-4">
      <form
        className="flex max-w-xl flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(query.trim());
          setPicked("");
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-3 text-fg outline-none focus:border-gold"
          placeholder="搜尋學員名稱"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="rounded-lg bg-gold px-5 py-3 font-semibold text-bg">
          搜尋
        </button>
      </form>
      {needle && !person ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {matches.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted">找不到「{applied}」</p>
          ) : (
            <ul className="divide-y divide-line">
              {matches.map((item) => {
                const count = db.watches.filter(
                  (row) => row.email.toLowerCase() === item.email.toLowerCase(),
                ).length;
                return (
                  <li key={item.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium">{item.displayName}</p>
                      <p className="text-xs text-muted">{item.email}</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-sm font-medium text-gold"
                      onClick={() => setPicked(item.email)}
                    >
                      觀看紀錄{count > 0 ? `（${count}）` : ""}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
      {person ? (
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">
            {person.displayName}
            <span className="ml-2 text-sm font-normal text-muted">{person.email}</span>
          </p>
          <button type="button" className="text-sm text-gold" onClick={() => setPicked("")}>
            返回搜尋結果
          </button>
        </div>
      ) : null}
      {!needle || person ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                {person ? null : <th className="px-4 py-3 font-medium">學員</th>}
                <th className="px-4 py-3 font-medium">短片</th>
                <th className="px-4 py-3 font-medium">次數</th>
                <th className="px-4 py-3 font-medium">時間</th>
                <th className="px-4 py-3 font-medium">最後觀看</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-muted" colSpan={person ? 4 : 5}>
                    {person ? "這位學員還沒有觀看紀錄" : "還沒有觀看紀錄"}
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={`${row.email}-${row.videoId}`} className="border-t border-line">
                  {person ? null : (
                    <td className="px-4 py-3">
                      {row.displayName}
                      <span className="block text-xs text-muted">{row.email}</span>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {row.title}
                    <span className="block text-xs text-muted">{row.moduleCode}</span>
                  </td>
                  <td className="px-4 py-3">{row.viewCount}</td>
                  <td className="px-4 py-3">{formatDuration(row.watchSeconds)}</td>
                  <td className="px-4 py-3 text-muted">{row.lastViewedAt?.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function Accounts({ selfEmail, canAccounts, canRoles, onChange, onError }) {
  const { people, addAccount, setRole, deleteUser, signOut } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState("");
  const [role, setRoleValue] = useState("student");

  return (
    <div className="mt-6 space-y-4">
      {canAccounts ? (
        <form
          className="grid gap-3 rounded-xl border border-line bg-surface p-5 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              addAccount({ name, email, password });
              setName("");
              setEmail("");
              setPassword("");
              onChange("學員帳號已建立");
            } catch (err) {
              onError(err instanceof Error ? err.message : "建立失敗");
            }
          }}
        >
          <input
            className="rounded-lg border border-line bg-bg px-3 py-3"
            placeholder="名稱"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <input
            type="email"
            className="rounded-lg border border-line bg-bg px-3 py-3"
            placeholder="電郵"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <span className="relative">
            <input
              type={show ? "text" : "password"}
              className="w-full rounded-lg border border-line bg-bg px-3 py-3 pr-12"
              placeholder="至少 8 位密碼"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
          <button type="submit" className="rounded-lg bg-gold px-4 py-3 font-semibold text-bg">
            新增學員
          </button>
        </form>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">成員</th>
              <th className="px-4 py-3 font-medium">賬號</th>
              <th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {people().map((person) => {
              const mine = person.email.toLowerCase() === selfEmail.toLowerCase();
              const editingRow = editing === person.userId;
              return (
                <tr key={person.userId} className="border-t border-line">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold text-sm font-semibold text-bg">
                        {person.displayName.slice(0, 1) || "員"}
                      </span>
                      {person.displayName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{person.email}</td>
                  <td className="px-4 py-3">
                    {editingRow ? (
                      <select
                        className="rounded-lg border border-line bg-bg px-2 py-1.5 text-fg"
                        value={role}
                        onChange={(event) => setRoleValue(event.target.value)}
                      >
                        <option value="student">學員</option>
                        <option value="staff">工作人員</option>
                        <option value="admin">管理員</option>
                      </select>
                    ) : (
                      roleLabel(person.role)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {mine ? (
                      <button
                        type="button"
                        className="text-gold"
                        onClick={() => {
                          signOut();
                          window.location.assign("/login");
                        }}
                      >
                        退出
                      </button>
                    ) : editingRow ? (
                      <span className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          className="text-gold"
                          onClick={() => {
                            try {
                              setRole(person.userId, role);
                              setEditing("");
                              onChange(`已改為${roleLabel(role)}`);
                            } catch (err) {
                              onError(err instanceof Error ? err.message : "更新失敗");
                            }
                          }}
                        >
                          儲存
                        </button>
                        <span className="text-muted">|</span>
                        <button type="button" className="text-gold" onClick={() => setEditing("")}>
                          取消
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        {canRoles ? (
                          <button
                            type="button"
                            className="text-gold"
                            onClick={() => {
                              setEditing(person.userId);
                              setRoleValue(
                                person.role === "admin" || person.role === "staff" ? person.role : "student",
                              );
                            }}
                          >
                            編輯
                          </button>
                        ) : null}
                        {canRoles ? (
                          <>
                            <span className="text-muted">|</span>
                            <button
                              type="button"
                              className="text-gold"
                              onClick={() => {
                                if (!window.confirm(`刪除 ${person.displayName}？`)) return;
                                try {
                                  deleteUser(person.userId);
                                  onChange("已刪除帳號");
                                } catch (err) {
                                  onError(err instanceof Error ? err.message : "刪除失敗");
                                }
                              }}
                            >
                              刪除
                            </button>
                          </>
                        ) : null}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Guard() {
  const { db, setLocked } = useStore();
  const [error, setError] = useState("");

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-muted">
        每次登入會記下裝置、時間和地區。若短時間內從不同地區登入（例如上一秒在廣東，下一秒在北京），會在這裡提示工作人員和管理員，並可以封控。
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <section>
        <h2 className="text-lg font-semibold">異常提示</h2>
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
          {db.alerts.length === 0 ? <li className="p-4 text-sm text-muted">暫時沒有異常登入</li> : null}
          {db.alerts.map((alert) => (
            <li key={alert.id} className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{alert.displayName}</p>
                <p className="mt-1 text-sm text-muted">{alert.detail}</p>
                <p className="mt-1 text-xs text-muted">{alert.createdAt.slice(0, 16).replace("T", " ")}</p>
              </div>
              <button
                type="button"
                className={`shrink-0 text-sm ${alert.locked ? "text-gold" : "text-danger"}`}
                onClick={() => {
                  try {
                    setLocked(alert.userId, !alert.locked);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "未能更新封控");
                  }
                }}
              >
                {alert.locked ? "解除封控" : "封控"}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">登入紀錄</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">學員</th>
                <th className="px-4 py-3 font-medium">地區</th>
                <th className="px-4 py-3 font-medium">時間</th>
                <th className="px-4 py-3 font-medium">裝置</th>
              </tr>
            </thead>
            <tbody>
              {db.logins.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-muted" colSpan={4}>
                    還沒有登入紀錄
                  </td>
                </tr>
              ) : null}
              {[...db.logins].reverse().map((row) => (
                <tr key={`${row.userId}-${row.loggedAt}`} className="border-t border-line">
                  <td className="px-4 py-3">{row.displayName}</td>
                  <td className="px-4 py-3">{row.region}</td>
                  <td className="px-4 py-3 text-muted">{row.loggedAt.slice(0, 16).replace("T", " ")}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted">{row.device}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
