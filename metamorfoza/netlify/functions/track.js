// Netlify-функція: збирає анонімну статистику відвідувань сайту «Метаморфоза».
// Жодних персональних даних: лише випадковий id браузера, джерело переходу та дії.
// Дані зберігаються в Netlify Blobs (вмикається автоматично), по одному запису на день.
const { getStore, connectLambda } = require("@netlify/blobs");

const EVENTS = ["view", "tg", "ig", "form", "form_open", "room_small", "room_big", "room_hall", "photo"];
const BOT_RE = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|telegrambot|whatsapp/i;

function kyivDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const clip = (v, n) => String(v || "").replace(/[^\w.\-а-яіїєґА-ЯІЇЄҐ ]/g, "").slice(0, n);

exports.handler = async (event) => {
  const ok = { statusCode: 204, headers: { "Cache-Control": "no-store" }, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };
  if (BOT_RE.test((event.headers && event.headers["user-agent"]) || "")) return ok;

  let d;
  try { d = JSON.parse(event.body || "{}"); } catch { return ok; }
  const ev = String(d.e || "");
  if (!EVENTS.includes(ev)) return ok;
  const vid = clip(d.v, 16);
  const src = clip(d.s, 40) || "direct";
  const device = d.m ? "mobile" : "desktop";

  try {
    connectLambda(event);
    const store = getStore({ name: "stats", consistency: "strong" });
    const key = "d/" + kyivDate();
    for (let i = 0; i < 6; i++) {
      const cur = await store.getWithMetadata(key, { type: "json" });
      const doc = cur ? cur.data : { views: 0, visitors: {}, events: {}, sources: {}, devices: {} };
      doc.events[ev] = (doc.events[ev] || 0) + 1;
      if ((ev === "tg" || ev === "ig" || ev === "form") && vid) {
        doc.contacted = doc.contacted || {};
        doc.contacted[vid] = 1;
      }
      if (ev === "view") {
        doc.views++;
        if (vid && !doc.visitors[vid]) {
          doc.visitors[vid] = 1;
          doc.sources[src] = (doc.sources[src] || 0) + 1;
          doc.devices[device] = (doc.devices[device] || 0) + 1;
        }
      }
      const w = await store.setJSON(key, doc, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
      if (w.modified) break;
    }
  } catch (e) {
    console.error("track", e);
  }
  return ok;
};
