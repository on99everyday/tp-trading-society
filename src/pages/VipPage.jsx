import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../icons";
import { Pending, Shell, useAuthedProfile } from "../components/Shell";
import { useStore } from "../store";

export function VipPage() {
  const { profile, pending } = useAuthedProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!pending && !profile) navigate("/login");
  }, [pending, profile, navigate]);

  if (pending || !profile) return <Pending />;
  return <Vip profile={profile} />;
}

function Vip({ profile }) {
  const store = useStore();
  const [channelId, setChannelId] = useState(null);
  const [draft, setDraft] = useState("");
  const [channelName, setChannelName] = useState("");
  const [error, setError] = useState("");
  const canPost = profile.role === "staff" || profile.role === "admin";
  const channel = store.db.channels.find((item) => item.id === channelId) ?? null;
  const posts = channel ? store.postsFor(channel.id) : [];
  const prefs = store.emailPrefs();

  useEffect(() => {
    if (!profile.vip) return;
    const requested = Number(new URLSearchParams(window.location.search).get("channel"));
    const initial =
      store.db.channels.find((item) => item.id === requested) ?? store.db.channels[0] ?? null;
    if (initial) setChannelId(initial.id);
    // Only pick the landing channel once. Later posts and toggles must not jump the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.vip]);

  function openChannel(id) {
    setChannelId(id);
    setError("");
  }

  return (
    <Shell profile={profile}>
      <p className="text-sm text-gold">VIP群 復盤交流區</p>
      <h1 className="mt-1 text-3xl font-semibold">論壇頻道</h1>
      <Link to="/" className="mt-3 inline-block text-sm font-medium text-gold">
        返回課程首頁
      </Link>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {!profile.vip ? (
        <p className="mt-6 text-muted">
          VIP 覆盤區要每月付費後才開啟。VIP 會員付費 1500 後，可以瀏覽視頻及進入覆盤區。到期後要再付費。
          <Link to="/join" className="ml-2 text-gold">
            前往收費頁
          </Link>
        </p>
      ) : (
        <div className="mt-6 grid overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-[260px_1fr]">
          <aside className="border-b border-line p-3 md:border-r md:border-b-0">
            <p className="px-2 text-xs font-medium text-muted">頻道</p>
            <ul className="mt-2 space-y-1">
              {store.db.channels.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openChannel(item.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                      item.id === channelId ? "bg-bg text-gold" : "text-muted"
                    }`}
                  >
                    <Icon name="hash" className="size-4 shrink-0" />
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
            {canPost ? (
              <form
                className="mt-4 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  try {
                    const created = store.addChannel(channelName);
                    setChannelName("");
                    if (created.id) openChannel(created.id);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "建立頻道失敗");
                  }
                }}
              >
                <input
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
                  placeholder="新頻道名稱"
                  value={channelName}
                  onChange={(event) => setChannelName(event.target.value)}
                  required
                />
                <button type="submit" className="w-full rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-bg">
                  新增頻道
                </button>
              </form>
            ) : null}
            <div className="mt-5 border-t border-line pt-4">
              <p className="px-2 text-xs font-medium text-muted">電郵通知</p>
              <p className="mt-1 px-2 text-xs leading-relaxed text-muted">
                開啟後，該頻道有新發佈會寄到 {prefs.email || "你的登入電郵"}。
              </p>
              <ul className="mt-2 space-y-1">
                {prefs.channels.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="text-sm">#{item.name}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.emailOn}
                      aria-label={`${item.name}電郵通知`}
                      onClick={() => {
                        try {
                          store.setEmail(item.id, !item.emailOn);
                        } catch {
                          setError("未能儲存電郵設定");
                        }
                      }}
                      className={`relative h-6 w-11 shrink-0 rounded-full ${item.emailOn ? "bg-gold" : "bg-line"}`}
                    >
                      <span
                        className={`absolute top-0.5 size-5 rounded-full bg-bg ${item.emailOn ? "left-5" : "left-0.5"}`}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
          <section className="flex min-h-[480px] flex-col">
            <header className="border-b border-line px-4 py-3 font-semibold">
              {channel ? `# ${channel.name}` : "尚未有頻道"}
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {posts.length === 0 ? <p className="text-sm text-muted">這個頻道還沒有消息。</p> : null}
              {posts.map((post) => (
                <article key={post.id}>
                  <p className="text-sm">
                    <span className="font-semibold text-gold">{post.displayName}</span>
                    <span className="ml-2 text-xs text-muted">{post.createdAt.slice(0, 16).replace("T", " ")}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">{post.body}</p>
                </article>
              ))}
            </div>
            {canPost && channel ? (
              <form
                className="border-t border-line p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  try {
                    store.publishPost({ channelId: channel.id, body: draft });
                    setDraft("");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "發佈失敗");
                  }
                }}
              >
                <textarea
                  className="min-h-24 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg"
                  placeholder={`在 #${channel.name} 發佈消息`}
                  value={draft}
                  maxLength={1000}
                  onChange={(event) => setDraft(event.target.value)}
                  required
                />
                <button type="submit" className="mt-2 rounded-lg bg-gold px-5 py-3 font-semibold text-bg">
                  發佈
                </button>
              </form>
            ) : (
              <p className="border-t border-line px-4 py-3 text-sm text-muted">只有工作人員可以在頻道發佈消息。</p>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}
