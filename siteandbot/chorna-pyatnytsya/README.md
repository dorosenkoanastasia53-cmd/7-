# Лендинг «Чорна пʼятниця» — Метаморфоза

Окремий сайт (psychorna-pyatnytsya.netlify.app), влаштований як основний:
власний бот для заявок і власна статистика. Публікується з GitHub.

| Файл | Що це |
|---|---|
| `index.html`, `img/` | сторінка |
| `netlify/functions/send.js` | заявки → Telegram-бот |
| `netlify/functions/track.mjs` | статистика (Netlify Blobs, анонімно) |
| `stats/` | сторінка статистики `/stats` |

## Підключення до GitHub (один раз)
Netlify → сайт psychorna-pyatnytsya → Site configuration → Build & deploy → Link repository → GitHub →
репозиторій `dorosenkoanastasia53-cmd/7-`:
- Branch: `claude/elegant-hopper-766yof`
- Base directory: `siteandbot/chorna-pyatnytsya`
- Build command, Publish, Functions — порожньо (усе в `netlify.toml`)

## Змінні (Site configuration → Environment variables)
- `BOT_TOKEN` — токен бота (@BotFather → /mybots → бот → API Token)
- `ADMIN_CHAT_ID` — **ваш особистий** Telegram id (не номер бота!)
- `STATS_PASSWORD` — пароль до `/stats`

Після зміни змінних: Deploys → Trigger deploy.

## Перевірка
- бот: `/.netlify/functions/send?check=1` → «Все налаштовано»
- статистика: `/stats` → пароль

## Посилання для реклами
`https://psychorna-pyatnytsya.netlify.app/?utm_source=ig&utm_content=<назва_креативу>`
