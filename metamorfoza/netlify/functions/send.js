// Netlify-функція: приймає заявку на бронювання з сайту «Метаморфоза»
// і пересилає її в Telegram через бота.
// Токен бота НЕ зберігається в коді сайту — лише в змінних оточення Netlify:
//   Netlify → Site configuration → Environment variables
//     BOT_TOKEN      — токен бота від @BotFather
//     ADMIN_CHAT_ID  — Telegram id, куди надходять заявки (дізнатися: @userinfobot).
//                      Можна кілька через кому: 507173671,123456789
// Важливо: кожен отримувач має один раз написати боту /start, інакше Telegram
// не дозволить боту надсилати йому повідомлення.
//
// Перевірка налаштувань: відкрийте в браузері ваш-сайт/.netlify/functions/send
// — сторінка покаже, що саме не так (токен, id, /start). Токен вона не показує.

// Пояснення помилок Telegram зрозумілою мовою
function explain(desc) {
  const d = String(desc || "");
  if (/chat not found/i.test(d)) return "Бот не знає цього чату: або ADMIN_CHAT_ID неправильний, або ви ще не написали цьому боту /start.";
  if (/unauthorized|^not found$/i.test(d)) return "BOT_TOKEN неправильний: Telegram його не приймає. Скопіюйте токен заново з @BotFather (без пробілів і лапок).";
  if (/bot can't initiate|forbidden.*initiate/i.test(d)) return "Ви ще не написали цьому боту /start. Відкрийте бота в Telegram і натисніть «Start».";
  if (/blocked by the user/i.test(d)) return "Бота заблоковано в Telegram. Розблокуйте його й натисніть «Start».";
  if (/bots can't send messages to bots/i.test(d)) return "ADMIN_CHAT_ID — це id бота, а потрібен ваш особистий id (дізнатися: @userinfobot).";
  return "Telegram відповів: " + d;
}

async function tg(token, method, body) {
  const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return resp.json().catch(() => ({ ok: false, description: "HTTP " + resp.status }));
}

// GET — сторінка самоперевірки налаштувань
async function diagnose() {
  const token = String(process.env.BOT_TOKEN || "").trim();
  const raw = String(process.env.ADMIN_CHAT_ID || "");
  const chatIds = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const lines = [];
  let allOk = true;
  const bad = (t) => { allOk = false; lines.push("❌ " + t); };
  const good = (t) => lines.push("✅ " + t);

  lines.push("Функція відправки заявок працює (сайт опубліковано правильно).");
  if (!token) bad("Змінна BOT_TOKEN не задана або сайт не перезапущено після її додавання (Deploys → Trigger deploy).");
  else if (!/^\d+:[\w-]{30,}$/.test(token)) bad("BOT_TOKEN має дивний формат. Він виглядає так: 1234567890:AAH... — скопіюйте з @BotFather без пробілів і лапок.");
  if (!chatIds.length) bad("Змінна ADMIN_CHAT_ID не задана або сайт не перезапущено після її додавання.");
  for (const id of chatIds) if (!/^-?\d+$/.test(id)) bad(`ADMIN_CHAT_ID «${id}» — це не числовий id. Потрібні лише цифри (дізнатися: напишіть @userinfobot), не @нік.`);

  if (token && allOk) {
    const me = await tg(token, "getMe");
    if (!me.ok) bad(explain(me.description));
    else {
      good(`Токен правильний — бот @${me.result.username}.`);
      for (const id of chatIds) {
        const r = await tg(token, "sendMessage", { chat_id: id, text: "✅ Перевірка: заявки з сайту «Метаморфоза» надходитимуть сюди." });
        if (r.ok) good(`Тестове повідомлення надіслано в чат ${id} — перевірте Telegram.`);
        else bad(`Чат ${id}: ${explain(r.description)} (Напишіть /start саме боту @${me.result.username}.)`);
      }
    }
  }
  lines.unshift(allOk ? "Усе налаштовано ✅" : "Є проблема ❌", "");
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    body: lines.join("\n"),
  };
}

const clean = (v, n) => String(v == null ? "" : v).replace(/\r/g, "").trim().slice(0, n);

exports.handler = async (event) => {
  const json = (statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  });
  if (event.httpMethod === "GET") return diagnose();
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "method" });

  const token = String(process.env.BOT_TOKEN || "").trim();
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
    let delivered = 0, lastError = "";
    for (const chatId of chatIds) {
      const result = await tg(token, "sendMessage", { chat_id: chatId, text: message });
      if (result.ok) delivered++;
      else { lastError = result.description; console.error("telegram", chatId, JSON.stringify(result).slice(0, 300)); }
    }
    return delivered ? json(200, { ok: true }) : json(502, { ok: false, error: "telegram", reason: explain(lastError) });
  } catch (e) {
    console.error(e);
    return json(502, { ok: false, error: "telegram_unreachable" });
  }
};
