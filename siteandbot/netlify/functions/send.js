// Netlify-функція: приймає заявку з форми сайту і надсилає її в Telegram.
// Токен і chat_id зберігаються у змінних оточення Netlify (не в коді сайту).
//
// Потрібні змінні оточення (Netlify → Site settings → Environment variables):
//   BOT_TOKEN        — токен бота від @BotFather
//   ADMIN_CHAT_ID    — ваш Telegram id (кому приходять заявки), напр. 507173671

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const token = process.env.BOT_TOKEN;
  const chatId = process.env.ADMIN_CHAT_ID;
  if (!token || !chatId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: "not_configured" }),
    };
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    data = {};
  }
  const text = String(data.text || "").slice(0, 4000);
  if (!text) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: "empty" }) };
  }

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const result = await resp.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: "telegram_unreachable" }) };
  }
};
