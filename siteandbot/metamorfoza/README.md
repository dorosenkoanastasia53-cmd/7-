# Метаморфоза — сайт і кабінет фахівця

- `public/` — сайт (публікується), `public/admin/` — кабінет фахівця
- `netlify/functions/api.mjs` — API кабінету (дані в Netlify Blobs)
- `netlify/functions/send.js` — заявки з сайту в Telegram

## Запуск на Netlify
1. Add new site → Import from GitHub → репозиторій `7-`, **Base directory:** `siteandbot/metamorfoza`.
2. Site settings → Environment variables:
   - `BOT_TOKEN`, `ADMIN_CHAT_ID` — заявки в Telegram
   - `ADMIN_LOGIN`, `ADMIN_PASSWORD` — вхід супер-адміна в `/admin`
   - `AUTH_SECRET` — будь-який довгий випадковий рядок (від 32 символів)
3. Відкрийте `/admin`, увійдіть як супер-адмін → «Користувачі» → додайте фахівців.

## Хто що бачить
- Сайт: лише вільні вікна (без даних клієнтів).
- Фахівець: свої вільні години; усі кабінети (зайнято: імʼя фахівця або «Орендар»); свої консультації, пакети, статистику.
- Супер-адмін: усе, плюс користувачі, кабінети, ціни, назви орендарів.

## Локальна перевірка
`ADMIN_LOGIN=admin ADMIN_PASSWORD=... AUTH_SECRET=... node tools/dev-server.mjs` → http://localhost:8787
