import { createContext, useContext, useMemo, useState } from "react";
import {
  accountTaken,
  applyMembership,
  enabledPowers,
  personRecord,
  seedDatabase,
  toProfile,
  userByLoginName,
  vipActive,
  videosOpen,
} from "./course";

const KEY = "xauusd-course-spa";
const StoreContext = createContext(null);

function loadDatabase() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedDatabase();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.users) || parsed.users.length === 0) return seedDatabase();
    return { ...seedDatabase(), ...parsed };
  } catch {
    return seedDatabase();
  }
}

function nextNumericId(db, key) {
  const current = db[key].reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
  return current + 1;
}

export function StoreProvider({ children }) {
  const [db, setDb] = useState(loadDatabase);

  function commit(mutator) {
    setDb((prev) => {
      const next = structuredClone(prev);
      mutator(next);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }

  const api = useMemo(() => {
    const user = db.users.find((item) => item.id === db.sessionId) ?? null;
    const profile = user ? toProfile(user, db) : null;

    return {
      db,
      user,
      profile,
      signIn(name, password) {
        const found = userByLoginName(db.users, name);
        if (!found || found.password !== password) {
          throw new Error("名稱或密碼不正確");
        }
        commit((next) => {
          next.sessionId = found.id;
        });
        return found;
      },
      signUp({ name, email, password }) {
        const trimmed = name.trim();
        const mail = email.trim();
        if (accountTaken(db.users, { name: trimmed })) return { taken: true, field: "name" };
        if (!mail || password.length < 8) {
          throw new Error("註冊失敗");
        }
        if (accountTaken(db.users, { email: mail })) return { taken: true, field: "email" };
        const id = `u-${crypto.randomUUID()}`;
        commit((next) => {
          next.users.push({
            id,
            name: trimmed,
            email: mail,
            password,
            role: "student",
            basic: false,
            vip: false,
            vipUntil: null,
            locked: false,
          });
          next.sessionId = id;
        });
        return { taken: false };
      },
      signOut() {
        commit((next) => {
          next.sessionId = null;
        });
      },
      nameTaken(name) {
        return accountTaken(db.users, { name }) === "name";
      },
      pay(plan) {
        if (!user) throw new Error("未能完成繳費");
        commit((next) => {
          const row = next.users.find((item) => item.id === user.id);
          if (!row) return;
          if (plan === "basic") row.basic = true;
          if (plan === "vip") {
            const until = new Date();
            until.setDate(until.getDate() + 30);
            row.vip = true;
            row.vipUntil = until.toISOString();
          }
        });
      },
      recordLogin(device, region) {
        if (!user) return;
        commit((next) => {
          const at = new Date().toISOString();
          const entry = {
            userId: user.id,
            displayName: user.name,
            device,
            region: region || "未能判斷地區",
            loggedAt: at,
          };
          const last = [...next.logins].reverse().find((row) => row.userId === user.id);
          next.logins.push(entry);
          if (
            last &&
            region &&
            last.region &&
            last.region !== "未能判斷地區" &&
            region !== last.region
          ) {
            const gap = (new Date(at) - new Date(last.loggedAt)) / 1000;
            if (gap >= 0 && gap <= 60) {
              next.alerts.unshift({
                id: nextNumericId(next, "alerts"),
                userId: user.id,
                displayName: user.name,
                detail: `${user.name} 在 ${Math.round(gap)} 秒內由「${last.region}」改為「${region}」登入`,
                createdAt: at,
                locked: Boolean(user.locked),
              });
            }
          }
        });
      },
      setLocked(userId, locked) {
        commit((next) => {
          const row = next.users.find((item) => item.id === userId);
          if (row) row.locked = locked;
          for (const alert of next.alerts) {
            if (alert.userId === userId) alert.locked = locked;
          }
        });
      },
      setPower(role, permission, enabled) {
        if (role === "admin" && permission === "powers" && !enabled) {
          throw new Error("管理員必須保留這項，以免無法再改設定");
        }
        commit((next) => {
          const row = next.powers.find((item) => item.role === role && item.permission === permission);
          if (row) row.enabled = enabled;
        });
      },
      addModule({ code, title, blurb }) {
        const trimmed = code.trim();
        if (!trimmed || !title.trim()) throw new Error("新增單元失敗");
        if (db.modules.some((item) => item.code.toLowerCase() === trimmed.toLowerCase())) {
          throw new Error("這個單元編號已存在");
        }
        commit((next) => {
          next.modules.push({ code: trimmed, title: title.trim(), blurb: blurb.trim() });
        });
        return { code: trimmed };
      },
      addVideo({ title, description, moduleCode, sourceUrl }) {
        let parsed;
        try {
          parsed = new URL(sourceUrl);
        } catch {
          throw new Error("請填寫 https 網址");
        }
        if (parsed.protocol !== "https:") throw new Error("請填寫 https 網址");
        if (!db.modules.some((item) => item.code === moduleCode)) throw new Error("讀取單元失敗");
        let id = 0;
        commit((next) => {
          id = nextNumericId(next, "videos");
          next.videos.push({
            id,
            title: title.trim(),
            description: description.trim(),
            moduleCode,
            sourceUrl: sourceUrl.trim(),
          });
        });
        return { id };
      },
      removeVideo(id) {
        commit((next) => {
          next.videos = next.videos.filter((item) => item.id !== id);
        });
      },
      addAccount({ name, email, password }) {
        const trimmed = name.trim();
        if (accountTaken(db.users, { name: trimmed })) throw new Error("此名稱已有人使用");
        if (accountTaken(db.users, { email })) throw new Error("此電郵已有人使用");
        if (password.length < 8) throw new Error("密碼至少 8 位");
        commit((next) => {
          next.users.push({
            id: `u-${crypto.randomUUID()}`,
            name: trimmed,
            email: email.trim(),
            password,
            role: "student",
            basic: false,
            vip: false,
            vipUntil: null,
            locked: false,
          });
        });
      },
      setMembership(userId, patch) {
        if (!db.users.some((item) => item.id === userId)) throw new Error("更新失敗");
        commit((next) => {
          const row = next.users.find((item) => item.id === userId);
          if (row) applyMembership(row, patch);
        });
      },
      setRole(userId, role) {
        if (!["student", "staff", "admin"].includes(role)) throw new Error("更新失敗");
        if (!db.users.some((item) => item.id === userId)) throw new Error("更新失敗");
        commit((next) => {
          const row = next.users.find((item) => item.id === userId);
          if (row) row.role = role;
        });
      },
      deleteUser(userId) {
        if (userId === user?.id) throw new Error("不能刪除自己");
        commit((next) => {
          next.users = next.users.filter((item) => item.id !== userId);
          if (next.sessionId === userId) next.sessionId = null;
        });
      },
      addChannel(name) {
        const trimmed = name.trim();
        if (!trimmed) throw new Error("建立頻道失敗");
        let id = 0;
        commit((next) => {
          id = nextNumericId(next, "channels");
          next.channels.push({ id, name: trimmed });
        });
        return { id };
      },
      postsFor(channelId) {
        return db.posts
          .filter((item) => item.channelId === channelId)
          .slice()
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      },
      publishPost({ channelId, body }) {
        if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
          throw new Error("只有工作人員可以在頻道發佈消息。");
        }
        const channel = db.channels.find((item) => item.id === channelId);
        if (!channel) throw new Error("讀取頻道失敗");
        const text = body.trim();
        if (!text) throw new Error("發佈失敗");
        commit((next) => {
          const id = nextNumericId(next, "posts");
          const createdAt = new Date().toISOString();
          next.posts.push({
            id,
            channelId,
            displayName: profile.displayName,
            body: text.slice(0, 1000),
            createdAt,
          });
          for (const member of next.users) {
            const memberProfile = toProfile(member, next);
            if (!memberProfile.vip || member.id === profile.id) continue;
            next.notifications.unshift({
              id: nextNumericId(next, "notifications"),
              userId: member.id,
              title: `#${channel.name} 有新消息`,
              body: text.slice(0, 140),
              href: `/vip?channel=${channelId}`,
              read: false,
              createdAt,
            });
          }
        });
      },
      notifyAnnouncement({ channelId, channelName, body }) {
        if (!profile?.vip) return;
        const text = body.trim();
        if (!text) return;
        commit((next) => {
          const createdAt = new Date().toISOString();
          for (const member of next.users) {
            const memberProfile = toProfile(member, next);
            if (!memberProfile.vip || member.id === profile.id) continue;
            next.notifications.unshift({
              id: nextNumericId(next, "notifications"),
              userId: member.id,
              title: `#${channelName} 有新公告`,
              body: text.slice(0, 140),
              href: `/vip?channel=${channelId}`,
              read: false,
              createdAt,
            });
          }
        });
      },
      emailPrefs() {
        if (!user) return { email: "", channels: [] };
        return {
          email: user.email,
          channels: db.channels.map((channel) => ({
            id: channel.id,
            name: channel.name,
            emailOn: Boolean(db.emailOn[`${user.id}:${channel.id}`]),
          })),
        };
      },
      setEmail(channelId, enabled) {
        if (!user) return;
        commit((next) => {
          next.emailOn[`${user.id}:${channelId}`] = enabled;
        });
      },
      notificationsForMe() {
        if (!user) return { items: [], unread: 0 };
        const items = db.notifications.filter((item) => item.userId === user.id);
        return { items, unread: items.filter((item) => !item.read).length };
      },
      markNotifications({ id } = {}) {
        if (!user) return;
        commit((next) => {
          for (const item of next.notifications) {
            if (item.userId !== user.id) continue;
            if (id == null || item.id === id) item.read = true;
          }
        });
      },
      recordWatch(videoId, kind) {
        if (!user || !profile?.videos || !profile.powers.includes("watch")) return;
        const video = db.videos.find((item) => item.id === videoId);
        if (!video) return;
        commit((next) => {
          let row = next.watches.find(
            (item) => item.userId === user.id && item.videoId === videoId,
          );
          if (!row) {
            row = {
              userId: user.id,
              email: user.email,
              displayName: user.name,
              videoId,
              title: video.title,
              moduleCode: video.moduleCode,
              viewCount: 0,
              watchSeconds: 0,
              lastViewedAt: null,
            };
            next.watches.push(row);
          }
          row.displayName = user.name;
          row.email = user.email;
          row.title = video.title;
          row.moduleCode = video.moduleCode;
          if (kind === "open") row.viewCount += 1;
          if (kind === "tick") row.watchSeconds += 15;
          row.lastViewedAt = new Date().toISOString();
        });
      },
      people() {
        return db.users.map((item) => personRecord(item));
      },
    };
  }, [db]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("Store missing");
  return value;
}

export function sessionProfile(db) {
  const user = db.users.find((item) => item.id === db.sessionId) ?? null;
  return user ? toProfile(user, db) : null;
}

export { enabledPowers, videosOpen, vipActive };
