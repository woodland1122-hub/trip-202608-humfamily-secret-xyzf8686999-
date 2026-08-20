/* GRAND CRUISE 2026 しおり — オフライン用サービスワーカー
   方針:
     - しおり本体（HTML）は「ネット優先・ダメならキャッシュ」。更新が必ず届く。
     - 写真は「キャッシュにあれば即返す・なければ普通に取りに行く」。裏での二重取得はしない。
     - 天気（Open-Meteo）は一切さわらない。 */
const CACHE = 'gc2026-v44';
const CORE = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.hostname.indexOf('api.open-meteo.com') >= 0) return;

  const isDoc = req.mode === 'navigate' || req.destination === 'document';
  if (isDoc) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req))
  );
});

/* 「この端末にまるごと保存する」から送られてくるURLを先読みしてキャッシュする */
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type !== 'PRECACHE' || !Array.isArray(d.urls)) return;
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.all(
      d.urls.map(u => fetch(u, { mode: 'no-cors' }).then(r => c.put(u, r)).catch(() => {}))
    )).then(() => {
      self.clients.matchAll().then(cs => cs.forEach(cl => cl.postMessage({ type: 'PRECACHE_DONE' })));
    })
  );
});
