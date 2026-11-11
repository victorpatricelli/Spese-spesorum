/* ══════════ WALLET: pagamenti da confermare ══════════
   MacroDroid manda al foglio ogni notifica di pagamento di Google Wallet;
   il foglio la tiene in «Da confermare» e propone voce e conto in base alle
   conferme precedenti. Qui: ✓ registra subito (se voce e conto sono noti),
   tocco sulla riga = compila il modulo per controllare, ✕ = scarta. */
const walletInCoda = id => coda.some(c => c.spesa && c.spesa.walletId === id);
/* Voce proposta per un pagamento di Wallet, in quest'ordine:
   1) quella che hai già confermato per lo stesso esercente (arriva dal foglio);
   2) parole chiave dei negozi (CRF → carrefour, Eni → benzina, Atac → metro…);
   3) il nome di una tua voce dentro l'esercente ("Conad City" → conad).
   Le 2) e 3) sono solo proposte: compaiono con «proposta» e le confermi tu. */
const PAROLE_CHIAVE = [
  [/\bprime video\b|\bamazon prime\b/, "prime"],
  [/\buber ?eats\b|\bglovo\b|\bdeliveroo\b|\bjust ?eat\b/, "delivery"],
  [/\b(crf|carrefour)\b/, "carrefour"],
  [/\bconad\b/, "conad"],
  [/\bcoop\b/, "coop"],
  [/\bnatura ?si\b/, "natura si"],
  [/\b(lidl|eurospin|todis|pam|esselunga|despar|ins|md|penny|tuodi|elite|sigma|crai|simply|famila|aldi|tigre|carrefour express)\b/, "alimentari"],
  [/\bmacelleri/, "macelleria"],
  [/\b(eni|enilive|agip|q8|ip|tamoil|esso|api|shell|repsol|carburant\w*|distributor\w*)\b/, "benzina"],
  [/\b(autostrad\w*|telepass|pedagg\w*)\b/, "autostrada"],
  [/\b(easypark|parchegg\w*|parking|saba|apcoa|mycicero)\b/, "parcheggio"],
  [/\b(atac|cotral|metro|metropolitana)\b/, "metro"],
  [/\b(trenitalia|italo|ntv|frecciarossa)\b/, "treno"],
  [/\b(flixbus|itabus|clickbus)\b/, "clickbus"],
  [/\b(uber|free ?now|itaxi|taxi|bolt|wetaxi)\b/, "taxi"],
  [/\b(ryanair|easyjet|wizz\w*|ita airways|vueling|volotea|aeroport\w*)\b/, "aereo"],
  [/\b(booking|airbnb|hotel|albergo)\b/, "hotel"],
  [/\b(farmaci\w*|parafarmaci\w*|pharma\w*)\b/, "farmacia"],
  [/\b(mc ?donald\w*|burger king|kfc|pizzeri\w*|ristorant\w*|trattori\w*|osteri\w*|sushi|poke|kebab|trapizzino)\b/, "ristorante"],
  [/\bpasticc\w*/, "pasticceria"],
  [/\b(bar|caffe|cafe|coffee|tabacchi|tabaccheria)\b/, "bar"],
  [/\b(decathlon|palestr\w*|fitness|gym|mcfit|virgin active)\b/, "palestra"],
  [/\b(zara|h&m|primark|bershka|uniqlo|ovs|nike|adidas|foot ?locker|zalando)\b/, "shopping"],
  [/\b(amazon|amzn)\w*/, "amazon"],
  [/\b(acqua ?& ?sapone|tigota|sephora|douglas|kiko|profumeri\w*|dm)\b/, "igiene"],
  [/\b(ikea|leroy merlin|brico\w*|jysk)\b/, "arredamento"],
  [/\b(mediaworld|unieuro|euronics|trony|apple store)\b/, "tech"],
  [/\b(feltrinelli|mondadori|librer\w*)\b/, "libri"],
  [/\b(cinema|uci|the space|ticketone|vivaticket)\b/, "svago"],
  [/\b(universit\w*|sapienza|uniroma\w*|roma ?tre|tor vergata)\b/, "università"],
  [/\bspotify\b/, "spotify"], [/\bdisney\b/, "disney"], [/\bperplexity\b/, "perplexity"],
  [/\bgoogle\b/, "google"], [/\bvodafone\b/, "telefono"], [/\bho ?mobile\b/, "telefono"],
  [/\b(onedrive|microsoft)\b/, "onedrive"], [/\bgetquin\b/, "getquin"],
];
// voci troppo generiche per cercarle dentro il nome di un negozio
const VOCI_GENERICHE = ["roma","milano","altro","weekend","vacanze","studio","svago",
  "tech","regalo","tv","affitto","commissioni","telefono","internet","luce","igiene","giochi"];
const normEsercente = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/['’`]/g, "").replace(/[^a-z0-9&]+/g, " ").trim();
const voceDaNome = e => voci.find(v => v.entry.toLowerCase() === String(e).toLowerCase()) || null;
function indovinaVoce(esercente){
  const n = normEsercente(esercente);
  if(!n) return null;
  for(const [re, entry] of PAROLE_CHIAVE){
    if(re.test(n)){ const v = voceDaNome(entry); if(v) return v; }
  }
  const esc_ = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const candidate = voci.filter(v => {
    const e = normEsercente(v.entry);
    return e.length >= 3 && VOCI_GENERICHE.indexOf(e) === -1 && new RegExp("\\b" + esc_(e) + "\\b").test(n);
  }).sort((a, b) => b.entry.length - a.entry.length);
  return candidate[0] || null;
}
const walletImparata = w => !!w.voce && !!voceDaNome(w.voce);
const walletVoce = w => (walletImparata(w) ? voceDaNome(w.voce) : indovinaVoce(w.esercente));
/* Cashback per conto: l'importo registrato è già al netto (es. Trading 212 1,5%). */
const CASHBACK = { "Trading 212": 0.015 };
const walletCb = w => CASHBACK[w.conto] || 0;
const walletNetto = w => w.importo == null ? null : Math.round(w.importo * (1 - walletCb(w)) * 100) / 100;
const walletNota = w => (w.esercente || "") +
  (walletCb(w) ? " · cashback " + it(walletCb(w)*100).replace(/,?0+$/, "") + "% su " + it(w.importo) : "");

function renderWallet(){
  sicuro(aggiornaBadge);
  const box = $("walletBox"); if(!box) return;
  const lista = wallet.filter(w => !walletInCoda(w.id));
  if(walletCorrente && !lista.some(w => w.id === walletCorrente)) walletCorrente = null;
  if(!lista.length){ box.innerHTML = ""; return; }
  box.innerHTML = `<div class="lista"><div class="wal-t"><b><span class="ms">contactless</span>Da confermare</b>` +
    `<span>${lista.length} ${lista.length === 1 ? "pagamento" : "pagamenti"} da Wallet</span></div>` + lista.map(w => {
      const voce = walletVoce(w);
      const pronta = !!(voce && w.importo > 0 && w.conto && conti.indexOf(w.conto) !== -1);
      return `<div class="riga${w.id === walletCorrente ? " sel" : ""}" data-w="${esc(w.id)}" role="button" tabindex="0">` +
        (voce ? icona(voce.primary)
              : `<span class="qd" style="background:${P.altro}"><span class="ms f">contactless</span></span>`) +
        `<span class="tx"><div class="t1">${esc(w.esercente || "Pagamento")}</div>
          <div class="t2">${w.d}/${w.m} · ${voce ? esc(voce.entry) + (walletImparata(w) ? "" : " (proposta)") : "voce da scegliere"} · ${esc(w.conto || w.carta || "conto?")}${walletCb(w) ? " · cashback" : ""}</div></span>
        <span class="v">${w.importo != null ? it(walletNetto(w)) : "?"}</span>` +
        (pronta ? `<button type="button" class="tondo ok rip" data-ok="${esc(w.id)}" aria-label="Registra"><span class="ms">check</span></button>` : "") +
        `<button type="button" class="tondo rip" data-no="${esc(w.id)}" aria-label="Scarta"><span class="ms">close</span></button></div>`;
    }).join("") + `</div>`;
}

function caricaWallet(){
  google.script.run
    .withSuccessHandler(l => { if(Array.isArray(l)){ wallet = l; renderWallet(); } })
    .withFailureHandler(() => {})
    .daConfermare(getAnno());
}

/* Data della spesa sulle rotelle; se cambia il mese ricarica i totali di quel mese. */
function impostaData(d, m, a){
  const cambia = parseInt($("mm").value,10) !== m || getAnno() !== a;
  $("yy").value = a; $("mm").value = m; $("dd").value = d;
  if(!$("picker").hidden){ ruotaMesi(); ruotaGiorni(); }
  if(cambia){ riep = null; refresh(); }
}

/* Tocco sulla riga: compila importo, voce, conto, data e nota (l'esercente). */
function compilaWallet(id){
  const w = wallet.find(x => x.id === id); if(!w) return;
  vibra("tap");
  walletCorrente = id;
  espr = w.importo != null ? it(walletNetto(w)) : "";
  const voce = walletVoce(w);
  $("desc").value = voce ? voce.entry : "";
  $("note").value = walletNota(w);
  if(w.conto && conti.indexOf(w.conto) !== -1){ broker = w.conto; renderConti(); }
  impostaData(w.d, w.m, w.a);
  renderWallet(); paint();
  apriFoglio();
  toast(voce ? "Controlla e premi Aggiungi" : "Scegli la voce e premi Aggiungi");
}

/* ✓: registra subito con la voce e il conto proposti. */
function confermaWallet(id){
  const w = wallet.find(x => x.id === id); if(!w) return;
  const voce = walletVoce(w);
  if(!voce || !(w.importo > 0) || conti.indexOf(w.conto) === -1){ compilaWallet(id); return; }
  const cid = Date.now() + "-" + Math.random().toString(36).slice(2,7);
  coda.push({ id: cid, stato: "attesa", primary: voce.primary, secondary: voce.secondary,
    spesa: { idem: cid, a: w.a, m: w.m, d: w.d, desc: voce.entry, v: walletNetto(w),
             broker: w.conto, note: walletNota(w), walletId: w.id } });
  salvaCoda();
  if(walletCorrente === id) walletCorrente = null;
  if(w.m === parseInt($("mm").value,10) && w.a === getAnno()) totali.totale = (totali.totale||0) + walletNetto(w);
  invalida("sum", "year");
  vibra("invio");
  renderWallet(); paint(); drena();
}

/* ✕: non registrarlo (doppione, rimborso, già segnato a mano…). */
async function scartaPagamento(id){
  const w = wallet.find(x => x.id === id); if(!w) return;
  const si = await chiedi("Scartare il pagamento?",
    "«" + (w.esercente || "Pagamento") + "» da " + eur(w.importo || 0) +
    ": non lo registro. Nel foglio resta in «Da confermare» come scartato.", "close", "Scarta");
  if(!si) return;
  wallet = wallet.filter(x => x.id !== id);
  if(walletCorrente === id){ walletCorrente = null; }
  renderWallet();
  google.script.run
    .withSuccessHandler(r => { if(r && !r.ok) toast(r.errore, true); })
    .withFailureHandler(err => { toast(String(err.message||err), true); caricaWallet(); })
    .scartaWallet(id);
}

$("walletBox").onclick = e => {
  const ok = e.target.closest("[data-ok]"), no = e.target.closest("[data-no]"), riga = e.target.closest("[data-w]");
  if(no){ scartaPagamento(no.dataset.no); return; }
  if(ok){ confermaWallet(ok.dataset.ok); return; }
  if(riga) compilaWallet(riga.dataset.w);
};
$("walletBox").addEventListener("keydown", e => {
  if((e.key === "Enter" || e.key === " ") && e.target.matches("[data-w]")){ e.preventDefault(); compilaWallet(e.target.dataset.w); }
});

/* ══════════ RICORRENTI ══════════
   Le spese che tornano ogni mese (abbonamenti, telefono…) le trova il foglio
   (Ricorrenti.gs) guardando i mesi scorsi. Qui compaiono quando arriva il loro
   giorno solito: ✓ le registra con importo e conto dell'ultima volta, il tocco
   sulla riga compila il modulo (per cambiare l'importo), ✕ le salta.
   Se lo script non ha ancora la funzione «ricorrenti» non compare niente. */
let ricorrenti = [], ricAttive = true, ricAperte = false;
const ricK = s => String(s == null ? "" : s).trim().toLowerCase();
const ricInCoda = r => {
  const n = new Date();
  return coda.some(c => c.spesa && ricK(c.spesa.desc) === ricK(r.voce) &&
    c.spesa.m === n.getMonth()+1 && c.spesa.a === n.getFullYear());
};
const ricVisibili = () => ricorrenti.filter(r => !ricInCoda(r));
const ricDovute = () => { const g = new Date().getDate(); return ricVisibili().filter(r => r.giorno <= g); };
const ricTrova = v => ricorrenti.find(r => ricK(r.voce) === ricK(v));
const ricData = r => { const n = new Date(); return { d: Math.min(r.giorno, n.getDate()), m: n.getMonth()+1, a: n.getFullYear() }; };

function caricaRicorrenti(){
  if(!ricAttive || !cfg.url || !cfg.pin) return;
  api("ricorrenti", ["lista"]).then(r => {
    if(r && Array.isArray(r.lista)){ ricorrenti = r.lista; renderRicorrenti(); }
  }, err => {
    // script non ancora aggiornato: non riprova a ogni apertura
    if(/sconosciuta/i.test(String(err && err.message))) ricAttive = false;
  });
}

function renderRicorrenti(){
  sicuro(aggiornaBadge);
  const box = $("ricBox"); if(!box) return;
  const g = new Date().getDate();
  const dovute = ricDovute(), poi = ricVisibili().filter(r => r.giorno > g);
  if(!dovute.length && !poi.length){ box.innerHTML = ""; return; }
  const riga = r => {
    const voce = voceDaNome(r.voce);
    const pronta = !!(voce && r.importo > 0 && r.conto && conti.indexOf(r.conto) !== -1);
    return `<div class="riga" data-r="${esc(r.voce)}" role="button" tabindex="0">` + icona(r.primary) +
      `<span class="tx"><div class="t1">${esc(r.voce)}</div>
        <div class="t2">${r.giorno <= g ? "di solito il " + r.giorno : "attesa il " + r.giorno} · ${esc(r.conto || "conto?")}</div></span>
      <span class="v">${it(r.importo)}</span>` +
      (pronta ? `<button type="button" class="tondo ok rip" data-rok="${esc(r.voce)}" aria-label="Registra"><span class="ms">check</span></button>` : "") +
      `<button type="button" class="tondo rip" data-rno="${esc(r.voce)}" aria-label="Salta"><span class="ms">close</span></button></div>`;
  };
  box.innerHTML = `<div class="lista"><div class="wal-t"><b><span class="ms">autorenew</span>Ricorrenti di ${MESI[new Date().getMonth()].toLowerCase()}</b>` +
    `<span>${dovute.length ? dovute.length + " da registrare" : "nessuna per ora"}</span></div>` +
    dovute.map(riga).join("") + (ricAperte ? poi.map(riga).join("") : "") +
    (poi.length ? `<button type="button" class="ric-poi rip" data-rpoi aria-expanded="${ricAperte}"><span>${ricAperte ? "Nascondi quelle più avanti"
        : "Più avanti: " + poi.map(r => esc(r.voce) + " il " + r.giorno).join(", ")}</span><span class="ms">${ricAperte ? "expand_less" : "expand_more"}</span></button>` : "") +
    `</div>`;
}

/* Tocco sulla riga: compila il modulo, così puoi correggere importo o conto. */
function compilaRic(v){
  const r = ricTrova(v); if(!r) return;
  vibra("tap");
  if(walletCorrente){ walletCorrente = null; renderWallet(); }
  espr = it(r.importo);
  $("desc").value = r.voce; $("note").value = "";
  if(r.conto && conti.indexOf(r.conto) !== -1){ broker = r.conto; renderConti(); }
  const q = ricData(r); impostaData(q.d, q.m, q.a);
  paint();
  apriFoglio();
  toast("Controlla l'importo e premi Aggiungi");
}

/* ✓: registra subito con l'importo e il conto dell'ultima volta. */
function confermaRic(v){
  const r = ricTrova(v); if(!r) return;
  const voce = voceDaNome(r.voce);
  if(!voce || !(r.importo > 0) || conti.indexOf(r.conto) === -1){ compilaRic(v); return; }
  const q = ricData(r), cid = Date.now() + "-" + Math.random().toString(36).slice(2,7);
  coda.push({ id: cid, stato: "attesa", primary: voce.primary, secondary: voce.secondary,
    spesa: { idem: cid, a: q.a, m: q.m, d: q.d, desc: voce.entry, v: r.importo, broker: r.conto, note: "ricorrente" } });
  salvaCoda();
  if(q.m === parseInt($("mm").value,10) && q.a === getAnno()) totali.totale = (totali.totale||0) + r.importo;
  invalida("sum", "year");
  vibra("invio");
  renderRicorrenti(); paint(); drena();
}

/* ✕: per questo mese no, oppure mai più (abbonamento disdetto). */
async function saltaRic(v){
  const r = ricTrova(v); if(!r) return;
  const s = await chiedi("Saltare «" + r.voce + "»?",
    "Per questo mese non te la ripropongo. Se l'hai disdetta, scegli «Non proporla più».",
    "event_busy", "Salta il mese", "Non proporla più");
  if(!s) return;
  ricorrenti = ricorrenti.filter(x => x !== r);
  renderRicorrenti();
  api("ricorrenti", [s === "alt" ? "mai" : "salta", r.voce]).then(res => {
    if(res && res.ok === false) toast(res.errore || "Non riuscito", true);
    else toast(s === "alt" ? "«" + r.voce + "» non la propongo più" : "«" + r.voce + "» saltata per questo mese");
  }, err => { toast(String(err.message||err), true); caricaRicorrenti(); });
}

/* Spesa scritta nel foglio (da qui o dal modulo): se era una ricorrente, esce dall'elenco. */
function ricRegistrata(sp){
  const n = new Date();
  if(!sp || sp.m !== n.getMonth()+1) return;
  ricorrenti = ricorrenti.filter(r => ricK(r.voce) !== ricK(sp.desc));
  renderRicorrenti();
}

$("ricBox").onclick = e => {
  const ok = e.target.closest("[data-rok]"), no = e.target.closest("[data-rno]"),
        poi = e.target.closest("[data-rpoi]"), riga = e.target.closest("[data-r]");
  if(poi){ ricAperte = !ricAperte; renderRicorrenti(); return; }
  if(no){ saltaRic(no.dataset.rno); return; }
  if(ok){ confermaRic(ok.dataset.rok); return; }
  if(riga) compilaRic(riga.dataset.r);
};
$("ricBox").addEventListener("keydown", e => {
  if((e.key === "Enter" || e.key === " ") && e.target.matches("[data-r]")){ e.preventDefault(); compilaRic(e.target.dataset.r); }
});

/* ══════════ NUMERO SULL'ICONA ══════════
   Conta quello che aspetta te: pagamenti Wallet da confermare e ricorrenti
   arrivate al loro giorno.
   - Su PC (Chrome/Edge) il numero si scrive direttamente sull'icona.
   - Su Android un sito non può scriverlo: l'icona mostra il numero delle
     notifiche dell'app. Quindi una notifica silenziosa per ogni cosa da
     confermare, che sparisce da sola appena la registri o la scarti.
     Le notifiche si aggiornano quando esci dall'app e, quando Android lo
     concede, anche in sottofondo (vedi sw.js). */
function daConfermareOra(){
  const out = [];
  wallet.filter(w => !walletInCoda(w.id)).forEach(w => out.push({ tag: "dc-w-" + w.id,
    titolo: "Da confermare · " + (w.importo != null ? eur(w.importo) : "pagamento"),
    testo: (w.esercente || "Pagamento") + (w.conto ? " · " + w.conto : "") }));
  ricDovute().forEach(r => out.push({ tag: "dc-r-" + ricK(r.voce),
    titolo: "Ricorrente · " + r.voce + " " + eur(r.importo),
    testo: "Di solito il " + r.giorno + (r.conto ? " · " + r.conto : "") }));
  return out;
}
const badgeAttivo = () => !!pref.badge && "Notification" in window && Notification.permission === "granted";

function aggiornaBadge(){
  const lista = daConfermareOra(), n = lista.length;
  try{
    if(navigator.setAppBadge){ (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); }
  }catch(e){}
  if(!("serviceWorker" in navigator) || !("Notification" in window) || Notification.permission !== "granted") return;
  const attivo = badgeAttivo(), nascosta = document.visibilityState !== "visible";
  navigator.serviceWorker.ready.then(reg => reg.getNotifications().then(aperte => {
    const voluti = {}; if(attivo) lista.forEach(x => { voluti[x.tag] = true; });
    const gia = {};
    aperte.forEach(nf => {
      if(!/^dc-/.test(nf.tag || "")) return;
      if(voluti[nf.tag]) gia[nf.tag] = true; else nf.close();      // registrata o scartata: via
    });
    // quelle nuove si aggiungono solo quando l'app non è davanti: mentre la usi le vedi già qui
    if(!attivo || !nascosta) return;
    lista.forEach(x => { if(!gia[x.tag]) reg.showNotification(x.titolo, { body: x.testo, tag: x.tag, silent: true,
      icon: "icon-192.png", badge: "icon-192.png", data: { url: "./" } }); });
  })).catch(() => {});
}
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden") sicuro(aggiornaBadge); });

/* URL, PIN e interruttore in un posto che anche il service worker può leggere. */
function salvaCfgSw(){
  if(!("caches" in window) || !cfg.url || !cfg.pin) return;
  caches.open("spese-cfg").then(c => c.put("./__cfg", new Response(JSON.stringify({
    url: cfg.url, pin: cfg.pin, badge: !!pref.badge }), { headers: { "Content-Type": "application/json" } }))).catch(() => {});
}

/* Controllo in sottofondo: Android decide lui ogni quanto (di solito non più
   di un paio di volte al giorno, e solo per le app installate che usi spesso). */
function attivaControlloInSottofondo(){
  if(!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then(async reg => {
    if(!("periodicSync" in reg)) return;
    try{
      if(!badgeAttivo()){ await reg.periodicSync.unregister("da-confermare"); return; }
      const p = await navigator.permissions.query({ name: "periodic-background-sync" });
      if(p.state === "granted") await reg.periodicSync.register("da-confermare", { minInterval: 3 * 60 * 60 * 1000 });
    }catch(e){}
  }).catch(() => {});
}

(function(){
  const b = $("optBadge");
  const sincronizza = () => { b.checked = badgeAttivo(); };
  sincronizza();
  $("brand").addEventListener("click", sincronizza);
  b.onchange = async () => {
    if(b.checked){
      if(!("Notification" in window)){ b.checked = false; toast("Notifiche non supportate qui", true); return; }
      const p = await Notification.requestPermission();
      pref.badge = p === "granted";
      if(!pref.badge) toast("Permesso negato: riattivalo dalle impostazioni di Android", true);
    } else pref.badge = false;
    salvaPref(); sincronizza(); salvaCfgSw(); attivaControlloInSottofondo(); aggiornaBadge();
  };
})();
