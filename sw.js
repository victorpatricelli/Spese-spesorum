/* Service worker di Spese.
   - File dell'app (index.html, icone…): prima la rete, così ogni modifica
     caricata su GitHub arriva subito; senza rete usa la copia salvata.
   - Librerie e font esterni (Chart.js, Google Fonts, loghi): dalla copia
     salvata se c'è, altrimenti dalla rete.
   - Le chiamate al foglio (script.google.com) non passano mai dalla cache.
   Se cambi questo file, alza VERSIONE. */
const VERSIONE = "spese-v11";
const CFG = "spese-cfg";   // URL, PIN e interruttore del numero sull'icona: li scrive l'app
const GUSCIO = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(GUSCIO)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(x => x !== VERSIONE && x !== CFG).map(x => caches.delete(x))))
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

/* ── numero sull'icona, anche ad app chiusa ──
   Su Android l'icona mostra il numero delle notifiche dell'app: qui, quando
   il telefono lo concede (periodic background sync), si chiede al foglio cosa
   c'è da confermare e si tiene una notifica silenziosa per ogni cosa.
   Stesse etichette (tag) che usa l'app: "dc-w-<id>" pagamenti Wallet,
   "dc-r-<voce>" ricorrenti arrivate al loro giorno. */
async function controllaDaConfermare() {
  const c = await caches.open(CFG);
  const salvata = await c.match("./__cfg");
  if (!salvata) return;
  const cfg = await salvata.json();
  if (!cfg.url || !cfg.pin || !cfg.badge) return;
  if (!self.Notification || Notification.permission !== "granted") return;

  const chiama = async (fn, args) => {
    const r = await fetch(cfg.url, { method: "POST", redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ pin: cfg.pin, fn: fn, args: args }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.errore || "errore");
    return j.data;
  };
  const eur = n => "€ " + Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const oggi = new Date();
  const lista = [];
  let wallet;
  try { wallet = await chiama("daConfermare", [oggi.getFullYear()]); }
  catch (e) { return; }                       // senza rete o foglio occupato: le notifiche restano come sono
  (wallet || []).forEach(w => lista.push({ tag: "dc-w-" + w.id,
    titolo: "Da confermare · " + (w.importo != null ? eur(w.importo) : "pagamento"),
    testo: (w.esercente || "Pagamento") + (w.conto ? " · " + w.conto : "") }));
  try {
    const r = await chiama("ricorrenti", ["lista"]);
    ((r && r.lista) || []).filter(x => x.giorno <= oggi.getDate()).forEach(x => lista.push({
      tag: "dc-r-" + String(x.voce).trim().toLowerCase(),
      titolo: "Ricorrente · " + x.voce + " " + eur(x.importo),
      testo: "Di solito il " + x.giorno + (x.conto ? " · " + x.conto : "") }));
  } catch (e) { /* script senza «ricorrenti»: solo i pagamenti */ }

  const voluti = {}; lista.forEach(x => { voluti[x.tag] = true; });
  const gia = {};
  (await self.registration.getNotifications()).forEach(n => {
    if (!/^dc-/.test(n.tag || "")) return;
    if (voluti[n.tag]) gia[n.tag] = true; else n.close();
  });
  await Promise.all(lista.filter(x => !gia[x.tag]).map(x => self.registration.showNotification(x.titolo, {
    body: x.testo, tag: x.tag, silent: true, icon: "icon-192.png", badge: "icon-192.png", data: { url: "./" } })));
}

self.addEventListener("periodicsync", e => {
  if (e.tag === "da-confermare") e.waitUntil(controllaDaConfermare().catch(() => {}));
});

/* tocco su una notifica: riporta in primo piano l'app (o la apre) */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(lista => {
      for (const c of lista) if ("focus" in c) return c.focus();
      return self.clients.openWindow((e.notification.data && e.notification.data.url) || "./");
    })
  );
});
