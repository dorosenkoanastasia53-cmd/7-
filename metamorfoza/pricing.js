// Приміщення, тарифи, знижки та правила простору «Метаморфоза».
// Щоб змінити ціни, години роботи чи свята — редагуйте об'єкт CONFIG нижче.
(function (root) {
  "use strict";

  var CONFIG = {
    tz: "Europe/Kyiv",
    openHour: 8, // перша година, яку можна забронювати (08:00)
    closeHour: 22, // простір зачиняється о 22:00 (останній слот 21:00–22:00)
    eveningFrom: 18, // з 18:00 діє вечірній тариф
    maxDaysAhead: 60, // на скільки днів уперед можна обрати дату у формі
    weeklyWeeks: 4, // «постійний час» — 4 тижні, оплата за місяць наперед

    rooms: {
      small: {
        id: "small",
        name: "Малий кабінет",
        area: "8,5 м²",
        capacity: 2,
        purpose: "Для індивідуальних консультацій",
        furniture: "2 зручних крісла, журнальний столик",
        day: 150,
        evening: 200,
        minHours: 1,
      },
      big: {
        id: "big",
        name: "Великий кабінет",
        area: "18 м²",
        capacity: 4,
        purpose: "Для індивідуальних, парних і сімейних сесій",
        furniture: "Диван, 2 крісла, журнальний столик",
        day: 200,
        evening: 250,
        minHours: 1,
      },
      hall: {
        id: "hall",
        name: "Зала",
        area: "27 м²",
        capacity: 10,
        purpose: "Для груп, тренінгів, івентів. Також для сімейних та індивідуальних сесій",
        furniture: "Великий стіл, мольберти",
        day: 700,
        evening: 900,
        minHours: 2,
        hasProjector: true,
        projector: 0, // доплата за проектор, грн/год (0 — входить у вартість)
      },
    },

    // Святкові дні (діє тариф «після 18:00» на весь день). Редагуйте за потреби.
    holidays: [
      "2026-01-01", "2026-01-07", "2026-03-08", "2026-04-12", "2026-04-13",
      "2026-05-01", "2026-05-08", "2026-05-31", "2026-06-01", "2026-06-28",
      "2026-07-15", "2026-08-24", "2026-10-01", "2026-12-25",
      "2027-01-01", "2027-03-08", "2027-05-01", "2027-05-02", "2027-05-03",
      "2027-05-08", "2027-06-20", "2027-06-21", "2027-06-28", "2027-07-15",
      "2027-08-24", "2027-10-01", "2027-12-25",
    ],
  };

  // ---------- дати ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 ? d : null;
  }

  function fmtDate(d) {
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }

  function addDays(s, n) {
    var d = parseDate(s);
    d.setUTCDate(d.getUTCDate() + n);
    return fmtDate(d);
  }

  function weekday(s) { return parseDate(s).getUTCDay(); } // 0 = неділя

  // Поточні дата й година за київським часом.
  function kyivNow(now) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: CONFIG.tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", hour12: false,
    }).formatToParts(now || new Date());
    var p = {};
    parts.forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + "-" + p.month + "-" + p.day, hour: +p.hour % 24 };
  }

  // ---------- тарифи ----------
  function isHoliday(date) { return CONFIG.holidays.indexOf(date) !== -1; }

  function isEvening(date, hour) {
    var wd = weekday(date);
    return wd === 0 || wd === 6 || isHoliday(date) || hour >= CONFIG.eveningFrom;
  }

  function rate(room, date, hour) {
    return isEvening(date, hour) ? room.evening : room.day;
  }

  // Орієнтовна вартість одного бронювання.
  // input: {room, date, start, hours, weekly, projector}
  // Знижки не сумуються — береться найбільша:
  //   4+ год за день −20%, 8+ год −25%, постійний час (4 тижні) −15%, 10+ год разом −10%.
  function quote(input) {
    var room = CONFIG.rooms[input.room];
    var weeks = input.weekly ? CONFIG.weeklyWeeks : 1;
    var hours = input.hours;
    var perDay = 0;
    for (var i = 0; i < hours; i++) perDay += rate(room, input.date, input.start + i);
    var base = perDay * weeks;
    var totalHours = hours * weeks;
    var dayPct = hours >= 8 ? 25 : hours >= 4 ? 20 : 0;
    var orderPct = input.weekly ? 15 : totalHours >= 10 ? 10 : 0;
    var pct = Math.max(dayPct, orderPct);
    var label = pct === 0 ? "" : pct === dayPct ? (hours >= 8 ? "повний день" : "пів дня") :
      (input.weekly ? "постійний час" : "пакет 10 годин");
    var rent = Math.round(base * (100 - pct) / 100);
    var proj = input.projector && room.hasProjector ? (room.projector || 0) * totalHours : 0;
    return {
      base: base + proj, total: rent + proj, saved: base - rent,
      discountPct: pct, discountLabel: label, hours: totalHours, weeks: weeks,
    };
  }

  var MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
  var WEEKDAYS = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];

  function humanDate(s) {
    var d = parseDate(s);
    return WEEKDAYS[d.getUTCDay()] + ", " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
  }

  function money(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " грн";
  }

  var api = {
    CONFIG: CONFIG, pad: pad, parseDate: parseDate, fmtDate: fmtDate, addDays: addDays,
    weekday: weekday, kyivNow: kyivNow, isHoliday: isHoliday, isEvening: isEvening, rate: rate,
    quote: quote, humanDate: humanDate, money: money, MONTHS: MONTHS, WEEKDAYS: WEEKDAYS,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Space = api;
})(this);
