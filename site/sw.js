/* מי בבית — service worker
   מטרה: שהאפליקציה תיפתח מהר ותעבוד גם כשהאינטרנט נופל לרגע.
   - קבצי האתר: קודם מהרשת (כדי לקבל עדכונים מיד), ואם אין רשת — מהעותק השמור.
   - ספריית הזיהוי והמודלים (כתובות עם מספר גרסה, לא משתנות): קודם מהעותק השמור.
   - כל השאר (התראות ntfy, webhook) לא עובר דרך כאן.
   שום מידע אישי לא נשמר כאן — רק קבצי האפליקציה. */
const V = 'mibabayit-v14';
const CDN = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/@vladmandic\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const same = new URL(req.url).origin === self.location.origin;
  if (!same && !CDN.test(req.url)) return;
  if (same) {
    e.respondWith(fetch(req).then((res) => { if (res.ok) { const c = res.clone(); caches.open(V).then((ch) => ch.put(req, c)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./'))));
  } else {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === 'opaque') { const c = res.clone(); caches.open(V).then((ch) => ch.put(req, c)); } return res; })));
  }
});
