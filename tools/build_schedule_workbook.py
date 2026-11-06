import datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.utils import get_column_letter as L

OUT = "Метаморфоза — облік і розклад.xlsx"
SPECS = ["Анастасія Дорошенко", "Ольга Ситніченко", "Анастасія", "Наталія Горбулевич", "Олександра Байлова", "Яна", "Іванна Ромашко"]
# ціни консультацій (грн); діагностична рахується формулою зі знижкою
PRICES = {"Анастасія Дорошенко": (1300, 1500, 1200), "Ольга Ситніченко": (1800, None, None),
          "Анастасія": (1300, None, None), "Наталія Горбулевич": (1200, None, None), "Олександра Байлова": (1200, None, None), "Яна": (1500, None, None), "Іванна Ромашко": (900, None, None)}
SERVICES = ["Консультація", "Діагностична сесія", "Парна / сімейна сесія", "МАК-сесія"]
STATUSES = ["вільно", "заброньовано", "проведено", "скасовано"]
PAYMENTS = ["не оплачено", "готівка", "картка", "онлайн (IBAN)"]
FORMATS = ["Офлайн", "Онлайн"]
TIMES = [f"{h:02d}:{m:02d}" for h in range(8, 22) for m in (0, 30)]
ROWS = 150  # рядків для записів на кожного фахівця

GREEN, GOLD = "133512", "C9A034"
F = "Arial"
hfill = PatternFill("solid", fgColor=GREEN)
hfont = Font(name=F, bold=True, color="FFFFFF")
base = Font(name=F)
thin = Side(style="thin", color="D9D9D9")

wb = Workbook()
wb._named_styles["Normal"].font = Font(name=F, size=10)

# ---------- Як користуватися
ws = wb.active; ws.title = "Як користуватися"
lines = [
    ("Облік і розклад «Метаморфози»", True),
    ("", False),
    ("Кожен фахівець веде свою вкладку. Один рядок — одне вікно або одна сесія.", False),
    ("1. Дата — двічі клацніть по клітинці, відкриється календар.", False),
    ("2. Час і Статус — оберіть зі списку.", False),
    ("   вільно — вікно показується на сайті як вільне", False),
    ("   заброньовано — клієнт записався (на сайті вікно стає зайнятим)", False),
    ("   проведено — сесія відбулась (рахується в «Підсумок»)", False),
    ("   скасовано — на сайті не показується", False),
    ("3. Клієнт, Контакт, Послуга, Формат, Оплата, Нотатки — для обліку. На сайт НЕ потрапляють.", False),
    ("4. Ціна підставляється сама з вкладки «Ціни» за обраною послугою.", False),
    ("", False),
    ("Вкладка «Тиждень» — календар усіх фахівців: вкажіть понеділок у клітинці B1.", False),
    ("Вкладка «Підсумок» — кількість сесій і оплати за місяць: вкажіть місяць у клітинці B1.", False),
    ("", False),
    ("Вкладка «Для сайту» збирає з усіх вкладок лише фахівця, дату, час і статус — її бачить сайт.", False),
    ("Публікуйте в інтернеті ТІЛЬКИ вкладку «Для сайту» (Файл → Поділитися → Опублікувати в Інтернеті).", False),
    ("Сам файл нікому, крім команди, не відкривайте — тут дані клієнтів.", False),
    ("Стовпці «День» і «Ціна» заповнюються самі — не друкуйте в них.", False),
    ("", False),
    ("Приклад рядка:", True),
]
for i, (t, b) in enumerate(lines, 1):
    c = ws.cell(i, 1, t); c.font = Font(name=F, bold=b, size=14 if i == 1 else 11, color=GREEN if b else "000000")
hdr = ["Дата", "День", "Час", "Статус", "Клієнт", "Контакт", "Послуга", "Формат", "Ціна, грн", "Оплата", "Нотатки"]
ex = ["03.11.2026", "Вт", "10:00", "заброньовано", "Ірина", "@iryna", "Діагностична сесія", "Офлайн", 1440, "онлайн (IBAN)", "перша зустріч"]
r0 = len(lines) + 1
for j, (h, v) in enumerate(zip(hdr, ex), 1):
    a = ws.cell(r0, j, h); a.fill = hfill; a.font = hfont
    ws.cell(r0 + 1, j, v).font = base
ws.column_dimensions["A"].width = 14
for j in range(2, 12): ws.column_dimensions[L(j)].width = 16

# ---------- Ціни
wp = wb.create_sheet("Ціни")
wp.append(["Фахівець"] + SERVICES)
wp.append([])
for c in wp[1]: c.fill = hfill; c.font = hfont
for i, sp in enumerate(SPECS, 2):
    cons, pair, mak = PRICES[sp]
    wp.cell(i, 1, sp); wp.cell(i, 2, cons)
    wp.cell(i, 3, f"=IF(B{i}=\"\",\"\",ROUND(B{i}*(1-$B$11),0))")
    if pair: wp.cell(i, 4, pair)
    if mak: wp.cell(i, 5, mak)
wp.cell(10, 1, "Налаштування").font = Font(name=F, bold=True, color=GREEN)
wp.cell(11, 1, "Знижка на діагностичну сесію"); wp.cell(11, 2, 0.2).number_format = "0%"
wp.cell(12, 1, "Джерело цін: дані власниці центру, жовтень 2026").font = Font(name=F, italic=True, color="808080")
wp.column_dimensions["A"].width = 30
for j in range(2, 6): wp.column_dimensions[L(j)].width = 22
for row in wp.iter_rows(min_row=2, max_row=8, min_col=2, max_col=5):
    for c in row: c.number_format = '#,##0" грн"'
for c in (wp["B2"], wp["B3"], wp["B4"], wp["B5"], wp["B6"], wp["B7"], wp["B8"], wp["D2"], wp["E2"], wp["B11"]):
    c.fill = PatternFill("solid", fgColor="FFF4D6")
wp.cell(14, 1, "Жовті клітинки — ціни, які можна змінювати. Діагностична сесія рахується автоматично.").font = Font(name=F, italic=True, color="808080")

# ---------- вкладки фахівців
dv_lists = {}
def list_dv(items):
    return DataValidation(type="list", formula1='"' + ",".join(items) + '"', allow_blank=True, showDropDown=False)

for idx, sp in enumerate(SPECS, 2):
    s = wb.create_sheet(sp)
    s.append(hdr)
    for c in s[1]:
        c.fill = hfill; c.font = hfont; c.alignment = Alignment(horizontal="center", vertical="center")
    s.row_dimensions[1].height = 24
    s.freeze_panes = "A2"
    # одна формула на весь стовпець (Google Sheets ARRAYFORMULA) — не друкуйте в стовпцях «День» і «Ціна»
    s["B2"] = '=ARRAYFORMULA(IF(A2:A="","",CHOOSE(WEEKDAY(A2:A,2),"Пн","Вт","Ср","Чт","Пт","Сб","Нд")))'
    s["I2"] = f'=ARRAYFORMULA(IF(G2:G="","",IFERROR(HLOOKUP(G2:G,Ціни!$B$1:$E$8,{idx},FALSE),"")))'
    s.column_dimensions["A"].number_format = "DD.MM.YYYY"
    s.column_dimensions["C"].number_format = "@"
    s.column_dimensions["I"].number_format = '#,##0" грн"'
    for col in "BI": s[f"{col}1"].fill = PatternFill("solid", fgColor="2E5A2B")
    rng = lambda col: f"{col}2:{col}{ROWS+1}"
    dvd = DataValidation(type="date", operator="greaterThan", formula1="DATE(2025,1,1)", allow_blank=True)
    dvd.error = "Оберіть дату з календаря"; dvd.errorTitle = "Дата"
    for dv, col in ((dvd, "A"), (list_dv(TIMES), "C"), (list_dv(STATUSES), "D"), (list_dv(SERVICES), "G"),
                    (list_dv(FORMATS), "H"), (list_dv(PAYMENTS), "J")):
        s.add_data_validation(dv); dv.add(rng(col))
    full = f"A2:K{ROWS+1}"
    for val, color in (("вільно", "D9EAD3"), ("заброньовано", "FFF2CC"), ("проведено", "CFE2F3"), ("скасовано", "F4CCCC")):
        s.conditional_formatting.add(full, FormulaRule(formula=[f'$D2="{val}"'], fill=PatternFill("solid", fgColor=color, bgColor=color)))
    widths = [13, 7, 9, 15, 20, 20, 22, 11, 12, 15, 30]
    for j, w in enumerate(widths, 1): s.column_dimensions[L(j)].width = w

# ---------- Тиждень (календар)
wk = wb.create_sheet("Тиждень", 1)
wk["A1"] = "Тиждень з (понеділок):"; wk["A1"].font = Font(name=F, bold=True)
wk["B1"] = dt.date(2026, 11, 2); wk["B1"].number_format = "DD.MM.YYYY"; wk["B1"].fill = PatternFill("solid", fgColor="FFF4D6")
dvw = DataValidation(type="date", operator="greaterThan", formula1="DATE(2025,1,1)", allow_blank=False); wk.add_data_validation(dvw); dvw.add("B1")
wk["D1"] = "У клітинках — вільні вікна (✓) і записи (●) кожного фахівця"; wk["D1"].font = Font(name=F, italic=True, color="808080")
wk.cell(3, 1, "Фахівець").fill = hfill; wk.cell(3, 1).font = hfont
days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]
for j in range(7):
    c = wk.cell(3, j + 2, f'="{days[j]} "&TEXT($B$1+{j},"DD.MM")'); c.fill = hfill; c.font = hfont; c.alignment = Alignment(horizontal="center")
for i, sp in enumerate(SPECS, 4):
    wk.cell(i, 1, sp).font = Font(name=F, bold=True)
    q = f"'{sp}'"
    for j in range(7):
        col = L(j + 2)
        f_free = f'IFERROR("✓ "&TEXTJOIN(", ",TRUE,SORT(FILTER({q}!$C$2:$C,{q}!$A$2:$A=$B$1+{j},{q}!$D$2:$D="вільно"))),"")'
        f_busy = f'IFERROR("● "&TEXTJOIN(", ",TRUE,SORT(FILTER({q}!$C$2:$C,{q}!$A$2:$A=$B$1+{j},({q}!$D$2:$D="заброньовано")+({q}!$D$2:$D="проведено")))),"")'
        c = wk.cell(i, j + 2, f'=TRIM({f_free}&CHAR(10)&{f_busy})')
        c.alignment = Alignment(wrap_text=True, vertical="top"); c.font = base
        c.border = Border(left=thin, right=thin, top=thin, bottom=thin)
    wk.row_dimensions[i].height = 60
wk.column_dimensions["A"].width = 24
for j in range(2, 9): wk.column_dimensions[L(j)].width = 20
wk.freeze_panes = "B4"

# ---------- Підсумок
sm = wb.create_sheet("Підсумок", 2)
sm["A1"] = "Місяць (перше число):"; sm["A1"].font = Font(name=F, bold=True)
sm["B1"] = dt.date(2026, 11, 1); sm["B1"].number_format = "MMMM YYYY"; sm["B1"].fill = PatternFill("solid", fgColor="FFF4D6")
dvm = DataValidation(type="date", operator="greaterThan", formula1="DATE(2025,1,1)", allow_blank=False); sm.add_data_validation(dvm); dvm.add("B1")
heads = ["Фахівець", "Вільних вікон", "Заброньовано", "Проведено сесій", "Скасовано", "Сума проведених, грн", "Оплачено, грн", "Не оплачено, грн"]
for j, h in enumerate(heads, 1):
    c = sm.cell(3, j, h); c.fill = hfill; c.font = hfont; c.alignment = Alignment(horizontal="center", wrap_text=True)
for i, sp in enumerate(SPECS, 4):
    q = f"'{sp}'"
    period = f'{q}!$A:$A,">="&$B$1,{q}!$A:$A,"<"&EDATE($B$1,1)'
    sm.cell(i, 1, sp).font = Font(name=F, bold=True)
    for j, st in ((2, "вільно"), (3, "заброньовано"), (4, "проведено"), (5, "скасовано")):
        sm.cell(i, j, f'=COUNTIFS({q}!$D:$D,"{st}",{period})')
    sm.cell(i, 6, f'=SUMIFS({q}!$I:$I,{q}!$D:$D,"проведено",{period})')
    sm.cell(i, 7, f'=SUMIFS({q}!$I:$I,{q}!$D:$D,"проведено",{q}!$J:$J,"<>не оплачено",{q}!$J:$J,"<>",{period})')
    sm.cell(i, 8, f"=F{i}-G{i}")
last = 3 + len(SPECS)
t = last + 1
sm.cell(t, 1, "Разом").font = Font(name=F, bold=True)
for j in range(2, 9):
    c = sm.cell(t, j, f"=SUM({L(j)}4:{L(j)}{last})"); c.font = Font(name=F, bold=True)
for r in range(4, t + 1):
    for j in (6, 7, 8): sm.cell(r, j).number_format = '#,##0" грн"'
sm.column_dimensions["A"].width = 24
for j in range(2, 9): sm.column_dimensions[L(j)].width = 16
sm.row_dimensions[3].height = 32

# ---------- Для сайту (публікується в інтернеті; лише дата, час і статус)
ws_site = wb.create_sheet("Для сайту")
for k, sp in enumerate(SPECS):
    c0 = k * 5 + 1
    q = f"'{sp}'"
    for j, h in enumerate(["Фахівець", "Дата", "Час", "Статус"]):
        c = ws_site.cell(1, c0 + j, h); c.fill = hfill; c.font = hfont
    A, Cc, D = (f"{q}!A2:A", f"{q}!C2:C", f"{q}!D2:D")
    ws_site.cell(2, c0, f'=ARRAYFORMULA(IF({A}="","","{sp}"))')
    ws_site.cell(2, c0 + 1, f'=ARRAYFORMULA(IF({A}="","",TEXT({A},"yyyy-mm-dd")))')
    ws_site.cell(2, c0 + 2, f'=ARRAYFORMULA(IF({A}="","",{Cc}))')
    ws_site.cell(2, c0 + 3, f'=ARRAYFORMULA(IF({A}="","",{D}))')
    for j, w in enumerate([22, 12, 8, 14]): ws_site.column_dimensions[L(c0 + j)].width = w
    ws_site.column_dimensions[L(c0 + 4)].width = 3
ws_site.freeze_panes = "A2"

wb.save(OUT); print(OUT)
