// Netlify-функція: приймає заявку на бронювання з сайту «Метаморфоза»
// і пересилає її в Telegram через бота.
// Токен бота НЕ зберігається в коді сайту — лише в змінних оточення Netlify:
//   Netlify → Site configuration → Environment variables
//     BOT_TOKEN      — токен бота від @BotFather
//     ADMIN_CHAT_ID  — Telegram id, куди надходять заявки (дізнатися: @userinfobot).
//                      Можна кілька через кому: 507173671,123456789
// Важливо: кожен отримувач має один раз написати боту /start, інакше Telegram
// не дозволить боту надсилати йому повідомлення.

const clean = (v, n) => String(v == null ? "" : v).replace(/\r/g, "").trim().slice(0, n);

exports.handler = async (event) => {
  const json = (statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  });
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "method" });

  const token = process.env.BOT_TOKEN;
  const chatIds = String(process.env.ADMIN_CHAT_ID || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!token || !chatIds.length) return json(500, { ok: false, error: "not_configured" });

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "bad_json" });
  }

  // Приховане поле-пастка для ботів: людина його не бачить і не заповнює.
  if (data.website) return json(200, { ok: true });

  const name = clean(data.name, 100);
  const contact = clean(data.contact, 100);
  const text = clean(data.text, 2500);
  if (name.length < 2 || contact.replace(/\D/g, "").length < 5 && !/@|t\.me/i.test(contact)) {
    return json(400, { ok: false, error: "contact" });
  }

  const message = [
    "🦋 Нова заявка з сайту «Метаморфоза»",
    "",
    `👤 ${name}`,
    `📞 ${contact}`,
    "",
    text || "(без деталей)",
  ].join("\n").slice(0, 4000);

  try {
    let delivered = 0;
    for (const chatId of chatIds) {
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
      const result = await resp.json().catch(() => ({}));
      if (result.ok) delivered++;
      else console.error("telegram", chatId, JSON.stringify(result).slice(0, 300));
    }
    return delivered ? json(200, { ok: true }) : json(502, { ok: false, error: "telegram" });
  } catch (e) {
    console.error(e);
    return json(502, { ok: false, error: "telegram_unreachable" });
  }
};
