// Generated from server/ by scripts/build-api.mjs. Do not edit.

// server/lib.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import webpush from "web-push";

// src/lib/i18n.ts
var num = new Intl.NumberFormat("he-IL");
var date = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
var shortDate = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit" });
var longDateFmt = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long" });

// server/lib.ts
function admin() {
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  return { db: getFirestore() };
}
async function userFromToken(idToken) {
  if (!idToken) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.VITE_FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.users?.[0]?.localId ?? null;
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
      else console.error("push failed", code, e.body?.slice(0, 200));
    }
  }
  return sent;
}

// server/push-test.ts
async function handler(req, res) {
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  };
  if (req.method !== "POST") return send(405, { error: "POST only" });
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  const uid = await userFromToken(token);
  if (!uid) return send(401, { error: "not signed in" });
  const { db } = admin();
  const sent = await sendTo(db, uid, { title: "CarBoard", body: "\u05D4\u05D4\u05EA\u05E8\u05D0\u05D5\u05EA \u05E4\u05D5\u05E2\u05DC\u05D5\u05EA. \u05E0\u05D6\u05DB\u05D9\u05E8 \u05DC\u05DA \u05DC\u05E4\u05E0\u05D9 \u05DB\u05DC \u05DE\u05D5\u05E2\u05D3.", tag: "test", url: "/" });
  send(200, { sent });
}
export {
  handler as default
};
