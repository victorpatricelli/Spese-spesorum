/* Service worker di Spese.
   - File dell'app (index.html, icone…): prima la rete, così ogni modifica
     caricata su GitHub arriva subito; senza rete usa la copia salvata.
   - Librerie e font esterni (Chart.js, Google Fonts, loghi): dalla copia
     salvata se c'è, altrimenti dalla rete.
   - Le chiamate al foglio (script.google.com) non passano mai dalla cache.
   Se cambi questo file, alza VERSIONE. */
const VERSIONE = "spese-v3";
const GUSCIO = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(GUSCIO)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== VERSIONE).map(x => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});

function conTimeout(promessa, ms) {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error("timeout")), ms);
    promessa.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); ko(e); });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (/(^|\.)google\.com$/.test(url.hostname) && url.pathname.startsWith("/macros")) return;
  if (url.hostname.endsWith("googleusercontent.com")) return;

  if (url.origin === self.location.origin) {
    // prima la rete (max 4 s), poi la copia salvata.
    // cache:"no-cache" chiede sempre a GitHub se il file è cambiato, invece di
    // riusare per 10 minuti la copia del browser: gli aggiornamenti arrivano subito.
    e.respondWith(
      conTimeout(fetch(req, { cache: "no-cache" }), 4000)
        .then(r => {
          if (r.ok) { const copia = r.clone(); caches.open(VERSIONE).then(c => c.put(req, copia)); }
          return r;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())))
    );
    return;
  }

  // risorse esterne: prima la copia salvata
  e.respondWith(
    caches.match(req).then(salvata => salvata || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const copia = r.clone(); caches.open(VERSIONE).then(c => c.put(req, copia)); }
      return r;
    }))
  );
});

/* tocco sulla notifica di budget: riporta in primo piano l'app (o la apre) */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(lista => {
      for (const c of lista) if ("focus" in c) return c.focus();
      return self.clients.openWindow((e.notification.data && e.notification.data.url) || "./");
    })
  );
});
