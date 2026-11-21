// Netlify-функція: приймає заявку з форми сайту і надсилає її в Telegram.
// Токен і chat_id зберігаються у змінних оточення Netlify (не в коді сайту).
//
// Потрібні змінні оточення (Netlify → Site settings → Environment variables):
//   BOT_TOKEN        — токен бота від @BotFather
//   ADMIN_CHAT_ID    — ваш Telegram id (кому приходять заявки)
// Після зміни змінних сайт треба опублікувати заново (Deploys → Trigger deploy).
//
// Перевірка: відкрийте в браузері  /.netlify/functions/send?check=1
// — побачите, чи задані змінні, чи правильний токен і чи може бот писати вам.

const reply = (statusCode, data) => ({
  statusCode,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  body: JSON.stringify(data, null, 2),
});

async function tg(token, method, payload) {
  const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  return resp.json();
}

// Пояснення помилок Telegram простими словами
function explain(desc = "") {
  if (/unauthorized/i.test(desc)) return "BOT_TOKEN неправильний: скопіюйте токен заново з @BotFather (без пробілів і лапок).";
  if (/chat not found/i.test(desc)) return "Бот не знає цього чату: відкрийте бота в Telegram з того акаунта, куди мають приходити заявки, і натисніть Start. Або ADMIN_CHAT_ID неправильний (дізнатися свій id: @userinfobot).";
  if (/blocked by the user/i.test(desc)) return "Бота заблоковано в цьому акаунті: розблокуйте його і натисніть Start.";
  if (/bots can't send messages to bots/i.test(desc)) return "В ADMIN_CHAT_ID вказано id бота, а треба ваш особистий id (@userinfobot).";
  if (/not enough rights|have no rights/i.test(desc)) return "Бот не має права писати в цю групу/канал: додайте його адміністратором.";
  return desc;
}

exports.handler = async (event) => {
  const token = (process.env.BOT_TOKEN || "").trim();
  const chatId = (process.env.ADMIN_CHAT_ID || "").trim();

  // ---- діагностика
  if (event.httpMethod === "GET") {
    if (!(event.queryStringParameters || {}).check) return reply(405, { ok: false, error: "Method Not Allowed" });
    const out = { BOT_TOKEN: token ? "задано" : "НЕ задано", ADMIN_CHAT_ID: chatId ? `задано (…${chatId.slice(-4)})` : "НЕ задано" };
    if (!token || !chatId) return reply(200, { ...out, ok: false, fix: "Додайте змінні в Netlify і опублікуйте сайт заново (Deploys → Trigger deploy)." });
    try {
      const me = await tg(token, "getMe");
      if (!me.ok) return reply(200, { ...out, ok: false, bot: "токен не підходить", fix: explain(me.description) });
      out.bot = "@" + me.result.username;
      const chat = await tg(token, "getChat", { chat_id: chatId });
      if (!chat.ok) return reply(200, { ...out, ok: false, chat: "недоступний", fix: explain(chat.description) });
      out.chat = chat.result.title || [chat.result.first_name, chat.result.last_name].filter(Boolean).join(" ") || chat.result.username || "ok";
      return reply(200, { ...out, ok: true, result: "Все налаштовано: заявки приходитимуть від " + out.bot + " у чат «" + out.chat + "»." });
    } catch (e) {
      return reply(200, { ...out, ok: false, fix: "Не вдалося зʼєднатися з Telegram: " + e.message });
    }
  }

  if (event.httpMethod !== "POST") return reply(405, { ok: false, error: "Method Not Allowed" });
  if (!token || !chatId) {
    console.error("send: BOT_TOKEN або ADMIN_CHAT_ID не задані (після додавання змінних потрібен новий deploy)");
    return reply(500, { ok: false, error: "not_configured" });
  }

  let data;
  try { data = JSON.parse(event.body || "{}"); } catch { data = {}; }
  const text = String(data.text || "").slice(0, 4000);
  if (!text) return reply(400, { ok: false, error: "empty" });

  try {
    const result = await tg(token, "sendMessage", { chat_id: chatId, text });
    if (!result.ok) {
      console.error("send: Telegram відмовив:", result.description, "→", explain(result.description));
      return reply(502, { ok: false, error: "telegram_error", description: result.description, fix: explain(result.description) });
    }
    return reply(200, { ok: true });
  } catch (e) {
    console.error("send: Telegram недоступний:", e.message);
    return reply(502, { ok: false, error: "telegram_unreachable" });
  }
};
