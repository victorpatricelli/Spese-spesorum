/* ══════════ collegamento all'Apps Script ══════════
   L'app non vive più dentro Apps Script: le chiamate google.script.run
   diventano POST all'URL /exec. Questo "ponte" imita la stessa sintassi
   (withSuccessHandler / withFailureHandler / funzione(...)), così il resto
   del codice resta identico. URL e PIN stanno solo nel localStorage. */
const CHIAVE_CFG = "spese:cfg";
let cfg = (() => { try { return JSON.parse(localStorage.getItem(CHIAVE_CFG)) || {}; } catch(e){ return {}; } })();

async function api(fn, args, prova){
  const c = prova || cfg;
  if(!c.url || !c.pin){
    if(!prova) apriImpostazioni();
    throw new Error("Collega prima il foglio: tocca il logo in alto.");
  }
  // Limite di 20 s: se Apps Script si "sveglia" lentamente o la rete è appesa,
  // la richiesta si interrompe e la spesa resta in coda invece di restare bloccata.
  // Se nel frattempo il foglio l'aveva già scritta, il nuovo invio non crea doppioni:
  // lo script riconosce la spesa dal suo codice (idem) e restituisce l'esito di allora.
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const limite = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
  let r;
  try{
    r = await fetch(c.url, { method:"POST", redirect:"follow",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },   // niente preflight CORS
      body: JSON.stringify({ pin:c.pin, fn:fn, args:args || [] }),
      signal: ctrl ? ctrl.signal : undefined });
  }catch(e){
    const err = new Error(e && e.name === "AbortError"
      ? "Il foglio non ha risposto entro 20 secondi: riprovo da solo."
      : navigator.onLine
        ? "Il foglio non risponde. Controlla l'URL e che l'accesso sia «Chiunque»."
        : "Sei offline.");
    err.rete = true;
    throw err;
  }finally{
    if(limite) clearTimeout(limite);
  }
  if(!r.ok) throw new Error("Errore del server (" + r.status + ").");
  let j;
  try{ j = await r.json(); }
  catch(e){ throw new Error("Risposta non valida: l'URL deve finire in /exec e l'accesso essere «Chiunque»."); }
  if(!j.ok){
    if(j.codice === "PIN" && !prova) apriImpostazioni(j.errore);
    throw new Error(j.errore || "Errore sconosciuto.");
  }
  return j.data;
}

function chiamata(){
  let ok = () => {}, ko = () => {};
  const p = new Proxy({}, { get(_, nome){
    if(nome === "withSuccessHandler") return f => { ok = f; return p; };
    if(nome === "withFailureHandler") return f => { ko = f; return p; };
    return (...args) => { api(nome, args).then(ok, ko); };
  }});
  return p;
}
window.google = { script: { get run(){ return chiamata(); } } };

/* ══════════ precaricamento ══════════
   All'apertura (e dopo ogni aggiornamento) Mese, Anno, Portafoglio e Acquisto
   si caricano in sottofondo: passando da una scheda all'altra i dati ci sono già.
   prendi() condivide la richiesta in corso: se tocchi una scheda mentre si sta
   ancora caricando, aspetta quella invece di farne partire un'altra.
   invalida() scarta le risposte di richieste partite prima di una modifica. */
const inVolo = {}, ultimaRichiesta = {};
/* Dati dell'ultima volta: Mese, Anno, Portafoglio e Acquisto restano salvati sul
   telefono. All'apertura si vedono subito quelli, e intanto il foglio risponde in
   sottofondo e li sostituisce. vecchi[k] = a schermo c'è ancora la copia salvata. */
const CHIAVE_DATI = "spese:dati:", vecchi = {};
function ricordaDati(k, d, mese){
  if(d == null) return;
  try{ localStorage.setItem(CHIAVE_DATI + k, JSON.stringify({ t: Date.now(), mese: mese || null, d: d })); }catch(e){}
}
function datiRicordati(k){
  try{ return JSON.parse(localStorage.getItem(CHIAVE_DATI + k) || "null"); }catch(e){ return null; }
}
function prendi(k, fn, args, nuova){
  if(inVolo[k] && !nuova) return inVolo[k];
  const p = api(fn, args || []);
  inVolo[k] = p; ultimaRichiesta[k] = p;
  const fine = () => { if(inVolo[k] === p) delete inVolo[k]; };
  p.then(fine, fine);
  p.then(d => { if(ultimaRichiesta[k] === p) ricordaDati(k, d, p.mese); }, () => {});
  return p;
}
const valida = (k, p) => ultimaRichiesta[k] === p;
function invalida(...chiavi){
  chiavi.forEach(k => { delete inVolo[k]; delete ultimaRichiesta[k];
    if(k==="sum") riep = null; if(k==="year") stat = null;
    if(k==="port") port = null; if(k==="buy") acq = null; });
}
function precaricaTutto(){
  if(!cfg.url || !cfg.pin) return;
  sicuro(() => caricaRiepilogo(true));
  sicuro(() => caricaAnni(true));
  sicuro(() => caricaPortafoglio(false, true));
  sicuro(() => caricaAcquisto(false, true));
}

function apriImpostazioni(messaggio){
  const s = document.getElementById("cfgScrim");
  document.getElementById("cfgUrl").value = cfg.url || "";
  document.getElementById("cfgPin").value = cfg.pin || "";
  document.getElementById("cfgErr").innerHTML = messaggio
    ? `<div class="err"><span>${String(messaggio).replace(/[<>&]/g,"")}</span></div>` : "";
  s.classList.add("on");
}
document.getElementById("cfgNo").onclick = () => document.getElementById("cfgScrim").classList.remove("on");
document.getElementById("cfgSi").onclick = async () => {
  const b = document.getElementById("cfgSi");
  const nuovo = { url: document.getElementById("cfgUrl").value.trim(),
                  pin: document.getElementById("cfgPin").value.trim() };
  const box = document.getElementById("cfgErr");
  if(!/^https:\/\/script\.google\.com\/.+\/exec$/.test(nuovo.url)){
    box.innerHTML = `<div class="err"><span>L'URL deve iniziare con https://script.google.com/ e finire in /exec.</span></div>`;
    return;
  }
  if(!nuovo.pin){ box.innerHTML = `<div class="err"><span>Inserisci il PIN.</span></div>`; return; }
  b.disabled = true; b.textContent = "Provo…"; box.innerHTML = "";
  try{
    await api("ping", [], nuovo);
    cfg = nuovo;
    try{ localStorage.setItem(CHIAVE_CFG, JSON.stringify(cfg)); }catch(e){}
    salvaCfgSw();
    document.getElementById("cfgScrim").classList.remove("on");
    toast("Collegato al foglio");
    refresh(); drena();
  }catch(e){
    box.innerHTML = `<div class="err"><span>${String(e.message).replace(/[<>&]/g,"")}</span></div>`;
  }finally{
    b.disabled = false; b.textContent = "Prova e salva";
  }
};
document.getElementById("brand").onclick = () => apriImpostazioni();

/* ══════════ vibrazione e avvisi di budget ══════════ */
const CHIAVE_PREF = "spese:pref", CHIAVE_BUDGET = "spese:budget";
let pref = (() => { try { return Object.assign({vibra:true, notif:false, badge:true, tema:"system"}, JSON.parse(localStorage.getItem(CHIAVE_PREF))); }
                    catch(e){ return {vibra:true, notif:false, badge:true, tema:"system"}; } })();
function salvaPref(){ try{ localStorage.setItem(CHIAVE_PREF, JSON.stringify(pref)); }catch(e){} }

/* Tema: "system" segue il telefono, "light"/"dark" lo forzano.
   Imposta data-theme sulla pagina e il colore della barra di stato di Android. */
function applicaTema(t){
  const r = document.documentElement;
  if(t === "light" || t === "dark") r.setAttribute("data-theme", t); else r.removeAttribute("data-theme");
  const scuro = t === "dark" || (t !== "light" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute("content", scuro ? "#080D19" : "#F4F6FB"));
}
applicaTema(pref.tema);

const VIBRAZIONI = {
  tap:    8,                       // tasto del tastierino
  rotella:6,                       // scatto delle rotelle giorno/mese
  invio:  [12, 40, 12],            // spesa messa in coda
  ok:     25,                      // il foglio ha confermato
  warn:   [60, 90, 60],            // vicino al budget (80%)
  sforato:[160, 80, 160, 80, 260], // budget superato
  errore: [220]
};
function vibra(tipo){
  if(!pref.vibra || !navigator.vibrate) return;
  try{ navigator.vibrate(VIBRAZIONI[tipo] || 20); }catch(e){}
}

/* budget del mese: preso dal riepilogo e ricordato sul telefono, così l'avviso
   funziona anche senza aprire la scheda Mese */
let budgetMese = (() => { try { return JSON.parse(localStorage.getItem(CHIAVE_BUDGET)) || null; } catch(e){ return null; } })();
function ricordaBudget(b){
  if(!b) return;
  budgetMese = { b: b, quando: Date.now() };
  try{ localStorage.setItem(CHIAVE_BUDGET, JSON.stringify(budgetMese)); }catch(e){}
  try{ mostraTotale(totali.totale || 0); renderQuota(); }catch(e){}   // aggiorna subito barra e quota
}
function aggiornaBudgetInSottofondo(){
  if(budgetMese && Date.now() - budgetMese.quando < 6*3600*1000) return;   // fresco: max 6 ore
  const n = new Date();
  // se il mese aperto è quello corrente, il precaricamento di Mese aggiorna già il budget
  if(chiaveMese() === (n.getMonth()+1) + "-" + n.getFullYear()) return;
  api("riepilogoMese", [n.getMonth()+1, n.getFullYear()], cfg.url && cfg.pin ? cfg : null)
    .then(r => { if(r && r.budget) ricordaBudget(r.budget); })
    .catch(() => {});
}

/* Confronta il totale prima e dopo la spesa: avvisa solo quando si attraversa
   una soglia (80% o 100%), non a ogni spesa successiva. */
function controllaBudget(res, importo){
  const b = budgetMese && budgetMese.b;
  if(!b || !res || !res.totali) return;
  const righe = [];
  const prova = (nome, dopo, etichetta) => {
    const tetto = Number(b[nome]);
    if(!(tetto > 0)) return;
    const prima = dopo - importo;
    if(prima < tetto && dopo >= tetto)
      righe.push({ grave:true, nome:etichetta,
        testo: etichetta + ": " + eur0(dopo) + " su " + eur0(tetto) + " (+" + eur0(dopo - tetto) + ")" });
    else if(prima < tetto*0.8 && dopo >= tetto*0.8)
      righe.push({ grave:false, nome:etichetta,
        testo: etichetta + ": " + Math.round(dopo/tetto*100) + "% del budget · restano " + eur0(tetto - dopo) });
  };
  if(res.primary) prova(res.primary, Number(res.totali.perCategoria[res.primary]) || 0, res.primary);
  prova("TOTALE", Number(res.totali.totale) || 0, "Mese");
  if(!righe.length) return;

  const grave = righe.some(r => r.grave);
  const titolo = grave ? "Budget superato" : "Budget quasi finito";
  mostraAvviso(titolo, righe.map(r => r.testo), grave);
  vibra(grave ? "sforato" : "warn");
  if(grave) notificaSistema(titolo, righe.filter(r => r.grave).map(r => r.testo).join("\n"),
                            "budget-" + righe.filter(r => r.grave).map(r => r.nome).join("-"));
}

let tAvv;
function mostraAvviso(titolo, righe, grave){
  const a = document.getElementById("avviso");
  document.getElementById("avvIco").textContent = grave ? "error" : "warning";
  document.getElementById("avvTxt").innerHTML = "<b>" + esc(titolo) + "</b>" + righe.map(esc).join("<br>");
  a.classList.toggle("bad", grave); a.classList.toggle("warn", !grave); a.classList.add("on");
  clearTimeout(tAvv); tAvv = setTimeout(() => a.classList.remove("on"), grave ? 9000 : 6000);
}
document.getElementById("avvX").onclick = () => document.getElementById("avviso").classList.remove("on");

function notificaSistema(titolo, testo, tag){
  if(!pref.notif || !("Notification" in window) || Notification.permission !== "granted") return;
  if(!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then(reg => reg.showNotification(titolo, {
    body: testo, tag: tag, renotify: true, icon: "icon-192.png", badge: "icon-192.png",
    vibrate: pref.vibra ? VIBRAZIONI.sforato : undefined, data: { url: "./" }
  })).catch(() => {});
}

/* interruttori nelle impostazioni (si salvano subito) */
(function(){
  const v = document.getElementById("optVibra"), n = document.getElementById("optNotif");
  const sincronizza = () => {
    v.checked = pref.vibra;
    n.checked = pref.notif && "Notification" in window && Notification.permission === "granted";
  };
  sincronizza();
  v.onchange = () => { pref.vibra = v.checked; salvaPref(); vibra("ok"); };
  n.onchange = async () => {
    if(!n.checked){ pref.notif = false; salvaPref(); return; }
    if(!("Notification" in window)){ n.checked = false; toast("Notifiche non supportate qui", true); return; }
    const p = await Notification.requestPermission();
    pref.notif = p === "granted"; salvaPref(); sincronizza();
    if(pref.notif) notificaSistema("Notifiche attive", "Ti avviso qui quando superi un budget.", "prova");
    else toast("Permesso negato: riattivalo dalle impostazioni di Android", true);
  };
  document.getElementById("brand").addEventListener("click", sincronizza);
  const radioTema = { system: document.getElementById("temaSys"),
                      light:  document.getElementById("temaLight"),
                      dark:   document.getElementById("temaDark") };
  const segnaTema = () => { (radioTema[pref.tema] || radioTema.system).checked = true; };
  segnaTema();
  document.getElementById("brand").addEventListener("click", segnaTema);
  Object.entries(radioTema).forEach(([t, el]) => el.onchange = () => {
    if(!el.checked) return;
    pref.tema = t; salvaPref(); applicaTema(t);
    ridisegna();                                   // grafici e colori col tema nuovo
  });
})();

/* service worker: rende l'app installabile e la fa aprire anche offline */
if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

/* ══════════ colori ══════════
   Ogni categoria ha il suo colore fisso (il colore segue la categoria, mai la
   posizione in classifica), così grafico e legenda coincidono sempre.
   Le categorie non elencate qui prendono il grigio «altro». */
/* Le sette categorie principali hanno un colore (palette verificata per daltonismo,
   nell'ordine dei colori); le altre prendono il grigio «altro» e si riconoscono dall'icona. */
const SLOT = {Travel:1,Out:2,Housing:3,Transport:4,Health:5,Groceries:6,Leisure:7};
const ICONA = {Out:"restaurant",Groceries:"shopping_cart",Transport:"directions_bus",
  Leisure:"sports_esports",Travel:"flight",Housing:"home",Health:"medication",
  Subscriptions:"subscriptions",Clothing:"checkroom",Gifts:"redeem",Fees:"account_balance",
  OtherExpenses:"more_horiz",Baby:"child_care",Education:"school"};

/* Palette letta dalle variabili CSS: cambia da sola col tema chiaro/scuro. */
let P = {};
function leggiPalette(){
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  P = {
    testo:v("--ink"), testo2:v("--ink-2"), testo3:v("--ink-3"), bordo:v("--rule"),
    superficie:v("--sheet"), carta:v("--sheet"), fondo:v("--paper"),
    primario:v("--pri") || v("--ink"), evid:v("--hl"),
    bene:v("--good"), attenzione:v("--warn"), male:v("--error") || v("--bad"),
    griglia:v("--rule"), budget:v("--ink-3"), concesso:v("--ink-3"),
    inv:v("--card"), invTesto:v("--card-text"),
    altro:v("--c-altro"), traccia:v("--sheet-3"),
    slot:[1,2,3,4,5,6,7].map(i=>v("--c"+i))
  };
  P.male = v("--bad");
}
leggiPalette();

const BROKERS = ["Revolut","Fineco","Cash","BBVA","Trading 212"];
const PREFERITE = ["conad","bar","ristorante","delivery","svago","farmacia","regalo","amazon"];
const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto",
  "Settembre","Ottobre","Novembre","Dicembre"];
const MESI3 = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
const CHIAVE_CODA = "spese:coda";
const CHIAVE_STATO = "spese:stato";

let espr="", broker="Revolut", voci=[], vista="add";
let totali={totale:0,perCategoria:{},perSotto:{}}, ultime=[], riep=null, stat=null;
let coda=[], inviando=false;
let wallet=[], walletCorrente=null;   // pagamenti da Google Wallet da confermare

const $ = id => document.getElementById(id);
const val = () => calcola(espr);
const eur = n => "€ " + n.toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2});
const eur0 = n => "€ " + Math.round(n).toLocaleString("it-IT");
const segno = n => (Math.round(n)>0?"+":Math.round(n)<0?"−":"") + eur0(Math.abs(n));
const it = n => n.toFixed(2).replace(".",",");
/* Anno della spesa: di solito quello in corso. A gennaio, scegliendo dicembre
   sulla rotella, diventa l'anno precedente (le spese di fine anno registrate in ritardo). */
const getAnno = () => parseInt($("yy").value,10) || new Date().getFullYear();
function annoPerMese(m){
  const oggi = new Date();
  return (oggi.getMonth() === 0 && m === 12) ? oggi.getFullYear() - 1 : oggi.getFullYear();
}
const esc = s => String(s).replace(/[<>&"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));
const col = c => SLOT[c] ? P.slot[SLOT[c]-1] : P.altro;
const ico = c => ICONA[c] || "receipt_long";

/* ── coda che sopravvive a una ricarica ── */
function salvaCoda(){
  try{ localStorage.setItem(CHIAVE_CODA, JSON.stringify(coda)); }catch(e){}
}
function caricaCoda(){
  try{
    const v = localStorage.getItem(CHIAVE_CODA);
    if(v) coda = JSON.parse(v).map(c => c.stato==="invio" ? {...c, stato:"attesa"} : c);
  }catch(e){ coda = []; }
}

/* ── dialog M3 al posto del confirm() del browser ── */
function chiedi(titolo, testo, icona, conferma, altro){
  return new Promise(ok => {
    $("dlgt").textContent = titolo; $("dlgp").textContent = testo;
    $("dlgic").textContent = icona || "help"; $("dlgsi").textContent = conferma || "Conferma";
    const alt = $("dlgalt"); alt.hidden = !altro; alt.textContent = altro || "";   // terza scelta: risponde "alt"
    const s = $("scrim"); s.classList.add("on");
    const chiudi = r => { s.classList.remove("on"); $("dlgsi").onclick = $("dlgno").onclick = alt.onclick = s.onclick = null; ok(r); };
    $("dlgsi").onclick = () => chiudi(true);
    $("dlgno").onclick = () => chiudi(false);
    alt.onclick = () => chiudi("alt");
    s.onclick = e => { if(e.target === s) chiudi(false); };
  });
}
