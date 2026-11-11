// Netlify-функція для сторінки /stats.html: віддає статистику за обраний період.
// Доступ — за паролем зі змінної оточення STATS_KEY (Netlify → Environment variables).
const crypto = require("crypto");
const { getStore, connectLambda } = require("@netlify/blobs");

function safeEqual(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}
function addDays(s, n) {
  const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function kyivDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

exports.handler = async (event) => {
  const json = (code, body) => ({ statusCode: code, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
  if (event.httpMethod !== "POST") return json(405, { error: "method" });
  if (!process.env.STATS_KEY) return json(500, { error: "Задайте змінну STATS_KEY у Netlify" });
  let d;
  try { d = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad_json" }); }
  if (!safeEqual(d.key, process.env.STATS_KEY)) return json(401, { error: "Невірний пароль" });

  const days = Math.min(Math.max(parseInt(d.days, 10) || 30, 1), 365);
  connectLambda(event);
  const store = getStore({ name: "stats", consistency: "strong" });
  const today = kyivDate();
  const keys = [];
  for (let i = days - 1; i >= 0; i--) keys.push(addDays(today, -i));
  const docs = await Promise.all(keys.map((k) => store.get("d/" + k, { type: "json" }).catch(() => null)));
  const out = keys.map((date, i) => {
    const doc = docs[i] || { views: 0, visitors: {}, events: {}, sources: {}, devices: {} };
    return { date, views: doc.views, visitors: Object.keys(doc.visitors).length, contacted: Object.keys(doc.contacted || {}).length, events: doc.events, sources: doc.sources, devices: doc.devices };
  });
  return json(200, { days: out });
};
