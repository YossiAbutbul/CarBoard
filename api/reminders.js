// Generated from server/ by scripts/build-api.mjs. Do not edit.

// server/lib.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import webpush from "web-push";

// src/lib/dates.ts
var DAY = 864e5;
var toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
var todayIso = () => toIso(/* @__PURE__ */ new Date());
var parseIso = (iso) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
var diffDays = (a, b) => Math.round((parseIso(a).getTime() - parseIso(b).getTime()) / DAY);
var addDays = (iso, n) => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
};

// src/domain/due.ts
function dueInfo(it, km, today = todayIso()) {
  const daysByDate = it.due_date ? diffDays(it.due_date, today) : null;
  const kmLeft = it.due_km != null ? it.due_km - km.value : null;
  const daysByKm = kmLeft != null ? Math.floor(kmLeft / Math.max(km.perDay, 1)) : null;
  if (daysByDate == null && daysByKm == null)
    return { status: "unset", days: null, kmLeft: null, by: null, dueOn: null, progress: 0 };
  const by = daysByDate == null ? "km" : daysByKm == null ? "date" : daysByKm < daysByDate ? "km" : "date";
  const days = by === "km" ? daysByKm : daysByDate;
  const dueOn = by === "date" ? it.due_date : addDays(today, days);
  let status = "ok";
  if (days < 0 || kmLeft != null && kmLeft < 0) status = "overdue";
  else if (days <= 7 || kmLeft != null && kmLeft <= 200) status = "due";
  else if (days <= 30 || kmLeft != null && kmLeft <= 1e3) status = "soon";
  let progress = 0;
  if (by === "km" && it.every_km && kmLeft != null) progress = 1 - kmLeft / it.every_km;
  else if (it.every_months && daysByDate != null) progress = 1 - daysByDate / (it.every_months * 30.4);
  else progress = status === "ok" ? 0.3 : status === "soon" ? 0.8 : 1;
  return { status, days, kmLeft, by, dueOn, progress: Math.max(0, Math.min(1, progress)) };
}

// src/domain/odometer.ts
var DEFAULT_KM_PER_DAY = 40;
var sortReadings = (rs) => [...rs].sort((a, b) => a.date === b.date ? a.km - b.km : a.date < b.date ? -1 : 1);
function kmPerDay(rs) {
  const sorted = sortReadings(rs);
  if (sorted.length < 2) return null;
  const last = sorted[sorted.length - 1];
  let window = sorted.filter((r) => diffDays(last.date, r.date) <= 90);
  if (window.length < 2) window = sorted.slice(-2);
  const first = window[0];
  const days = diffDays(last.date, first.date);
  if (days < 3) return null;
  return Math.max(0, (last.km - first.km) / days);
}
function estimateKm(rs, today = todayIso()) {
  const sorted = sortReadings(rs);
  const last = sorted[sorted.length - 1] ?? null;
  if (!last) return { value: 0, perDay: DEFAULT_KM_PER_DAY, learned: false, checkedDaysAgo: null, last: null };
  const learnedRate = kmPerDay(sorted);
  const perDay = learnedRate ?? DEFAULT_KM_PER_DAY;
  const days = Math.max(0, diffDays(today, last.date));
  return {
    value: Math.round(last.km + perDay * days),
    perDay,
    learned: learnedRate !== null,
    checkedDaysAgo: days,
    last
  };
}

// src/lib/i18n.ts
var num = new Intl.NumberFormat("he-IL");
var date = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
var shortDate = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit" });
var fmtNum = (n) => num.format(Math.round(n));
var fmtDate = (iso) => date.format(parseIso(iso));
function fmtDays(n) {
  const a = Math.abs(n);
  if (a === 0) return "\u05D4\u05D9\u05D5\u05DD";
  if (a === 1) return "\u05D9\u05D5\u05DD \u05D0\u05D7\u05D3";
  if (a === 2) return "\u05D9\u05D5\u05DE\u05D9\u05D9\u05DD";
  if (a < 60) return `${a} \u05D9\u05DE\u05D9\u05DD`;
  const months = Math.round(a / 30.4);
  return months < 24 ? `${months} \u05D7\u05D5\u05D3\u05E9\u05D9\u05DD` : `${Math.round(a / 365)} \u05E9\u05E0\u05D9\u05DD`;
}
var longDateFmt = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" });

// src/domain/notify.ts
var targetKey = (it) => `${it.id}:${it.due_km ?? ""}:${it.due_date ?? ""}`;
function stepFor(days) {
  if (days < 0) return "late";
  if (days === 0) return "d0";
  if (days <= 1) return "d1";
  if (days <= 7) return "d7";
  if (days <= 14) return "d14";
  return null;
}
function notesFor(car, items, readings, sent, today = todayIso()) {
  const km = estimateKm(readings.filter((r) => r.car_id === car.id), today);
  const notes = [];
  for (const it of items.filter((i) => i.car_id === car.id)) {
    const d = dueInfo(it, km, today);
    if (d.status === "unset" || d.days == null) continue;
    const step = stepFor(d.days);
    if (!step) continue;
    const key = targetKey(it);
    const done = sent[key] ?? [];
    const order = ["d14", "d7", "d1", "d0", "late"];
    if (done.some((s) => order.indexOf(s) >= order.indexOf(step))) continue;
    const when = step === "late" ? "\u05E2\u05D1\u05E8 \u05D4\u05DE\u05D5\u05E2\u05D3. \u05DB\u05D3\u05D0\u05D9 \u05DC\u05D8\u05E4\u05DC \u05D1\u05D4\u05E7\u05D3\u05DD." : d.by === "km" && d.kmLeft != null ? `\u05E0\u05E9\u05D0\u05E8\u05D5 ${fmtNum(d.kmLeft)} \u05E7\u05F4\u05DE (\u05D1\u05E2\u05E8\u05DA ${fmtDays(d.days)})` : step === "d0" ? `\u05D4\u05D9\u05D5\u05DD${it.due_date ? `, ${fmtDate(it.due_date)}` : ""}` : `\u05D1\u05E2\u05D5\u05D3 ${fmtDays(d.days)}${it.due_date ? `, ${fmtDate(it.due_date)}` : ""}`;
    notes.push({ key, step, title: `${it.label} \xB7 ${car.name}`, body: when, tag: `${car.id}:${it.id}` });
  }
  return notes;
}

// server/lib.ts
function admin() {
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return { db: getFirestore(), auth: getAuth() };
}
var vapidSet = false;
function vapid() {
  if (vapidSet) return;
  webpush.setVapidDetails("https://carboard-teal.vercel.app", process.env.VITE_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  vapidSet = true;
}
async function sendTo(db, uid, payload) {
  vapid();
  const subs = await db.collection(`users/${uid}/push`).get();
  let sent = 0;
  for (const s of subs.docs) {
    const { endpoint, keys } = s.data();
    try {
      await webpush.sendNotification({ endpoint, keys }, JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: "normal" });
      sent++;
    } catch (e) {
      const code = e.statusCode;
      if (code === 404 || code === 410) await s.ref.delete();
    }
  }
  return sent;
}
var todayInIsrael = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(/* @__PURE__ */ new Date());
async function remindUser(db, uid, today) {
  const [cars, items, readings, mark] = await Promise.all([
    db.collection(`users/${uid}/cars`).get(),
    db.collection(`users/${uid}/items`).get(),
    db.collection(`users/${uid}/readings`).get(),
    db.doc(`users/${uid}/meta/notified`).get()
  ]);
  const sent = mark.data()?.sent ?? {};
  const all = {
    items: items.docs.map((d) => d.data()),
    readings: readings.docs.map((d) => d.data())
  };
  let count = 0;
  for (const c of cars.docs) {
    for (const n of notesFor(c.data(), all.items, all.readings, sent, today)) {
      if (await sendTo(db, uid, { title: n.title, body: n.body, tag: n.tag, url: "/" }) > 0) count++;
      sent[n.key] = [...sent[n.key] ?? [], n.step];
    }
  }
  await db.doc(`users/${uid}/meta/notified`).set({ sent, at: Date.now() });
  return count;
}

// server/reminders.ts
async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401;
    return res.end("unauthorized");
  }
  const { db } = admin();
  const today = todayInIsrael();
  const subs = await db.collectionGroup("push").get();
  const users = [...new Set(subs.docs.map((d) => d.ref.parent.parent.id))];
  let notes = 0;
  for (const uid of users) {
    try {
      notes += await remindUser(db, uid, today);
    } catch (e) {
      console.error("remind", uid, e);
    }
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ today, users: users.length, notes }));
}
export {
  handler as default
};
