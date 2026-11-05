import { useEffect, useMemo, useRef, useState } from "react";
import { getChatClient } from "../chat/client";
import { CHAT_NOT_CONFIGURED } from "../chat/config";
import {
  chatErrorMessage,
  mergeMessages,
  normalizeChannel,
  normalizeMessage,
  presenceList,
  validateBody,
  validateChannelName,
} from "../chat/messages";
import { roleLabel } from "../course";
import { Icon } from "../icons";
import { useStore } from "../store";

const MESSAGE_COLUMNS = "id,channel_id,body,author_id,author_name,author_role,kind,created_at";

export default function VipChat({ profile }) {
  const store = useStore();
  const client = useMemo(() => getChatClient(), []);
  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [draft, setDraft] = useState("");
  const [channelName, setChannelName] = useState("");
  const [announce, setAnnounce] = useState(false);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const stickRef = useRef(true);
  const canManage = profile.role === "staff" || profile.role === "admin";

  useEffect(() => {
    if (!client) return undefined;
    let stop = false;

    async function loadChannels() {
      const { data, error: queryError } = await client.from("vip_channels").select("id,name").order("id");
      if (stop) return;
      if (queryError) {
        setConnectionError(chatErrorMessage(queryError));
        setLoading(false);
        return;
      }
      const rows = (data ?? []).map(normalizeChannel);
      setChannels(rows);
      setChannelId((current) => {
        if (current != null && rows.some((row) => row.id === current)) return current;
        const requested = Number(new URLSearchParams(window.location.search).get("channel"));
        return rows.find((row) => row.id === requested)?.id ?? rows[0]?.id ?? null;
      });
      setLoading(false);
    }

    loadChannels();
    const feed = client
      .channel("vip-channels")
      .on("postgres_changes", { event: "*", schema: "public", table: "vip_channels" }, () => {
        loadChannels();
      })
      .subscribe();

    return () => {
      stop = true;
      client.removeChannel(feed);
    };
  }, [client]);

  useEffect(() => {
    if (!client || channelId == null) {
      setMessages([]);
      setOnline([]);
      return undefined;
    }
    let stop = false;

    async function loadMessages() {
      const { data, error: queryError } = await client
        .from("vip_messages")
        .select(MESSAGE_COLUMNS)
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (stop) return;
      if (queryError) {
        setConnectionError(chatErrorMessage(queryError));
        return;
      }
      const next = (data ?? []).map(normalizeMessage);
      setConnectionError("");
      setMessages((current) => {
        const merged = mergeMessages(current, next);
        if (merged.length === current.length && merged.every((item, index) => item.id === current[index]?.id)) {
          return current;
        }
        return merged;
      });
    }

    loadMessages();
    const poll = setInterval(loadMessages, 4000);
    const room = client.channel(`vip-room-${channelId}`, {
      config: { presence: { key: profile.id } },
    });
    room
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vip_messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          if (payload.new) setMessages((current) => mergeMessages(current, normalizeMessage(payload.new)));
        },
      )
      .on("presence", { event: "sync" }, () => {
        setOnline(presenceList(room.presenceState()));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          room.track({ userId: profile.id, name: profile.displayName }).catch(() => {});
        }
      });

    return () => {
      stop = true;
      clearInterval(poll);
      client.removeChannel(room);
    };
  }, [client, channelId, profile.id, profile.displayName]);

  useEffect(() => {
    stickRef.current = true;
  }, [channelId]);

  useEffect(() => {
    const node = listRef.current;
    if (node && stickRef.current) node.scrollTop = node.scrollHeight;
  }, [messages, channelId]);

  if (!client) return <p className="chat-banner">{CHAT_NOT_CONFIGURED}</p>;

  const channel = channels.find((item) => item.id === channelId) ?? null;

  async function send(event) {
    event.preventDefault();
    if (!channel) return;
    let body;
    try {
      body = validateBody(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "請輸入訊息");
      return;
    }
    setSending(true);
    const kind = canManage && announce ? "announcement" : "chat";
    const { data, error: insertError } = await client
      .from("vip_messages")
      .insert({
        channel_id: channel.id,
        body,
        author_id: profile.id,
        author_name: (profile.displayName || "會員").slice(0, 80),
        author_role: profile.role,
        kind,
      })
      .select(MESSAGE_COLUMNS)
      .single();
    setSending(false);
    if (insertError) {
      setConnectionError(chatErrorMessage(insertError));
      return;
    }
    if (data) setMessages((current) => mergeMessages(current, normalizeMessage(data)));
    setDraft("");
    setError("");
    setConnectionError("");
    if (kind === "announcement") {
      try {
        store.notifyAnnouncement({ channelId: channel.id, channelName: channel.name, body });
      } catch {
        // The shared message is already saved. The bell is local to this browser.
      }
    }
  }

  async function addChannel(event) {
    event.preventDefault();
    let name;
    try {
      name = validateChannelName(channelName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立頻道失敗");
      return;
    }
    const { data, error: insertError } = await client.from("vip_channels").insert({ name }).select("id,name").single();
    if (insertError) {
      setConnectionError(chatErrorMessage(insertError));
      return;
    }
    const created = normalizeChannel(data);
    setChannelName("");
    setError("");
    setChannels((current) => (current.some((item) => item.id === created.id) ? current : [...current, created]));
    setChannelId(created.id);
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-muted">VIP 會員可以在這裡即時對話。工作人員的公告會以金色標示，和其他訊息在同一聊天室。</p>
      {connectionError ? <p className="mt-4 text-sm text-danger">{connectionError}</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 grid overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-[260px_1fr]">
        <aside className="border-b border-line p-3 md:border-r md:border-b-0">
          <p className="px-2 text-xs font-medium text-muted">頻道</p>
          <ul className="mt-2 space-y-1">
            {channels.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setChannelId(item.id);
                    setError("");
                  }}
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
          {canManage ? (
            <form className="mt-4 space-y-2" onSubmit={addChannel}>
              <input
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
                placeholder="新頻道名稱"
                value={channelName}
                onChange={(event) => setChannelName(event.target.value)}
                maxLength={40}
                required
              />
              <button type="submit" className="w-full rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-bg">
                新增頻道
              </button>
            </form>
          ) : null}
        </aside>
        <section className="flex min-h-[480px] flex-col">
          <header className="border-b border-line px-4 py-3">
            <p className="font-semibold">{channel ? `# ${channel.name}` : loading ? "正在連接…" : "尚未有頻道"}</p>
            {online.length > 0 ? (
              <p className="chat-presence">
                <span className="presence-dot" />
                線上 {online.length} 人：{online.map((person) => person.name).join("、")}
              </p>
            ) : (
              <p className="chat-presence">
                <span className="chat-live">即時</span>
                訊息會同步到其他已開啟這個頻道的 VIP
              </p>
            )}
          </header>
          <div
            ref={listRef}
            className="chat-log flex-1 overflow-y-auto px-4 py-4"
            onScroll={(event) => {
              const node = event.currentTarget;
              stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
            }}
          >
            {loading ? <p className="text-sm text-muted">正在連接即時通訊…</p> : null}
            {!loading && messages.length === 0 ? (
              <p className="text-sm text-muted">這個頻道還沒有訊息。發一句，其他 VIP 會即時看到。</p>
            ) : null}
            {messages.map((message) => {
              const mine = message.authorId === profile.id;
              return (
                <article key={message.id} className={`chat-row${mine ? " is-mine" : ""}`}>
                  <div className={`chat-bubble${message.kind === "announcement" ? " is-announcement" : ""}`}>
                    <p className="chat-meta">
                      <span className="font-semibold">{message.authorName || "會員"}</span>
                      <span> · {roleLabel(message.authorRole)}</span>
                      {message.kind === "announcement" ? <span className="badge badge-announcement">公告</span> : null}
                      {message.createdAt ? (
                        <span> · {message.createdAt.slice(0, 16).replace("T", " ")}</span>
                      ) : null}
                    </p>
                    <p className="chat-body">{message.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
          {channel ? (
            <form className="border-t border-line p-3" onSubmit={send}>
              {canManage ? (
                <label className="mb-3 flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    className="accent-gold"
                    checked={announce}
                    onChange={(event) => setAnnounce(event.target.checked)}
                  />
                  標為公告（同一聊天室顯示，並在這部瀏覽器通知其他 VIP）
                </label>
              ) : null}
              <textarea
                className="min-h-24 w-full rounded-lg border border-line bg-bg px-3 py-3 text-fg"
                placeholder={`傳送到 #${channel.name}（Enter 送出，Shift+Enter 換行）`}
                value={draft}
                maxLength={1000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                required
              />
              <button
                type="submit"
                disabled={sending}
                className="mt-2 rounded-lg bg-gold px-5 py-3 font-semibold text-bg disabled:opacity-60"
              >
                {sending ? "傳送中…" : "傳送"}
              </button>
            </form>
          ) : (
            <p className="border-t border-line px-4 py-3 text-sm text-muted">
              {loading ? "正在讀取頻道…" : "尚未有頻道。請先執行 Supabase SQL，或由工作人員新增頻道。"}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
