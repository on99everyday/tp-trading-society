export const ROLES = [
  { id: "student", label: "學員" },
  { id: "staff", label: "工作人員" },
  { id: "admin", label: "管理員" },
];

export const PERMISSIONS = [
  { key: "watch", label: "觀看教學短片", detail: "進入課程並播放已上架的短片。" },
  { key: "upload", label: "上架短片", detail: "在後台新增教學短片的播放網址。" },
  { key: "remove", label: "移除短片", detail: "從課程中刪除已上架的短片。" },
  { key: "logs", label: "查看觀看紀錄", detail: "查看每位學員的觀看次數與累計時間。" },
  { key: "accounts", label: "新增帳號", detail: "建立學員的登入名稱與密碼。" },
  { key: "roles", label: "調換人員角色", detail: "把人員改為學員、工作人員或管理員。" },
  { key: "powers", label: "修改角色權力", detail: "開關各角色可以使用的功能。" },
];

export const STAFF_KEYS = ["upload", "remove", "logs", "accounts", "roles", "powers"];

export const AREAS = [
  { id: "videos", label: "教學短片區", detail: "按單元觀看已上架短片" },
  { id: "quiz", label: "學園測驗區", detail: "用小測檢查是否真的學會" },
  { id: "vip", label: "VIP群 復盤交流區", detail: "工作人員在頻道發佈消息" },
];

/** Quizzes copied from the live course route. Do not add questions here. */
export const QUIZZES = [
  {
    id: "gold-basics",
    title: "黃金基礎小測",
    blurb: "確認你掌握 XAUUSD 的報價、時段與主要驅動因素。",
    questions: [
      {
        prompt: "XAUUSD 報價裡的 XAU 代表什麼？",
        choices: ["白銀", "黃金", "原油", "美元指數"],
        answer: 1,
      },
      {
        prompt: "黃金報價通常以哪一種貨幣計價？",
        choices: ["歐元", "日圓", "美元", "人民幣"],
        answer: 2,
      },
      {
        prompt: "哪一個時段通常最容易出現較大波動？",
        choices: ["亞洲早段剛開盤", "倫敦與紐約重疊", "週末休市", "每日收盤後的空窗"],
        answer: 1,
      },
    ],
  },
  {
    id: "risk",
    title: "風險與倉位小測",
    blurb: "檢查停損、風險報酬與單筆虧損是否算得清楚。",
    questions: [
      {
        prompt: "單筆交易先決定的應該是？",
        choices: ["想賺多少", "能虧多少", "別人的倉位", "當日新聞標題"],
        answer: 1,
      },
      {
        prompt: "風險報酬比 1:2 是指？",
        choices: ["賺 1、虧 2", "虧 1 的距離，目標賺 2", "保證獲利兩倍", "不加停損"],
        answer: 1,
      },
      {
        prompt: "停損應該放在哪裡？",
        choices: ["進場後隨便一個整數", "結構失效的外側", "永遠放 10 點", "盈利之後才決定"],
        answer: 1,
      },
    ],
  },
];

export const PLANS = [
  {
    id: "basic",
    kind: "第一類",
    name: "基礎會員",
    price: "1499",
    term: "一次性付費",
    detail: "一次性付費。付費後永久可以瀏覽視頻。",
    action: "支付 1499",
  },
  {
    id: "vip",
    kind: "第二類",
    name: "VIP 會員",
    price: "1500",
    term: "每月收費",
    detail: "每月付費後可以瀏覽視頻，以及進入 VIP 覆盤區。到期後要再付費。",
    action: "支付 1500",
  },
];

export function defaultPowerRows() {
  return ROLES.flatMap((role) =>
    PERMISSIONS.map((permission) => ({
      role: role.id,
      permission: permission.key,
      enabled: defaultEnabled(role.id, permission.key),
    })),
  );
}

function defaultEnabled(role, key) {
  if (role === "admin") return true;
  if (role === "staff") return ["watch", "upload", "remove", "logs", "accounts"].includes(key);
  return key === "watch";
}

function plusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function seedDatabase() {
  return {
    users: [
      {
        id: "u-admin",
        name: "admin",
        email: "admin@tp-trading.local",
        password: "admin123",
        role: "admin",
        basic: true,
        vip: true,
        vipUntil: null,
        locked: false,
      },
      {
        id: "u-demo",
        name: "demo",
        email: "demo@tp-trading.local",
        password: "demo1234",
        role: "student",
        basic: true,
        vip: true,
        vipUntil: plusDays(30),
        locked: false,
      },
      {
        id: "u-student01",
        name: "student01",
        email: "student01@tp-trading.local",
        password: "xau2024",
        role: "student",
        basic: false,
        vip: false,
        vipUntil: null,
        locked: false,
      },
      {
        id: "u-student02",
        name: "student02",
        email: "student02@tp-trading.local",
        password: "gold888",
        role: "student",
        basic: false,
        vip: false,
        vipUntil: null,
        locked: false,
      },
      {
        id: "u-student03",
        name: "student03",
        email: "student03@tp-trading.local",
        password: "trade666",
        role: "student",
        basic: false,
        vip: false,
        vipUntil: null,
        locked: false,
      },
      {
        id: "u-student04",
        name: "student04",
        email: "student04@tp-trading.local",
        password: "fx2024",
        role: "student",
        basic: false,
        vip: false,
        vipUntil: null,
        locked: false,
      },
      {
        id: "u-student05",
        name: "student05",
        email: "student05@tp-trading.local",
        password: "xau8888",
        role: "student",
        basic: false,
        vip: false,
        vipUntil: null,
        locked: false,
      },
    ],
    modules: [
      {
        code: "UNIT 01",
        title: "XAUUSD 基礎認識",
        blurb: "認識黃金市場特性、交易時段與影響金價的主要因素。",
      },
      {
        code: "UNIT 02",
        title: "技術分析入門",
        blurb: "K 線形態、支撐阻力、移動平均線與基本指標應用。",
      },
      {
        code: "UNIT 03",
        title: "多時間框架分析",
        blurb: "日線、4小時、1小時圖表的配合使用與進場邏輯。",
      },
      {
        code: "UNIT 04",
        title: "風險管理與倉位計算",
        blurb: "停損設定、風險報酬比、資金管理原則。",
      },
      {
        code: "UNIT 05",
        title: "交易策略實戰",
        blurb: "常見黃金交易策略與真實案例拆解。",
      },
      {
        code: "UNIT 06",
        title: "心態與交易日誌",
        blurb: "建立紀律、克服情緒、長期穩定獲利的關鍵。",
      },
    ],
    videos: [
      {
        id: 1,
        title: "黃金市場基礎介紹",
        description: "了解 XAUUSD 的交易特性與主要影響因素。",
        moduleCode: "UNIT 01",
        sourceUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      },
      {
        id: 2,
        title: "K線形態入門",
        description: "常見 K 線形態與意義。",
        moduleCode: "UNIT 02",
        sourceUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      },
    ],
    channels: [{ id: 1, name: "復盤交流" }],
    posts: [],
    emailOn: {},
    notifications: [],
    logins: [],
    alerts: [],
    watches: [],
    powers: defaultPowerRows(),
    sessionId: null,
    nextId: 100,
  };
}

export function vipActive(user) {
  if (!user) return false;
  if (user.role !== "student") return true;
  if (!user.vip || !user.vipUntil) return false;
  return new Date(user.vipUntil).getTime() > Date.now();
}

export function videosOpen(user) {
  if (!user) return false;
  if (user.role !== "student") return true;
  return Boolean(user.basic) || vipActive(user);
}

export function enabledPowers(db, role) {
  return db.powers.filter((row) => row.role === role && row.enabled).map((row) => row.permission);
}

export function toProfile(user, db) {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.name,
    email: user.email,
    role: user.role,
    powers: enabledPowers(db, user.role),
    videos: videosOpen(user),
    vip: vipActive(user),
    vipUntil: user.vipUntil,
    basic: user.role !== "student" ? true : Boolean(user.basic),
    locked: Boolean(user.locked) && user.role === "student",
  };
}

export function youtubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1).split("/")[0] || null;
    if (parsed.hostname.endsWith("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/")[2] || null;
      }
      return parsed.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return minutes === 0 ? `${remain} 秒` : `${minutes} 分 ${remain} 秒`;
}

export function roleLabel(role) {
  if (role === "admin") return "管理員";
  if (role === "staff") return "工作人員";
  return "學員";
}
