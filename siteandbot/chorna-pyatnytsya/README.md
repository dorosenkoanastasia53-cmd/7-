# Лендинг «Чорна пʼятниця» — Метаморфоза

Повністю самостійний сайт: звичайні файли `index.html` + `img/`, без сервера і без звʼязку з основним сайтом.
**Публікація: просто перетягніть папку на Netlify** (Deploys → drag & drop). GitHub не потрібен.

## Заявки
1. **Netlify Forms (працює одразу після одного налаштування)**
   - Netlify → сайт → **Site configuration → Forms → Enable form detection**
   - перетягніть папку ще раз (щоб Netlify знайшов форму)
   - заявки: **Forms → bf-lead**; листи на пошту: **Forms → Form notifications → Add notification → Email**
   - безкоштовно до 100 заявок на місяць
2. **Telegram (за бажанням)** — у `index.html` вгорі блоку `<script>`:
   - створіть **окремого** бота в @BotFather → вставте токен у `TG_BOT_TOKEN`
   - ваш Telegram id (@userinfobot) → `TG_CHAT_ID`; напишіть боту /start
   - токен видно в коді сторінки — тому не використовуйте бота основного сайту

## Статистика (окремо для цього сайту) — у `index.html`, вгорі блоку `<script>`
- `CLARITY_ID` — **Microsoft Clarity** (безкоштовно, clarity.microsoft.com → New project):
  відвідувачі, джерела, час на сайті, кліки й теплові карти, записи сесій.
  Події лендингу (запити, фахівці, месенджер, заявки) видно у фільтрі «Custom events».
- `GA4_ID` — **Google Analytics 4**: джерела, utm-мітки реклами, час, події, заявки (generate_lead).
- `META_PIXEL_ID` — піксель Meta, щоб реклама оптимізувалась на заявки.

## Посилання для реклами
`https://<адреса-лендингу>/?utm_source=ig&utm_content=<назва_креативу>`
