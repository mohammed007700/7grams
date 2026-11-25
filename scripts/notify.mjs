// 7 GRAMS notifications: runs on GitHub Actions (see .github/workflows/notify.yml)
import admin from "firebase-admin";

const OWNER = "osopp2016@gmail.com";
const APP = "https://mohammed007700.github.io/7grams/";
if (!process.env.FIREBASE_SA) { console.log("FIREBASE_SA secret is not set yet; nothing to do."); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = admin.firestore(), fcm = admin.messaging();

const sched = process.env.SCHEDULE || "";
const mode = sched === "0 3 * * *" ? "remind-m" : sched === "0 15 * * *" ? "remind-n" : (process.env.MODE || "events");
const pick = (v, lang) => Array.isArray(v) ? (lang === "en" ? v[0] : v[1]) || v[0] || "" : String(v || "");

const members = {}; (await db.collection("members").get()).docs.forEach(d => { members[d.id] = d.data(); });
const isAdminEmail = e => e === OWNER || (members[e] && members[e].role === "admin");
const tokens = (await db.collection("push").get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.token);

async function send(t, title, body) {
  try {
    await fcm.send({ token: t.token, webpush: { headers: { Urgency: "high" }, notification: { title, body, icon: APP + "icon-192.png" }, fcmOptions: { link: APP } } });
    return true;
  } catch (e) {
    const c = (e && e.code) || "";
    if (/not-registered|invalid-registration|invalid-argument/.test(c)) await db.doc("push/" + t.id).delete().catch(() => {});
    console.log("send failed", t.email, c); return false;
  }
}

if (mode === "events") {
  const snap = await db.collection("notify").where("sent", "==", false).limit(300).get();
  const evs = snap.docs.map(d => ({ ref: d.ref, ...d.data() })).sort((a, b) => (a.at || 0) - (b.at || 0));
  if (evs.length) {
    const admins = tokens.filter(t => isAdminEmail(String(t.email || "").toLowerCase()));
    for (const t of admins) {
      const L = t.lang === "en" ? "en" : "ar";
      if (evs.length <= 6) {
        for (const n of evs) await send(t, `${pick(n.title, L)} · ${n.branch || ""}`, `${n.name || n.email}: ${pick(n.body, L)}`);
      } else {
        const lines = evs.slice(-5).map(n => `${n.branch || ""} · ${n.name || n.email}: ${pick(n.title, L)}`).join("\n");
        await send(t, L === "en" ? `${evs.length} new staff updates` : `${evs.length} تحديث جديد من الموظفين`, lines);
      }
    }
    const b = db.batch(); evs.forEach(n => b.update(n.ref, { sent: true })); await b.commit();
  }
  // keep the collection small: drop sent events older than 14 days
  const old = await db.collection("notify").where("at", "<", Date.now() - 14 * 864e5).limit(300).get();
  if (!old.empty) { const b = db.batch(); old.docs.forEach(d => b.delete(d.ref)); await b.commit(); }
  console.log("events sent:", evs.length);
} else {
  const morning = mode === "remind-m";
  const staff = tokens.filter(t => !isAdminEmail(String(t.email || "").toLowerCase()));
  let n = 0;
  for (const t of staff) {
    const en = t.lang === "en";
    const title = en ? (morning ? "Morning shift tasks" : "Night shift tasks") : (morning ? "مهام شفت الصباح" : "مهام شفت الليل");
    const body = en ? `Time to do today's ${morning ? "morning" : "night"} tasks and close the daily inventory.` : `حان وقت مهام ${morning ? "شفت الصباح" : "شفت الليل"} اليوم وقفل الجرد اليومي.`;
    if (await send(t, title, body)) n++;
  }
  console.log(mode, "reminders sent:", n);
}
