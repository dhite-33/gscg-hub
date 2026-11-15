/* Serves photos and videos that a person uploaded in their own browser (blob/local-*). */
const FILEDB = "gscg-hub-files", STORE = "files";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
function get(key) {
  return new Promise((res) => {
    const r = indexedDB.open(FILEDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => { const tx = r.result.transaction(STORE, "readonly"); const q = tx.objectStore(STORE).get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); };
    r.onerror = () => res(null);
  });
}
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  const i = u.pathname.indexOf("/blob/local-");
  if (u.origin !== self.location.origin || i < 0) return;
  const key = decodeURIComponent(u.pathname.slice(i + 6));
  e.respondWith(get(key).then((b) => {
    if (!b) return new Response("Not found", { status: 404 });
    const range = e.request.headers.get("range");
    const m = range && /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? +m[1] : Math.max(0, b.size - +m[2]);
      const end = m[1] && m[2] ? Math.min(+m[2], b.size - 1) : b.size - 1;
      return new Response(b.slice(start, end + 1), { status: 206, headers: { "content-type": b.type, "content-range": `bytes ${start}-${end}/${b.size}`, "content-length": String(end - start + 1), "accept-ranges": "bytes" } });
    }
    return new Response(b, { headers: { "content-type": b.type, "content-length": String(b.size), "accept-ranges": "bytes" } });
  }));
});
