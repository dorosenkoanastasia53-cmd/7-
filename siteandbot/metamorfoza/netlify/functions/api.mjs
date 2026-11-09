// API адмін-панелі «Метаморфози» (Netlify Function, сховище — Netlify Blobs).
//
// Змінні оточення в Netlify (Site settings → Environment variables):
//   ADMIN_LOGIN, ADMIN_PASSWORD — вхід супер-адміна (створює облікові записи фахівців)
//   AUTH_SECRET                 — довгий випадковий рядок для підпису сесій
//
// Хто що бачить:
//   усі (без входу)   — лише вільні вікна фахівців (для сайту)
//   фахівець          — свої вільні години, усі кабінети (зайнято: імʼя / «Орендар»),
//                       свої консультації, пакети, статистику
//   супер-адмін       — усе, плюс користувачі, кабінети, ціни, орендарі

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

// ---------- сховище: Netlify Blobs на сайті, папка на диску — для локальної перевірки
async function openStore() {
  if (process.env.LOCAL_STORE_DIR) {
    const dir = process.env.LOCAL_STORE_DIR;
    await fs.mkdir(dir, { recursive: true });
    const file = (k) => path.join(dir, k.replace(/[^\w.-]/g, "_") + ".json");
    return {
      get: async (k) => { try { return JSON.parse(await fs.readFile(file(k), "utf8")); } catch { return null; } },
      set: async (k, v) => fs.writeFile(file(k), JSON.stringify(v)),
    };
  }
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "metamorfoza", consistency: "strong" });
  return { get: (k) => store.get(k, { type: "json" }), set: (k, v) => store.setJSON(k, v) };
}

// ---------- початкові дані (супер-адмін може змінити в розділі «Налаштування»)
const DEFAULT_CONFIG = {
  discount: 20, // % на першу (діагностичну) консультацію
  specialists: [
    { id: "anastasiia", name: "Анастасія Дорошенко", prices: { consult: 1300, pair: 1500, mak: 1200 } },
    { id: "olha", name: "Ольга Ситніченко", prices: { consult: 1800 } },
    { id: "anastasiia-k", name: "Анастасія", prices: { consult: 1300 } },
    { id: "nataliia", name: "Наталія Горбулевич", prices: { consult: 1200 } },
    { id: "oleksandra", name: "Олександра Байлова", prices: { consult: 1200 } },
    { id: "yana", name: "Яна Турчанінова", prices: { consult: 1500 } },
    { id: "ivanna", name: "Іванна Ромашко", prices: { consult: 900 } },
  ],
  rooms: [
    { id: "r1", name: "Кабінет з кріслами" },
    { id: "r2", name: "Кабінет з диваном" },
    { id: "r3", name: "Затишний кабінет" },
    { id: "hall", name: "Зала" },
  ],
};
// події, які сайт рахує (інші ігноруються); джерела перших відвідувань за день
const TRACK_EVENTS = ["page_view", "booking_click", "choose_specialist", "first_session_click", "specialist_open", "slot_pick",
  "event_open", "event_register", "form_submit_psy", "form_submit_event", "pay_click", "telegram_click", "instagram_click", "map_click", "qr_zapys", "qr_podii"];
const SOURCES = ["Пряме", "Instagram", "Telegram", "Facebook", "Google", "QR-код", "Інше"];
const SERVICES = { diag: "Діагностична сесія", consult: "Консультація", pair: "Парна / сімейна сесія", mak: "МАК-сесія", other: "Інше" };

// ---------- допоміжне
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (status, error) => json({ ok: false, error }, status);
const uid = () => crypto.randomBytes(8).toString("hex");
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const isTime = (s) => /^\d{2}:\d{2}$/.test(s || "");
const str = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const today = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10); // Київ ≈ UTC+2

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(String(password), salt, 64).toString("hex") };
}
function checkPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.hash, "hex"));
}
function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is not configured");
  return s;
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verify(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const good = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}

// ---------- обробник
export default async (req) => {
  try { return await handle(req); }
  catch (e) {
    console.error(e);
    return fail(500, e.message === "AUTH_SECRET is not configured" ? "Сервер не налаштований: додайте AUTH_SECRET у Netlify" : "Помилка сервера");
  }
};

async function handle(req) {
  const url = new URL(req.url);
  const a = url.searchParams.get("a") || "";
  const q = (k) => url.searchParams.get(k) || "";
  let body = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { body = {}; } }

  const db = await openStore();
  const config = (await db.get("config")) || DEFAULT_CONFIG;
  const specName = (id) => (config.specialists.find((s) => s.id === id) || {}).name || id;

  // ----- публічне: вільні вікна для сайту (без жодних даних клієнтів)
  if (a === "public") {
    const slots = ((await db.get("slots")) || []).filter((s) => s.status === "free" && s.date >= today());
    return json({ ok: true, slots: slots.map((s) => ({ name: specName(s.specialistId), specialistId: s.specialistId, date: s.date, time: s.time })) });
  }

  // ----- статистика відвідувань (анонімно: без IP, без ідентифікаторів — лише лічильники за днями)
  if (a === "track") {
    const e = str(body.e, 40), label = str(body.label, 60);
    if (!TRACK_EVENTS.includes(e)) return json({ ok: true });
    const day = today(), key = `analytics-${day.slice(0, 7)}`;
    const st = (await db.get(key)) || { days: {}, events: {}, sources: {} };
    const d = (st.days[day] ||= { views: 0, visitors: 0 });
    if (e === "page_view") {
      d.views++;
      if (body.newVisitor) d.visitors++;
      const src = SOURCES.includes(body.src) ? body.src : "Інше";
      if (body.newVisitor) st.sources[src] = (st.sources[src] || 0) + 1;
    } else {
      const ev = (st.events[e] ||= {});
      ev[label || "—"] = (ev[label || "—"] || 0) + 1;
    }
    await db.set(key, st);
    return json({ ok: true });
  }

  // ----- вхід
  if (a === "login") {
    const login = str(body.login, 60).toLowerCase(), password = String(body.password || "");
    const attempts = (await db.get("attempts")) || {};
    const rec = attempts[login] || { n: 0, t: 0 };
    if (rec.n >= 5 && Date.now() - rec.t < 15 * 60e3) return fail(429, "Забагато спроб. Спробуйте за 15 хвилин.");
    let user = null;
    if (process.env.ADMIN_LOGIN && login === process.env.ADMIN_LOGIN.toLowerCase() && password === process.env.ADMIN_PASSWORD) {
      user = { id: "admin", login, name: "Супер-адмін", role: "admin" };
    } else {
      const u = ((await db.get("users")) || []).find((x) => x.login === login);
      if (u && checkPassword(password, u)) user = u;
    }
    if (!user) {
      attempts[login] = { n: rec.n + 1, t: Date.now() }; await db.set("attempts", attempts);
      return fail(401, "Невірний логін або пароль");
    }
    if (attempts[login]) { delete attempts[login]; await db.set("attempts", attempts); }
    const me = { id: user.id, name: user.name, role: user.role, specialistId: user.specialistId || null };
    return json({ ok: true, token: sign({ ...me, exp: Date.now() + 14 * 24 * 3600e3 }), user: me });
  }

  // ----- далі тільки для тих, хто увійшов
  const me = verify((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));
  if (!me) return fail(401, "Потрібно увійти");
  const isAdmin = me.role === "admin";
  // за чиїм фахівцем працюємо: фахівець — лише за собою, адмін — за будь-ким
  const target = (wanted) => (isAdmin ? str(wanted || "", 40) || null : me.specialistId);
  const priceOf = (specId, service) => {
    const p = (config.specialists.find((s) => s.id === specId) || {}).prices || {};
    if (service === "diag") return p.consult ? Math.round(p.consult * (1 - config.discount / 100)) : null;
    return p[service] ?? null;
  };

  if (a === "me") return json({ ok: true, user: me, config: { ...config, services: SERVICES } });

  // ----- вільні вікна фахівців (те, що бачить сайт)
  if (a === "slots") {
    const spec = target(q("spec"));
    const all = (await db.get("slots")) || [];
    const list = all.filter((s) => (!spec || s.specialistId === spec) && (!q("from") || s.date >= q("from")) && (!q("to") || s.date <= q("to")));
    return json({ ok: true, slots: list.map((s) => ({ ...s, name: specName(s.specialistId) })) });
  }
  if (a === "slot-add") {
    const spec = target(body.specialistId);
    if (!spec) return fail(400, "Оберіть фахівця");
    const dates = [].concat(body.dates || body.date || []).filter(isDate);
    const times = [].concat(body.times || body.time || []).filter(isTime);
    if (!dates.length || !times.length) return fail(400, "Вкажіть дату і час");
    const all = (await db.get("slots")) || [];
    let added = 0;
    for (const date of dates) for (const time of times) {
      if (all.some((s) => s.specialistId === spec && s.date === date && s.time === time)) continue;
      all.push({ id: uid(), specialistId: spec, date, time, status: "free" }); added++;
    }
    await db.set("slots", all);
    return json({ ok: true, added });
  }
  if (a === "slot-update" || a === "slot-delete") {
    const all = (await db.get("slots")) || [];
    const i = all.findIndex((s) => s.id === body.id);
    if (i < 0) return fail(404, "Не знайдено");
    if (!isAdmin && all[i].specialistId !== me.specialistId) return fail(403, "Немає доступу");
    if (a === "slot-delete") all.splice(i, 1);
    else all[i].status = body.status === "booked" ? "booked" : "free";
    await db.set("slots", all);
    return json({ ok: true });
  }

  // ----- кабінети: усім видно, хто займає (імʼя фахівця або «Орендар»)
  if (a === "rooms") {
    const all = (await db.get("bookings")) || [];
    const list = all.filter((b) => (!q("from") || b.date >= q("from")) && (!q("to") || b.date <= q("to"))).map((b) => ({
      id: b.id, roomId: b.roomId, date: b.date, start: b.start, end: b.end, type: b.type,
      label: b.type === "tenant" ? (isAdmin ? `Орендар: ${b.tenantName}` : "Орендар") : specName(b.specialistId),
      note: isAdmin || b.specialistId === me.specialistId ? b.note || "" : "",
      canEdit: isAdmin || (b.type === "specialist" && b.specialistId === me.specialistId),
    }));
    return json({ ok: true, rooms: config.rooms, bookings: list });
  }
  if (a === "booking-add") {
    const type = body.type === "tenant" ? "tenant" : "specialist";
    if (type === "tenant" && !isAdmin) return fail(403, "Орендарів додає адміністратор");
    const spec = type === "specialist" ? target(body.specialistId) : null;
    if (type === "specialist" && !spec) return fail(400, "Оберіть фахівця");
    const b = { id: uid(), roomId: str(body.roomId, 40), date: body.date, start: body.start, end: body.end, type,
      specialistId: spec, tenantName: type === "tenant" ? str(body.tenantName, 80) || "Орендар" : null, note: str(body.note, 300), createdBy: me.id };
    if (!config.rooms.some((r) => r.id === b.roomId)) return fail(400, "Оберіть кабінет");
    if (!isDate(b.date) || !isTime(b.start) || !isTime(b.end) || b.start >= b.end) return fail(400, "Перевірте дату і час");
    const all = (await db.get("bookings")) || [];
    const clash = all.find((x) => x.roomId === b.roomId && x.date === b.date && x.start < b.end && b.start < x.end);
    if (clash) return fail(409, `Кабінет уже зайнятий ${clash.start}–${clash.end}`);
    all.push(b); await db.set("bookings", all);
    return json({ ok: true, id: b.id });
  }
  if (a === "booking-delete") {
    const all = (await db.get("bookings")) || [];
    const i = all.findIndex((x) => x.id === body.id);
    if (i < 0) return fail(404, "Не знайдено");
    if (!isAdmin && !(all[i].type === "specialist" && all[i].specialistId === me.specialistId)) return fail(403, "Немає доступу");
    all.splice(i, 1); await db.set("bookings", all);
    return json({ ok: true });
  }

  // ----- консультації (бачить лише сам фахівець і супер-адмін)
  const loadSessions = async (spec) => (await db.get(`sessions-${spec}`)) || [];
  const loadPackages = async (spec) => (await db.get(`packages-${spec}`)) || [];
  const specsFor = (spec) => (spec ? [spec] : isAdmin ? config.specialists.map((s) => s.id) : [me.specialistId]);
  const withPackageUse = (packages, sessions) => packages.map((p) => {
    const used = sessions.filter((s) => s.packageId === p.id).length;
    return { ...p, used, left: p.total - used };
  });

  if (a === "sessions") {
    const month = q("month");
    let out = [];
    for (const spec of specsFor(target(q("spec")))) {
      const list = (await loadSessions(spec)).filter((s) => !month || s.date.startsWith(month));
      out = out.concat(list.map((s) => ({ ...s, specialistName: specName(spec) })));
    }
    out.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
    return json({ ok: true, sessions: out });
  }
  if (a === "session-save") {
    const spec = target(body.specialistId);
    if (!spec) return fail(400, "Оберіть фахівця");
    if (!isDate(body.date)) return fail(400, "Вкажіть дату");
    const service = SERVICES[body.service] ? body.service : "consult";
    const sessions = await loadSessions(spec);
    const packages = await loadPackages(spec);
    const pkg = body.packageId ? packages.find((p) => p.id === body.packageId) : null;
    if (body.packageId && !pkg) return fail(400, "Пакет не знайдено");
    const old = body.id ? sessions.find((s) => s.id === body.id) : null;
    if (pkg && (!old || old.packageId !== pkg.id) && withPackageUse([pkg], sessions)[0].left <= 0) return fail(400, "У пакеті не залишилось оплачених сесій");
    const auto = pkg ? pkg.pricePerSession : priceOf(spec, service);
    const s = {
      id: old ? old.id : uid(), specialistId: spec, date: body.date, time: isTime(body.time) ? body.time : "",
      client: str(body.client, 80), contact: str(body.contact, 80), service,
      price: body.price !== "" && body.price != null && !isNaN(+body.price) ? Math.round(+body.price) : auto,
      paid: pkg ? true : !!body.paid, payMethod: pkg ? "пакет" : str(body.payMethod, 30),
      packageId: pkg ? pkg.id : null, note: str(body.note, 500),
    };
    if (!s.client) return fail(400, "Вкажіть клієнта");
    if (old) Object.assign(old, s); else sessions.push(s);
    await db.set(`sessions-${spec}`, sessions);
    return json({ ok: true, id: s.id, price: s.price });
  }
  if (a === "session-delete") {
    const spec = target(body.specialistId);
    const sessions = await loadSessions(spec);
    const i = sessions.findIndex((s) => s.id === body.id);
    if (i < 0) return fail(404, "Не знайдено");
    sessions.splice(i, 1); await db.set(`sessions-${spec}`, sessions);
    return json({ ok: true });
  }

  // ----- пакети: «лишилось X з N»
  if (a === "packages") {
    let out = [];
    for (const spec of specsFor(target(q("spec")))) {
      out = out.concat(withPackageUse(await loadPackages(spec), await loadSessions(spec)).map((p) => ({ ...p, specialistName: specName(spec) })));
    }
    return json({ ok: true, packages: out });
  }
  if (a === "package-save") {
    const spec = target(body.specialistId);
    if (!spec) return fail(400, "Оберіть фахівця");
    const total = Math.round(+body.total);
    if (!str(body.client) || !(total > 0)) return fail(400, "Вкажіть клієнта і кількість сесій");
    const packages = await loadPackages(spec);
    const old = body.id ? packages.find((p) => p.id === body.id) : null;
    const p = { id: old ? old.id : uid(), specialistId: spec, client: str(body.client, 80), total,
      pricePerSession: Math.round(+body.pricePerSession) || priceOf(spec, "consult") || 0,
      paidAmount: Math.round(+body.paidAmount) || 0, date: isDate(body.date) ? body.date : today(), note: str(body.note, 300) };
    if (old) Object.assign(old, p); else packages.push(p);
    await db.set(`packages-${spec}`, packages);
    return json({ ok: true, id: p.id });
  }
  if (a === "package-delete") {
    const spec = target(body.specialistId);
    const packages = await loadPackages(spec);
    if ((await loadSessions(spec)).some((s) => s.packageId === body.id)) return fail(400, "До пакета вже привʼязані сесії");
    await db.set(`packages-${spec}`, packages.filter((p) => p.id !== body.id));
    return json({ ok: true });
  }

  // ----- статистика за місяць
  if (a === "stats") {
    const month = q("month") || today().slice(0, 7);
    const rows = [];
    for (const spec of specsFor(target(q("spec")))) {
      const all = await loadSessions(spec);
      const list = all.filter((s) => s.date.startsWith(month));
      const sum = (arr) => arr.reduce((t, s) => t + (s.price || 0), 0);
      rows.push({
        specialistId: spec, name: specName(spec), sessions: list.length,
        diag: list.filter((s) => s.service === "diag").length,
        clients: new Set(list.map((s) => s.client.toLowerCase())).size,
        total: sum(list), paid: sum(list.filter((s) => s.paid)), unpaid: sum(list.filter((s) => !s.paid)),
        unpaidCount: list.filter((s) => !s.paid).length,
      });
    }
    return json({ ok: true, month, rows });
  }

  // ----- лише супер-адмін
  if (!isAdmin) return fail(403, "Лише для адміністратора");
  if (a === "analytics") {
    const month = /^\d{4}-\d{2}$/.test(q("month")) ? q("month") : today().slice(0, 7);
    return json({ ok: true, month, ...((await db.get(`analytics-${month}`)) || { days: {}, events: {}, sources: {} }) });
  }
  if (a === "users") {
    const users = (await db.get("users")) || [];
    return json({ ok: true, users: users.map(({ hash, salt, ...u }) => u) });
  }
  if (a === "user-save") {
    const users = (await db.get("users")) || [];
    const login = str(body.login, 60).toLowerCase();
    if (!/^[a-z0-9._-]{3,}$/.test(login)) return fail(400, "Логін: латиниця, цифри, крапка, дефіс (від 3 символів)");
    if (users.some((u) => u.login === login && u.id !== body.id) || login === (process.env.ADMIN_LOGIN || "").toLowerCase()) return fail(409, "Такий логін уже є");
    const old = body.id ? users.find((u) => u.id === body.id) : null;
    if (!old && String(body.password || "").length < 8) return fail(400, "Пароль — щонайменше 8 символів");
    const u = old || { id: uid() };
    Object.assign(u, { login, name: str(body.name, 80) || login, role: body.role === "admin" ? "admin" : "specialist", specialistId: str(body.specialistId, 40) || null });
    if (body.password) {
      if (String(body.password).length < 8) return fail(400, "Пароль — щонайменше 8 символів");
      Object.assign(u, hashPassword(body.password));
    }
    if (!old) users.push(u);
    await db.set("users", users);
    return json({ ok: true, id: u.id });
  }
  if (a === "user-delete") {
    await db.set("users", ((await db.get("users")) || []).filter((u) => u.id !== body.id));
    return json({ ok: true });
  }
  if (a === "config-save") {
    const c = body.config || {};
    const next = {
      discount: Math.min(90, Math.max(0, Math.round(+c.discount || 0))),
      specialists: (c.specialists || []).filter((s) => s.id && s.name).map((s) => ({ id: str(s.id, 40), name: str(s.name, 80),
        prices: Object.fromEntries(Object.entries(s.prices || {}).filter(([k, v]) => ["consult", "pair", "mak"].includes(k) && +v > 0).map(([k, v]) => [k, Math.round(+v)])) })),
      rooms: (c.rooms || []).filter((r) => r.name).map((r) => ({ id: str(r.id, 40) || uid(), name: str(r.name, 60) })),
    };
    if (!next.specialists.length || !next.rooms.length) return fail(400, "Потрібен хоча б один фахівець і один кабінет");
    await db.set("config", next);
    return json({ ok: true });
  }

  return fail(404, "Невідома дія");
}
