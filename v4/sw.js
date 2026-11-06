// Caches the app shell only. Player data and every /api/ response are never cached on the device.
const V = "be-v3-shell-1";
const SHELL = ["./", "./index.html", "./styles.css", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.includes("/api/") || u.pathname.endsWith(".json")) return; // network only
  const shell = u.pathname.endsWith("/") || /\.(html|css|js|svg|webmanifest)$/.test(u.pathname);
  if (!shell) return;
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(V).then((ca) => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
