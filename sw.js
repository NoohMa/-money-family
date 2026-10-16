/* Money 家庭版 離線快取
   - 網頁本身：先抓網路（最多等 4 秒），抓不到就用上次存的 → 有網路時自動是最新版，不用改這個檔
   - Firebase 程式庫：存一份在手機，離線也能開
   - 記帳資料由 Firebase 自己存在手機，連上網路後自動同步 */
const CACHE = 'money-fam-v1';
const CDN = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js'
];
const PAGE = './index.html';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    try { await c.add(PAGE); } catch (er) {}
    await Promise.all(CDN.map(u => fetch(new Request(u, {mode:'no-cors'})).then(r => c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    const net = fetch(req).then(async r => { if (r && r.ok) { const c = await caches.open(CACHE); await c.put(PAGE, r.clone()); } return r; });
    e.waitUntil(net.catch(() => {}));
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fallback = async () => { if (done) return; const hit = await caches.match(PAGE); if (hit && !done) { done = true; resolve(hit); } };
      const t = setTimeout(fallback, 4000);
      net.then(r => { if (!done) { done = true; clearTimeout(t); resolve(r); } })
         .catch(async () => { clearTimeout(t); await fallback(); if (!done) { done = true; resolve(new Response('離線中，請連上網路後再開一次', {headers:{'Content-Type':'text/plain; charset=utf-8'}})); } });
    }));
    return;
  }
  if (CDN.includes(req.url) || (url.origin === location.origin && !url.pathname.endsWith('sw.js'))) {
    e.respondWith(caches.match(req.url).then(hit => hit || fetch(req).then(async r => {
      if (r && (r.ok || r.type === 'opaque')) { const c = await caches.open(CACHE); c.put(req.url, r.clone()); }
      return r;
    })));
  }
});
