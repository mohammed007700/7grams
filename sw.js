/* 7 GRAMS: يحفظ ملفات التطبيق ليفتح بسرعة. البيانات نفسها تأتي دائماً من قاعدة البيانات. */
const CACHE = "7grams-v24";
const SHELL = ["./", "index.html", "firebase-config.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  /* network first so a new version shows as soon as it is uploaded; cache only when offline */
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
/* phone notifications (sent by the scheduled job through Firebase Cloud Messaging) */
self.addEventListener("push", e => {
  let p = {}; try { p = e.data ? e.data.json() : {}; } catch (x) { p = { notification: { title: "7 GRAMS", body: e.data ? e.data.text() : "" } }; }
  const n = p.notification || {}, d = p.data || {};
  const title = d.title || n.title || "7 GRAMS", body = d.body || n.body || "";
  e.waitUntil(self.registration.showNotification(title, { body, icon: "icon-192.png", badge: "icon-192.png", tag: d.tag || undefined, data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => { for (const c of cs) if ("focus" in c) return c.focus(); return clients.openWindow((e.notification.data && e.notification.data.url) || "./"); }));
});
