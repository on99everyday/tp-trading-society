const KEY = "xauusd-course";

const empty = () => ({
  users: [],
  session: null,
  logins: [],
  alerts: [],
  locks: [],
});

function load() {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return empty();
  }
}

function save(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

let db = load();
let mode = "in";
let view = db.session ? (needsFee(db.session) ? "fee" : "home") : "auth";

function needsFee(user) {
  return user.role === "student" && !user.basic && !user.vip;
}

function current() {
  return db.users.find((user) => user.name === db.session) || null;
}

function device() {
  return navigator.userAgent.slice(0, 180);
}

async function region() {
  try {
    const response = await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(2500) });
    const data = await response.json();
    if (!data.success) return "";
    return [data.region, data.city].filter(Boolean).join(" · ");
  } catch {
    return "";
  }
}

function recordLogin(user) {
  const at = new Date().toISOString();
  const entry = { name: user.name, device: device(), region: user.pendingRegion || "", at };
  const last = [...db.logins].reverse().find((row) => row.name === user.name);
  db.logins.push(entry);
  if (last && entry.region && last.region && entry.region !== last.region) {
    const gap = (new Date(at) - new Date(last.at)) / 1000;
    if (gap >= 0 && gap <= 60) {
      db.alerts.unshift({
        name: user.name,
        detail: `${user.name} 在 ${Math.round(gap)} 秒內由「${last.region}」改為「${entry.region}」登入`,
        at,
        locked: db.locks.includes(user.name),
      });
    }
  }
  delete user.pendingRegion;
}

function render() {
  const user = current();
  document.getElementById("nav-fee").hidden = !user;
  document.getElementById("nav-staff").hidden = !user || user.role === "student";
  document.getElementById("nav-out").hidden = !user;
  const app = document.getElementById("app");
  if (user && db.locks.includes(user.name) && user.role === "student") {
    app.innerHTML = `<h1>帳號已封控</h1><p class="muted">請聯絡工作人員或管理員。</p>`;
    return;
  }
  if (view === "auth") app.innerHTML = authHtml();
  else if (view === "fee") app.innerHTML = feeHtml(user);
  else if (view === "staff") app.innerHTML = staffHtml();
  else app.innerHTML = homeHtml(user);
  bind();
}

function authHtml() {
  return `
    <form class="panel" id="auth-form">
      <p class="gold">XAUUSD 課程</p>
      <h1>${mode === "up" ? "註冊" : "登入"}</h1>
      <div class="tabs">
        <button type="button" data-mode="in" class="${mode === "in" ? "on" : ""}">登入</button>
        <button type="button" data-mode="up" class="${mode === "up" ? "on" : ""}">註冊</button>
      </div>
      <label>名稱<input name="name" required /></label>
      ${mode === "up" ? `<label>電郵<input name="email" type="email" required /></label>` : ""}
      <label>密碼<input name="password" type="password" minlength="8" required /></label>
      <p id="auth-error" class="danger"></p>
      <button class="primary" type="submit">${mode === "up" ? "註冊並前往收費" : "登入"}</button>
    </form>`;
}

function feeHtml(user) {
  const cards = [
    ["basic", "第一類", "基礎會員", "1499", "永久會員", "能夠觀看所有教學短片。", user?.basic],
    ["vip", "第二類", "VIP 群", "1500", "每月收費", "可以進入復盤交流區。", user?.vip],
  ];
  return `
    <p class="gold">註冊完成</p>
    <h1>收費頁面</h1>
    <p class="muted">會員收費分兩類。可以只選一類，也可以兩類都開通。</p>
    <div class="grid two">
      ${cards
        .map(
          ([id, kind, name, price, term, detail, owned]) => `
        <article class="card">
          <p class="gold">${kind}</p>
          <h2>${name}</h2>
          <p class="muted">費用</p>
          <p class="price">${price}</p>
          <p>${term}</p>
          <p class="muted">${detail}</p>
          <button class="pay" data-plan="${id}" ${owned ? "disabled" : ""}>${owned ? "已開通" : "支付 " + price}</button>
        </article>`,
        )
        .join("")}
    </div>`;
}

function homeHtml(user) {
  return `
    <p class="gold">${user.role === "student" ? "學員" : user.role === "admin" ? "管理員" : "工作人員"}</p>
    <h1>${user.name}</h1>
    <div class="grid two">
      <article class="card"><h2>教學短片</h2><p class="muted">${user.basic || user.role !== "student" ? "已可觀看所有教學短片。" : "需要基礎會員，費用 1499，永久會員。"}</p></article>
      <article class="card"><h2>VIP 群復盤交流區</h2><p class="muted">${user.vip || user.role !== "student" ? "已可進入復盤交流區。" : "需要 VIP 群，每月費用 1500。"}</p></article>
    </div>`;
}

function staffHtml() {
  const alerts = db.alerts
    .map(
      (alert) => `
      <div class="row">
        <div><strong>${alert.name}</strong><p class="muted">${alert.detail}</p></div>
        <button class="lock ${db.locks.includes(alert.name) ? "on" : ""}" data-lock="${alert.name}">
          ${db.locks.includes(alert.name) ? "解除封控" : "封控"}
        </button>
      </div>`,
    )
    .join("");
  const logins = [...db.logins]
    .reverse()
    .slice(0, 20)
    .map(
      (row) => `
      <div class="row">
        <div><strong>${row.name}</strong><p class="muted">${row.region || "未能判斷地區"}</p></div>
        <p class="muted">${row.at.slice(0, 19).replace("T", " ")}<br />${row.device}</p>
      </div>`,
    )
    .join("");
  return `
    <h1>登入封控</h1>
    <p class="muted">記下每次登入的裝置、時間和地區。上一秒在廣東、下一秒在北京，會提示工作人員和管理員。</p>
    <section class="card"><h2>異常提示</h2>${alerts || `<p class="muted">暫時沒有異常登入</p>`}</section>
    <section class="card"><h2>登入紀錄</h2>${logins || `<p class="muted">還沒有登入紀錄</p>`}</section>`;
}

function bind() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.onclick = () => {
      mode = button.dataset.mode;
      render();
    };
  });
  const form = document.getElementById("auth-form");
  if (form) {
    form.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const password = String(data.get("password") || "");
      const error = document.getElementById("auth-error");
      if (mode === "up") {
        if (db.users.some((user) => user.name === name)) {
          error.textContent = "此名稱已有人使用";
          return;
        }
        db.users.push({
          name,
          email: String(data.get("email") || "").trim(),
          password,
          role: db.users.length === 0 ? "admin" : "student",
          basic: false,
          vip: false,
        });
        db.session = name;
        save(db);
        view = "fee";
        render();
        return;
      }
      const user = db.users.find((item) => item.name === name && item.password === password);
      if (!user) {
        error.textContent = "名稱或密碼不正確";
        return;
      }
      user.pendingRegion = await region();
      recordLogin(user);
      db.session = name;
      save(db);
      view = user.role === "student" && !user.basic && !user.vip ? "fee" : "home";
      render();
    };
  }
  document.querySelectorAll("[data-plan]").forEach((button) => {
    button.onclick = () => {
      const user = current();
      if (!user) return;
      if (button.dataset.plan === "basic") user.basic = true;
      if (button.dataset.plan === "vip") user.vip = true;
      save(db);
      view = "home";
      render();
    };
  });
  document.querySelectorAll("[data-lock]").forEach((button) => {
    button.onclick = () => {
      const name = button.dataset.lock;
      if (db.locks.includes(name)) db.locks = db.locks.filter((item) => item !== name);
      else db.locks.push(name);
      save(db);
      render();
    };
  });
}

document.getElementById("nav-fee").onclick = () => {
  view = "fee";
  render();
};
document.getElementById("nav-staff").onclick = () => {
  view = "staff";
  render();
};
document.getElementById("nav-out").onclick = () => {
  db.session = null;
  save(db);
  view = "auth";
  render();
};

render();
