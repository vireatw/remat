// 接好料 ReMat 離線支援
// 有網路時一律抓最新的（不會卡在舊版），沒網路時才用上次存下來的。
// Firebase 程式庫的網址有版本號、內容不會變，所以直接用存下來的，打開更快。
const CACHE = "remat-v1";
const SHELL = ["/", "/config.js", "/backend.js", "/manifest.json", "/favicon.svg", "/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/10.12.2/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }
  if (url.origin !== location.origin) return;

  const key = req.mode === "navigate" ? "/" : req;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
        return res;
      })
      .catch(() => caches.match(key).then((hit) => hit || caches.match("/")))
  );
});
