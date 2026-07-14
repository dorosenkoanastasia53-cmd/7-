"""
Telegram-бот Анастасії Дорошенко.

Меню з вибором: Консультація / Матеріали / Хочу на марафон / Маю питання.
Оплата матеріалів — ручна (картка monobank) з підтвердженням адміністратором.

Deep-links із сайту:
  t.me/psy_anastasiia_d_bot?start=webinar   -> купівля вебінару
  t.me/psy_anastasiia_d_bot?start=workbook  -> купівля зошита
  t.me/psy_anastasiia_d_bot?start=marathon  -> заявка на марафон

Запуск:
  pip install -r requirements.txt
  python bot.py
"""

import json
import logging
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

# ==========================================================================
#  НАЛАШТУВАННЯ — заповніть своїми значеннями
# ==========================================================================

# Токен бота від @BotFather (ваш бот -> "API Token")
# Можна лишити тут, а можна (безпечніше) задати змінну оточення BOT_TOKEN
# на хостингу — тоді вона матиме пріоритет і токен не лежатиме у коді.
BOT_TOKEN = os.environ.get("BOT_TOKEN") or "8633178387:AAGIaV-lBgqbZi5BHUMsiEFm5BL6Oea4kXY"

# Ваш Telegram id (кому приходять заявки й оплати).
# Дізнатися можна у @userinfobot. 507173671 узято з форми на сайті — перевірте.
ADMIN_ID = 507173671

# Реквізити оплати
CARD_NUMBER = "4441 1144 4701 5536"   # картка monobank
MONO_JAR_URL = ""                     # необовʼязково: посилання на банку (лишіть "" якщо немає)

# Ваші контакти для кнопок
INSTAGRAM_URL = "https://www.instagram.com/psy_anastasiia_d"
TELEGRAM_CONTACT = "https://t.me/dorosenkoanastasia50"

# Платні матеріали. Ключ = payload у deep-link (?start=<key>)
PRODUCTS = {
    "webinar": {
        "title": "Вебінар «Особисті кордони викладача вокалу»",
        "price": "499 грн",
        # Повідомлення, яке клієнт отримає ПІСЛЯ підтвердження оплати:
        "delivery": (
            "🎉 Оплату підтверджено, дякую 💛\n"
            "Надаю доступ до матеріалів вебінару:\n\n"
            "🎥 Запис вебінару:\n"
            "https://drive.google.com/file/d/1bl80ItFzJR1TQK60Pd1x5beZK1Bx6r2T/view\n\n"
            "📊 Презентація:\n"
            "https://drive.google.com/file/d/1A_eSQRCKOC-aEdBn9apsH2q4ZF9T9ayN/view\n\n"
            "📄 Робочий зошит (шаблон для нотаток):\n"
            "• онлайн (Google Docs): "
            "https://docs.google.com/document/d/1KObyjN_JuDXRXxOdwSm7Nub99D9_gPojBlQeryDSWr0/edit\n"
            "• для друку (PDF): "
            "https://drive.google.com/file/d/1Bx7Ddi2Vyo7kH3LTWr-iPoo6fJd5Z3UR/view\n\n"
            "Його можна роздрукувати, скопіювати у свій Google-документ і "
            "заповнювати онлайн, або вести записи у власному блокноті — як вам зручніше.\n\n"
            "Instagram: https://www.instagram.com/psy_anastasiia_d\n\n"
            "Гарного дня! 🌿"
        ),
    },
    "workbook": {
        "title": "Робочий зошит «Я у стосунках»",
        "price": "370 грн",
        "delivery": (
            "🎉 Оплату підтверджено, дякую 💛\n"
            "Ось ваш робочий зошит «Я у стосунках»:\n"
            "https://drive.google.com/file/d/14fwz5DJHyS86WGYUE43kAk8womUrQ5Ra/view\n\n"
            "Гарної роботи над собою! 🌿"
        ),
    },
}

# ==========================================================================

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


# ------------------------------ СТАТИСТИКА ------------------------------
# Прості лічильники подій, збережені у файл (переживають перезапуск бота).

STATS_FILE = os.path.join(os.path.dirname(__file__), "stats.json")


def _load_stats() -> dict:
    try:
        with open(STATS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def bump(key: str) -> None:
    s = _load_stats()
    s[key] = s.get(key, 0) + 1
    with open(STATS_FILE, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False)


# ------------------------------ ГОЛОВНЕ МЕНЮ ------------------------------

def main_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📅 Консультація", callback_data="menu:consult")],
            [InlineKeyboardButton("📚 Матеріали", callback_data="menu:materials")],
            [InlineKeyboardButton("🎯 Хочу на марафон", callback_data="menu:marathon")],
            [InlineKeyboardButton("💬 Маю питання", callback_data="menu:question")],
        ]
    )


async def show_main_menu(chat_id, context: ContextTypes.DEFAULT_TYPE, greet=True):
    text = (
        "Вітаю! 🌿 Це бот Анастасії Дорошенко.\nОберіть, що вас цікавить:"
        if greet
        else "Оберіть, що вас цікавить:"
    )
    await context.bot.send_message(chat_id, text, reply_markup=main_menu_kb())


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.pop("state", None)
    key = context.args[0] if context.args else None

    if key in PRODUCTS:
        await send_product(update.effective_chat.id, key, context)
    elif key == "marathon":
        await marathon_start(update.effective_chat.id, context)
    else:
        await show_main_menu(update.effective_chat.id, context)


# ------------------------------ КОНСУЛЬТАЦІЯ ------------------------------

async def menu_consult(chat_id, context: ContextTypes.DEFAULT_TYPE):
    text = (
        "📅 <b>Консультації</b> (онлайн, Zoom / Google Meet):\n\n"
        "• Діагностична сесія — 800 грн\n"
        "• Індивідуальна консультація — 1000 грн\n"
        "• Парна сесія — 1200 грн\n"
        "• МАК-сесія (90 хв) — 1200 грн\n\n"
        "Щоб записатися — напишіть Анастасії, і вона підбере зручний час 💛"
    )
    kb = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📩 Написати в Telegram", url=TELEGRAM_CONTACT)],
            [InlineKeyboardButton("📷 Написати в Instagram", url=INSTAGRAM_URL)],
            [InlineKeyboardButton("⬅️ Назад", callback_data="menu:back")],
        ]
    )
    await context.bot.send_message(chat_id, text, parse_mode="HTML", reply_markup=kb)


# ------------------------------ МАТЕРІАЛИ ------------------------------

async def menu_materials(chat_id, context: ContextTypes.DEFAULT_TYPE):
    buttons = [
        [InlineKeyboardButton(f"{p['title']} — {p['price']}", callback_data=f"buy:{k}")]
        for k, p in PRODUCTS.items()
    ]
    buttons.append([InlineKeyboardButton("🎯 Хочу на марафон", callback_data="menu:marathon")])
    buttons.append([InlineKeyboardButton("⬅️ Назад", callback_data="menu:back")])
    await context.bot.send_message(
        chat_id,
        "📚 <b>Матеріали</b> — оберіть, що вас цікавить:",
        parse_mode="HTML",
        reply_markup=InlineKeyboardMarkup(buttons),
    )


async def send_product(chat_id, key, context: ContextTypes.DEFAULT_TYPE):
    prod = PRODUCTS[key]
    pay_line = f"на картку: <code>{CARD_NUMBER}</code>"
    if MONO_JAR_URL:
        pay_line = f"на банку: {MONO_JAR_URL}\n(або на картку: <code>{CARD_NUMBER}</code>)"
    text = (
        f"🤍 <b>{prod['title']}</b>\n"
        f"Вартість: <b>{prod['price']}</b>\n\n"
        f"Для оплати перекажіть суму {pay_line}\n\n"
        f"Після оплати натисніть кнопку нижче і надішліть скрін/чек — "
        f"Анастасія перевірить і одразу дасть вам доступ 💛"
    )
    kb = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("✅ Я оплатив(ла)", callback_data=f"paid:{key}")],
            [InlineKeyboardButton("⬅️ Назад", callback_data="menu:materials")],
        ]
    )
    await context.bot.send_message(chat_id, text, parse_mode="HTML", reply_markup=kb)


# ------------------------------ МАРАФОН ------------------------------

async def marathon_start(chat_id, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["state"] = "marathon"
    await context.bot.send_message(
        chat_id,
        "🎯 <b>Марафон «Я, яка любить»</b> — 7 днів до глибшого контакту з собою.\n\n"
        "Залиште, будь ласка, ваш нік у Telegram (напр. @nick) або номер телефону — "
        "і Анастасія звʼяжеться з вами щодо участі 💛",
        parse_mode="HTML",
    )


# ------------------------------ ПИТАННЯ ------------------------------

async def question_start(chat_id, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["state"] = "question"
    await context.bot.send_message(
        chat_id,
        "💬 Напишіть ваше запитання одним повідомленням — я передам його "
        "Анастасії, і вона відповість 🌿",
    )


# ------------------------------ CALLBACKS ------------------------------

async def on_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    what = query.data.split(":", 1)[1]
    chat_id = query.effective_chat.id
    if what == "consult":
        await menu_consult(chat_id, context)
    elif what == "materials":
        await menu_materials(chat_id, context)
    elif what == "marathon":
        await marathon_start(chat_id, context)
    elif what == "question":
        await question_start(chat_id, context)
    elif what == "back":
        context.user_data.pop("state", None)
        await show_main_menu(chat_id, context, greet=False)


async def on_buy(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    key = query.data.split(":", 1)[1]
    await send_product(query.effective_chat.id, key, context)


async def on_paid(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    key = query.data.split(":", 1)[1]
    context.user_data["state"] = ("proof", key)
    await query.message.reply_text(
        "Дякую! Надішліть, будь ласка, скрін або фото чеку про оплату 📷"
    )


async def on_admin_decision(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if query.from_user.id != ADMIN_ID:
        await query.answer("Немає доступу", show_alert=True)
        return
    action, user_id_s, key = query.data.split(":")
    user_id = int(user_id_s)
    prod = PRODUCTS.get(key, {})
    if action == "ok":
        await context.bot.send_message(user_id, prod.get("delivery", "Дякую за оплату! 💛"))
        bump(f"sale_{key}")
        await query.answer("Підтверджено ✅")
        await query.edit_message_caption(
            (query.message.caption or "") + "\n\n✅ ПІДТВЕРДЖЕНО, доступ надіслано"
        )
    else:
        await context.bot.send_message(
            user_id,
            "На жаль, оплату не вдалося підтвердити. "
            "Напишіть, будь ласка, @dorosenkoanastasia50 — розберемось 🤍",
        )
        await query.answer("Відхилено")
        await query.edit_message_caption(
            (query.message.caption or "") + "\n\n❌ ВІДХИЛЕНО"
        )


# ------------------------------ ПОВІДОМЛЕННЯ ВІД КЛІЄНТА ------------------------------

async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    state = context.user_data.get("state")
    user = update.effective_user
    uname = f"@{user.username}" if user.username else f"id {user.id}"

    # 1) Скрін оплати
    if isinstance(state, tuple) and state[0] == "proof":
        key = state[1]
        if not (update.message.photo or update.message.document):
            await update.message.reply_text("Надішліть, будь ласка, скрін або фото чеку 📷")
            return
        prod = PRODUCTS[key]
        caption = (
            f"📩 Нова оплата на підтвердження\n"
            f"Товар: {prod['title']} ({prod['price']})\n"
            f"Клієнт: {user.full_name} ({uname})"
        )
        kb = InlineKeyboardMarkup(
            [
                [
                    InlineKeyboardButton("✅ Підтвердити", callback_data=f"ok:{user.id}:{key}"),
                    InlineKeyboardButton("❌ Відхилити", callback_data=f"no:{user.id}:{key}"),
                ]
            ]
        )
        await context.bot.copy_message(
            chat_id=ADMIN_ID,
            from_chat_id=update.effective_chat.id,
            message_id=update.message.message_id,
            caption=caption,
            reply_markup=kb,
        )
        bump(f"req_{key}")
        context.user_data.pop("state", None)
        await update.message.reply_text("Дякую! Передала на перевірку — відповім протягом дня 💛")
        return

    # 2) Заявка на марафон
    if state == "marathon":
        contact = update.message.text or uname
        await context.bot.send_message(
            ADMIN_ID,
            f"🎯 Заявка на МАРАФОН\nВід: {user.full_name} ({uname})\nКонтакт: {contact}",
        )
        bump("marathon")
        context.user_data.pop("state", None)
        await update.message.reply_text(
            "Дякую! Записала вас — Анастасія звʼяжеться найближчим часом 🌿"
        )
        return

    # 3) Питання
    if state == "question":
        await context.bot.send_message(
            ADMIN_ID,
            f"💬 Питання від {user.full_name} ({uname}):\n\n{update.message.text or '(без тексту)'}",
        )
        bump("question")
        context.user_data.pop("state", None)
        await update.message.reply_text("Дякую! Передала запитання Анастасії — вона відповість 💛")
        return

    # 4) Інакше — показати меню
    await show_main_menu(update.effective_chat.id, context, greet=False)


async def stats_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Зведена статистика (тільки для адміна): /stats"""
    if update.effective_user.id != ADMIN_ID:
        return
    s = _load_stats()
    lines = ["📊 <b>Статистика бота</b>", ""]
    for k, p in PRODUCTS.items():
        lines.append(f"<b>{p['title']}</b>")
        lines.append(f"  • заявок на оплату: {s.get('req_' + k, 0)}")
        lines.append(f"  • підтверджених продажів: {s.get('sale_' + k, 0)}")
    lines.append("")
    lines.append(f"🎯 Заявок на марафон: {s.get('marathon', 0)}")
    lines.append(f"💬 Питань: {s.get('question', 0)}")
    await update.message.reply_text("\n".join(lines), parse_mode="HTML")


def main():
    if BOT_TOKEN.startswith("ВСТАВТЕ"):
        raise SystemExit("Спочатку впишіть BOT_TOKEN у налаштуваннях вгорі файлу.")

    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("menu", lambda u, c: show_main_menu(u.effective_chat.id, c)))
    app.add_handler(CommandHandler("stats", stats_cmd))
    app.add_handler(CallbackQueryHandler(on_menu, pattern=r"^menu:"))
    app.add_handler(CallbackQueryHandler(on_buy, pattern=r"^buy:"))
    app.add_handler(CallbackQueryHandler(on_paid, pattern=r"^paid:"))
    app.add_handler(CallbackQueryHandler(on_admin_decision, pattern=r"^(ok|no):"))
    app.add_handler(MessageHandler(
        (filters.TEXT & ~filters.COMMAND) | filters.PHOTO | filters.Document.ALL,
        on_message,
    ))

    logger.info("Бот запущено. Ctrl+C для зупинки.")
    app.run_polling()


if __name__ == "__main__":
    main()
