import io, sys, segno
from PIL import Image, ImageDraw, ImageFont

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://metamorfoza.netlify.app"
EMBLEM = "/home/user/7-/siteandbot/metamorfoza/public/img/emblem.webp"
GREEN, GOLD, CREAM = (19, 53, 18), (201, 160, 52), (251, 248, 245)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
FONT_S = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def card(path, title, subtitle, out):
    url = BASE.rstrip("/") + path
    qr = segno.make(url, error="h")
    buf = io.BytesIO(); qr.save(buf, kind="png", scale=40, border=0, dark="#133512", light="#ffffff"); buf.seek(0)
    q = Image.open(buf).convert("RGB")
    # метелик у центрі (≈20% ширини — безпечно для рівня корекції H)
    size = q.width
    em = Image.open(EMBLEM).convert("RGBA"); em.thumbnail((int(size * 0.2), int(size * 0.2)))
    pad = int(size * 0.025)
    d = ImageDraw.Draw(q)
    cx, cy = size // 2, size // 2
    d.rounded_rectangle([cx - em.width // 2 - pad, cy - em.height // 2 - pad, cx + em.width // 2 + pad, cy + em.height // 2 + pad], radius=pad * 2, fill="white")
    q.paste(em, (cx - em.width // 2, cy - em.height // 2), em)
    # картка для друку
    W = 2000; m = 160; qs = W - 2 * m
    q = q.resize((qs, qs), Image.NEAREST)
    H = m + 260 + qs + 420
    c = Image.new("RGB", (W, H), CREAM); dc = ImageDraw.Draw(c)
    f1 = ImageFont.truetype(FONT, 110); f2 = ImageFont.truetype(FONT_S, 58); f3 = ImageFont.truetype(FONT_S, 52)
    def center(y, text, font, fill):
        w = dc.textlength(text, font=font); dc.text(((W - w) / 2, y), text, font=font, fill=fill)
    center(m, "Метаморфоза", f1, GREEN)
    center(m + 140, "психологічний центр", f2, GOLD)
    y = m + 260
    dc.rounded_rectangle([m - 40, y - 40, m + qs + 40, y + qs + 40], radius=60, fill="white")
    c.paste(q, (m, y))
    y += qs + 90
    center(y, title, ImageFont.truetype(FONT, 92), GREEN)
    center(y + 130, subtitle, f3, (107, 90, 80))
    center(y + 220, url.replace("https://", ""), f3, GOLD)
    c.save(out + ".png", dpi=(300, 300))
    qr.save(out + ".svg", scale=10, border=4, dark="#133512")
    print(out, url)

card("/zapys", "Записатися до психолога", "Наведіть камеру телефона на код", "QR-запис-до-психолога")
card("/podii", "Зареєструватися на подію", "Наведіть камеру телефона на код", "QR-запис-на-подію")
