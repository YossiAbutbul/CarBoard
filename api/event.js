// Generated from server/ by scripts/build-api.mjs. Do not edit.

// src/lib/schedule.ts
var LIMITS = { title: 120, details: 800, location: 120 };
function cleanAppointment(a) {
  const str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
  const date = str(a.date, 10);
  const time = str(a.time, 5);
  const minutes = Number(a.minutes) || 60;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || minutes < 5 || minutes > 600) return null;
  return { title: str(a.title, LIMITS.title) || "CarBoard", details: str(a.details, LIMITS.details), location: str(a.location, LIMITS.location), date, time, minutes };
}
var pad = (n) => String(n).padStart(2, "0");
function stamps(a) {
  const [y, m, d] = a.date.split("-").map(Number);
  const [h, min] = a.time.split(":").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, h, min));
  const end = new Date(start.getTime() + a.minutes * 6e4);
  const fmt = (t) => `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`;
  return [fmt(start), fmt(end)];
}
var esc = (s) => s.replace(/[\\;,]/g, (m) => "\\" + m).replace(/\r?\n/g, "\\n");
function fold(line) {
  const out = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > 73) {
      out.push(cur);
      cur = " ";
      bytes = 1;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n");
}
function eventIcs(a, uid) {
  const [start, end] = stamps(a);
  const now = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CarBoard//he",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@carboard`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(a.title)}`,
    a.details && `DESCRIPTION:${esc(a.details)}`,
    a.location && `LOCATION:${esc(a.location)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT1H",
    `DESCRIPTION:${esc(a.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean).map((l) => fold(l)).join("\r\n");
}

// server/event.ts
function handler(req, res) {
  const q = new URL(req.url ?? "", "http://x").searchParams;
  const a = cleanAppointment(Object.fromEntries(q));
  if (!a) {
    res.statusCode = 400;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    return res.end("bad appointment");
  }
  const uid = `${a.date}-${a.time.replace(":", "")}-${Math.random().toString(36).slice(2, 8)}`;
  res.statusCode = 200;
  res.setHeader("content-type", "text/calendar; charset=utf-8");
  res.setHeader("content-disposition", 'inline; filename="carboard.ics"');
  res.setHeader("cache-control", "no-store");
  res.end(eventIcs(a, uid));
}
export {
  handler as default
};
