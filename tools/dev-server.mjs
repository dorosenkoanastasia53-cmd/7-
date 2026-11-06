// Локальна перевірка сайту «Метаморфози» разом з API адмін-панелі (без Netlify).
// Запуск:  ADMIN_LOGIN=admin ADMIN_PASSWORD=... AUTH_SECRET=... node tools/dev-server.mjs [порт]
// Дані зберігаються у папці LOCAL_STORE_DIR (за замовчуванням .local-store поруч із сайтом).
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, "../siteandbot/metamorfoza");
process.env.LOCAL_STORE_DIR ||= path.join(site, ".local-store");
const { default: api } = await import(path.join(site, "netlify/functions/api.mjs"));
const port = +process.argv[2] || 8787;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname === "/.netlify/functions/api") {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await api(new Request(url, { method: req.method, headers: req.headers, body: req.method === "POST" ? Buffer.concat(chunks) : undefined }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(await r.text());
  }
  if (url.pathname === "/.netlify/functions/send") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"ok":true}'); }
  let file = path.join(site, "public", decodeURIComponent(url.pathname));
  if (!file.startsWith(path.join(site, "public"))) { res.writeHead(403); return res.end(); }
  try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, "index.html"); res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" }); res.end(await fs.readFile(file)); }
  catch { res.writeHead(404); res.end("Not found"); }
}).listen(port, () => console.log(`http://localhost:${port}`));
