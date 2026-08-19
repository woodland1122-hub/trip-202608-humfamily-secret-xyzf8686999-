/* GRAND CRUISE 2026 しおり — オフライン用サービスワーカー
   方針: しおり本体と写真はキャッシュ優先で表示し、裏で更新する。
        天気（Open-Meteo）だけは必ずネットワークへ行く。 */
const CACHE = 'gc2026-v28';
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
  const url = new URL(req.url);
  if (url.hostname.indexOf('api.open-meteo.com') >= 0) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

/* 「まるごと保存」ボタンから送られてくるURLを先読みしてキャッシュする */
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
