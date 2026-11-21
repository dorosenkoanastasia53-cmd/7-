// Аналітика лендингу «Чорна пʼятниця» (Netlify Function + Netlify Blobs).
// Анонімно: без cookies, IP-адрес та імен — лише лічильники за днями.
//
//   POST /.netlify/functions/track            — сторінка надсилає подію
//   GET  /.netlify/functions/track?month=YYYY-MM  (заголовок Authorization: Bearer <пароль>)
//                                              — статистика для сторінки /stats
//
// Змінна оточення в Netlify: STATS_PASSWORD — пароль до сторінки /stats

import crypto from "node:crypto";

const EVENTS = ["page_view", "time", "bf_view", "bf_ad", "bf_scroll", "bf_form_start", "bf_messenger", "bf_topic",
  "booking_click", "choose_specialist", "specialist_open", "promo_click", "form_submit_psy", "telegram_click", "instagram_click", "rent_click"];
const SOURCES = ["Пряме", "Instagram", "Telegram", "Facebook", "Google", "Інше"];
const TIME_BUCKETS = ["до 10 с", "10–30 с", "30 с – 1 хв", "1–3 хв", "3–10 хв", "понад 10 хв"];
const bucket = (s) => TIME_BUCKETS[s < 10 ? 0 : s < 30 ? 1 : s < 60 ? 2 : s < 180 ? 3 : s < 600 ? 4 : 5];
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Kyiv" }).format(new Date());
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function store() {
  const { getStore } = await import("@netlify/blobs");
  const s = getStore({ name: "bf-analytics", consistency: "strong" });
  return { get: (k) => s.get(k, { type: "json" }), set: (k, v) => s.setJSON(k, v) };
}

function passwordOk(req) {
  const want = process.env.STATS_PASSWORD || "";
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!want || !got) return false;
  const a = crypto.createHash("sha256").update(want).digest(), b = crypto.createHash("sha256").update(got).digest();
  return crypto.timingSafeEqual(a, b);
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const db = await store();

    if (req.method === "GET") {
      if (!process.env.STATS_PASSWORD) return json({ ok: false, error: "Додайте змінну STATS_PASSWORD у налаштуваннях сайту на Netlify" }, 500);
      if (!passwordOk(req)) return json({ ok: false, error: "Невірний пароль" }, 401);
      const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") || "") ? url.searchParams.get("month") : today().slice(0, 7);
      const st = (await db.get(`m-${month}`)) || {};
      return json({ ok: true, month, days: st.days || {}, events: st.events || {}, sources: st.sources || {}, timeBuckets: st.timeBuckets || {} });
    }
    if (req.method !== "POST") return json({ ok: false }, 405);

    let body = {};
    try { body = JSON.parse(await req.text()); } catch {}
    const e = str(body.e, 40), label = str(body.label, 80) || "—";
    if (!EVENTS.includes(e)) return json({ ok: true });

    const day = today(), key = `m-${day.slice(0, 7)}`;
    const st = (await db.get(key)) || { days: {}, events: {}, sources: {}, timeBuckets: {} };
    const d = (st.days[day] ||= { views: 0, visitors: 0, seconds: 0, leads: 0 });

    if (e === "time") {
      const total = Math.min(3600, Math.max(0, Math.round(+body.total || 0))), prev = Math.min(total, Math.max(0, Math.round(+body.prev || 0)));
      d.seconds += total - prev;
      if (prev > 0) st.timeBuckets[bucket(prev)] = Math.max(0, (st.timeBuckets[bucket(prev)] || 0) - 1);
      if (total > 0) st.timeBuckets[bucket(total)] = (st.timeBuckets[bucket(total)] || 0) + 1;
    } else if (e === "page_view") {
      d.views++;
      if (body.newVisitor) {
        d.visitors++;
        const src = SOURCES.includes(body.src) ? body.src : "Інше";
        st.sources[src] = (st.sources[src] || 0) + 1;
      }
    } else {
      if (e === "form_submit_psy") d.leads++;
      const ev = (st.events[e] ||= {});
      ev[label] = (ev[label] || 0) + 1;
    }
    await db.set(key, st);
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: "Помилка сервера" }, 500);
  }
};
