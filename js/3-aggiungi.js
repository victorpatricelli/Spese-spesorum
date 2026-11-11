/* ══════════ AGGIUNGI ══════════ */
function voceScelta(){
  const q = $("desc").value.trim().toLowerCase();
  if(!q) return null;
  return voci.find(v => v.entry.toLowerCase() === q) || null;
}

const TASTI = [
  ["7","7"],["8","8"],["9","9"],["÷","op"],
  ["4","4"],["5","5"],["6","6"],["×","op"],
  ["1","1"],["2","2"],["3","3"],["−","op"],
  [",",","],["0","0"],["⌫","del"],["+","op"]
];
$("pad").innerHTML = TASTI.map(([t,tipo])=>{
  if(tipo==="del") return `<button class="key fn rip" data-k="⌫" aria-label="Cancella"><span class="ms">backspace</span></button>`;
  if(tipo==="op")  return `<button class="key op rip" data-k="${t}">${t}</button>`;
  return `<button class="key rip" data-k="${t}">${t}</button>`;
}).join("");

$("pad").onclick = e => {
  const b = e.target.closest("[data-k]"); if(!b) return;
  premi(b.dataset.k);
};
$("pad").oncontextmenu = e => {           // pressione lunga sul tasto cancella = azzera
  const b = e.target.closest('[data-k="⌫"]');
  if(b){ e.preventDefault(); espr = ""; paint(); }
};

const OPERATORI = ["÷","×","−","+"];
function premi(k){
  vibra("tap");
  const ultimo = espr.slice(-1);

  if(k === "⌫"){ espr = espr.slice(0,-1); }
  else if(OPERATORI.indexOf(k) !== -1){
    if(!espr) return;                                  // niente operatore all'inizio
    if(OPERATORI.indexOf(ultimo) !== -1) espr = espr.slice(0,-1) + k;  // sostituisce
    else espr += k;
  }
  else if(k === ","){
    // una sola virgola per numero
    const pezzo = espr.split(/[÷×−+]/).pop();
    if(pezzo.indexOf(",") !== -1) return;
    espr += pezzo ? "," : "0,";
  }
  else {
    const pezzo = espr.split(/[÷×−+]/).pop();
    const dec = pezzo.split(",")[1];
    if(dec && dec.length >= 2) return;                 // massimo due decimali
    if(pezzo.replace(",","").length >= 9) return;
    espr += k;
  }
  paint();
}

/* Valuta l'espressione senza usare eval: due passate, prima × e ÷, poi + e − */
let divZero = false;          // l'ultima espressione calcolata contiene una divisione per zero
function calcola(e){
  divZero = false;
  if(!e) return 0;
  const pulita = e.replace(/[÷×−+]$/,"");              // ignora un operatore finale
  if(!pulita) return 0;
  const pezzi = pulita.split(/([÷×−+])/).filter(x=>x!=="");
  const nums = [], ops = [];
  pezzi.forEach(p=>{
    if(OPERATORI.indexOf(p) !== -1) ops.push(p);
    else nums.push(parseFloat(p.replace(",",".")) || 0);
  });
  if(!nums.length) return 0;

  for(let i=0;i<ops.length;){
    if(ops[i]==="×" || ops[i]==="÷"){
      if(ops[i]==="÷" && !nums[i+1]){ divZero = true; return 0; }
      const r = ops[i]==="×" ? nums[i]*nums[i+1] : nums[i]/nums[i+1];
      nums.splice(i,2,r); ops.splice(i,1);
    } else i++;
  }
  let tot = nums[0];
  ops.forEach((o,i)=>{ tot = o==="+" ? tot+nums[i+1] : tot-nums[i+1]; });
  return Math.max(0, Math.round(tot*100)/100);
}

/* Conti: arrivano dal blocco "Cash - Liquidity" del foglio; BROKERS è solo
   la riserva finché il foglio non risponde. Il conto scelto resta selezionato
   se esiste ancora, altrimenti si passa al primo dell'elenco. */
let conti = BROKERS.slice();
function renderConti(){
  if(conti.indexOf(broker) === -1) broker = conti[0] || broker;
  $("brok").innerHTML = conti.map(b=>
    `<button class="chip rip ${b===broker?"on":""}" data-b="${esc(b)}">${esc(b)}</button>`).join("");
}
renderConti();
$("brok").onclick = e => {
  const b = e.target.closest("[data-b]"); if(!b) return;
  broker = b.dataset.b;
  [...$("brok").children].forEach(c=>c.classList.toggle("on",c.dataset.b===broker));
  paint();                                  // aggiorna subito il testo del pulsante
};

/* Voci: mattonelle che scorrono di lato. Senza ricerca mostra le preferite
   (più quella scelta, se non è fra queste); con la ricerca aperta filtra tutto l'elenco. */
let cercaAperta = false;
function renderVoci(){
  const q = $("desc").value.trim().toLowerCase();
  const filtro = cercaAperta ? q : "";
  const scelta = voceScelta();
  let sel;
  if(!filtro || (scelta && scelta.entry.toLowerCase() === filtro)){
    // preferite, poi quelle usate di recente, fino a 8
    const trova = nome => voci.find(v => v.entry.toLowerCase() === String(nome||"").toLowerCase());
    sel = [];
    PREFERITE.map(trova).concat(ultime.map(e => trova(e.desc)), voci)
      .forEach(v => { if(v && sel.length < 8 && sel.indexOf(v) === -1) sel.push(v); });
    if(scelta && sel.indexOf(scelta) === -1) sel = [scelta].concat(sel.slice(0,7));
  } else {
    sel = voci.filter(v => v.entry.toLowerCase().indexOf(filtro) !== -1).slice(0,16);
  }
  const speso = v => Number((totali.perSotto||{})[v.primary + "|" + v.secondary]) || 0;
  const tile = v => {
    const c = col(v.primary);
    const s = speso(v);
    return `<button type="button" class="tile rip ${v===scelta?"on":""}" data-d="${esc(v.entry)}" role="option" aria-selected="${v===scelta}">` +
      `<span class="qd" style="background:${c}"><span class="ms f">${ico(v.primary)}</span></span>` +
      `<span class="tt"><span class="n">${esc(v.entry)}</span>` +
      `<span class="c">${esc(v.secondary || v.primary)}${s ? " · " + eur0(s) : ""}</span></span></button>`;
  };
  const cerca = `<button type="button" class="tile cerca rip" data-cerca="1">` +
    `<span class="qd"><span class="ms">search</span></span><span class="tt"><span class="n">Altra voce</span>` +
    `<span class="c">cerca fra ${voci.length}</span></span></button>`;
  $("voci").innerHTML = sel.length
    ? sel.map(tile).join("") + (cercaAperta ? "" : cerca)
    : `<div class="vuoto" style="padding:16px;width:calc(100% - 32px)">${voci.length
        ? "Nessuna voce corrisponde."
        : "Elenco voci non caricato: controlla la scheda «Categorie Spese»."}</div>`;
}
function apriCerca(apri){
  cercaAperta = apri;
  $("cercaBox").hidden = !apri;
  if(apri){ $("desc").focus(); $("desc").select(); }
  else if(!voceScelta()) $("desc").value = "";
  paint();
}
$("voci").onclick = e => {
  if(e.target.closest("[data-cerca]")){ apriCerca(true); return; }
  const b = e.target.closest("[data-d]"); if(!b) return;
  vibra("tap");
  $("desc").value = b.dataset.d;
  if(cercaAperta){ cercaAperta = false; $("cercaBox").hidden = true; $("desc").blur(); }
  paint();
  const on = $("voci").querySelector(".tile.on");
  if(on && on.scrollIntoView) on.scrollIntoView({block:"nearest", inline:"nearest", behavior:"smooth"});
};
$("desc").oninput = paint;
$("desc").onkeydown = e => {
  if(e.key === "Enter"){                       // Invio sceglie la prima voce trovata
    const b = $("voci").querySelector("[data-d]");
    if(b){ e.preventDefault(); b.click(); }
  }
  if(e.key === "Escape") apriCerca(false);
};
$("cercaX").onclick = () => apriCerca(false);

/* Annulla in alto: svuota importo, voce e nota (la data resta quella scelta). */
$("pulisci").onclick = () => {
  if(!espr && !$("desc").value && !$("note").value) return;
  vibra("tap");
  espr = ""; $("desc").value = ""; $("note").value = "";
  cercaAperta = false; $("cercaBox").hidden = true;
  if(walletCorrente){ walletCorrente = null; renderWallet(); }
  clearErr(); paint();
};

/* − e +: correggono l'importo di un euro (con un'operazione in corso, partono dal risultato). */
function ritocca(d){
  const n = Math.max(0, Math.round((val() + d) * 100) / 100);
  vibra("tap");
  espr = n ? (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",")) : "";
  paint();
}
$("meno1").onclick = () => ritocca(-1);
$("piu1").onclick = () => ritocca(1);

/* Data: una riga; «Cambia» apre le rotelle. */
$("dataBtn").onclick = () => {
  const pk = $("picker"), apri = pk.hidden;
  pk.hidden = !apri;
  $("dataBtn").textContent = apri ? "Fatto" : "Cambia";
  $("dataBtn").setAttribute("aria-expanded", String(apri));
  if(apri){ ruotaMesi(); ruotaGiorni(); }
};

/* Importi rapidi: sostituiscono quello che c'è sul display. */
/* Tastiera del computer sulla scheda Aggiungi. Non interferisce quando scrivi in un campo. */
document.addEventListener("keydown", e => {
  if(vista !== "add" || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  if(document.querySelector(".scrim.on")) return;          // una finestra è aperta
  const mappa = {"/":"÷","*":"×","x":"×","-":"−","+":"+",",":",",".":",","Backspace":"⌫","Delete":"⌫"};
  let k = /^[0-9]$/.test(e.key) ? e.key : mappa[e.key];
  if(e.key === "Escape"){ espr = ""; paint(); return; }
  if(e.key === "Enter"){ if(!$("fab").disabled){ e.preventDefault(); $("fab").click(); } return; }
  if(!k) return;
  e.preventDefault();
  premi(k);
  const tasto = $("pad").querySelector(`[data-k="${k}"]`);
  if(tasto){ tasto.classList.add("premuto"); setTimeout(() => tasto.classList.remove("premuto"), 120); }
});

$("quickAmt").onclick = e => {
  const b = e.target.closest("[data-q]"); if(!b) return;
  vibra("tap");
  espr = b.dataset.q;
  paint();
};

/* Duplica ultima: compila importo, voce e conto come l'ultima spesa registrata.
   Non la invia: la data resta quella delle rotelle e la confermi con «Aggiungi». */
$("dupLast").onclick = () => ripeti(ultime[0]);
/* Tocco su una spesa registrata: compila il modulo con la stessa voce, importo e conto. */
function ripeti(e){
  if(!e) return;
  if(voci.length && !voceDaNome(e.desc)){ toast("La voce «" + e.desc + "» non è più nell'elenco", true); return; }
  vibra("tap");
  if(walletCorrente){ walletCorrente = null; renderWallet(); }
  espr = String(e.v).replace(".", ",");
  $("desc").value = e.desc;
  if(e.broker && conti.indexOf(e.broker) !== -1){ broker = e.broker; renderConti(); }
  paint();
  window.scrollTo({ top: 0, behavior: "smooth" });
  apriFoglio();
  toast("Compilata come «" + e.desc + "»: controlla la data e premi Aggiungi");
}
$("list").addEventListener("click", ev => {
  if(ev.target.closest("button")) return;                 // il tasto Annulla fa il suo
  const r = ev.target.closest("[data-u]"); if(r) ripeti(ultime[Number(r.dataset.u)]);
});
$("list").addEventListener("keydown", ev => {
  if((ev.key === "Enter" || ev.key === " ") && ev.target.matches("[data-u]")){ ev.preventDefault(); ripeti(ultime[Number(ev.target.dataset.u)]); }
});

/* Ricerca nelle spese registrate (descrizione, voce, categoria, conto, nota). */
$("listQ").oninput = () => renderList();
$("listQClear").onclick = () => { $("listQ").value = ""; renderList(); $("listQ").focus(); };

/* Pallino in alto: verde online, rosso lampeggiante offline. */
function statoRete(){
  const on = navigator.onLine;
  $("netDot").classList.toggle("off", !on);
  $("netDot").title = on ? "Online" : "Offline: le spese restano in coda";
}
window.addEventListener("online", statoRete);
window.addEventListener("offline", statoRete);
statoRete();


function paint(){
  const v = val();
  const haOperatori = /[÷×−+]/.test(espr);

  // con un'operazione in corso mostra l'espressione, e il risultato di fianco
  const lungo = espr.length > 7 ? " lungo" : "";
  $("amt").innerHTML = haOperatori
    ? `<span class="nm lungo">${esc(espr)}</span>` +
      (divZero ? `<span class="espr" style="background:var(--bad-s);color:var(--on-bad-s)">÷ 0 non si può</span>`
               : `<span class="espr">= ${eur(v)}</span>`)
    : `<span class="nm${v===0?" zero":""}${lungo}">${conDecimali(espr)}</span><span class="cursor"></span>`;

  const voce = voceScelta();
  $("sub").innerHTML = voce
    ? `<span class="qd" style="background:${col(voce.primary)}"><span class="ms f">${ico(voce.primary)}</span></span>` +
      `<span><b>${esc(voce.entry)}</b> · ${esc(voce.primary)} › ${esc(voce.secondary)}</span>`
    : `<span>${voci.length ? "Scegli la voce qui sotto" : "Carico le voci…"}</span>`;

  $("vocehint").textContent = !voci.length || voce || cercaAperta ? ""
    : $("desc").value.trim() ? "Nessuna voce si chiama così: scegline una dall'elenco"
    : "";

  $("fab").disabled = !(v>0 && voce);
  $("pulisci").disabled = !espr && !$("desc").value && !$("note").value;
  // per un secondo dopo l'invio il pulsante conferma, poi torna normale
  const conferma = Date.now() < fabOk.fino;
  $("fab").classList.toggle("fatto", conferma);
  $("fab").querySelector(".ms").textContent = conferma ? "check" : divZero || (v<=0 || !voce) ? "edit" : "add";
  $("fabtxt").innerHTML = conferma ? "Aggiunta · " + esc(fabOk.testo)
    : !voci.length ? "Carico le voci…"
    : divZero ? "Non si può dividere per zero"
    : v<=0 && !voce ? "Importo e voce, poi aggiungi"
    : v<=0 ? "Inserisci l'importo"
    : !voce ? "Scegli la voce di spesa"
    : "Aggiungi " + esc(eur(v)) + ` <span class="sotto">· ${esc(broker)}</span>`;
  sicuro(renderVoci); sicuro(renderList);

  const m = parseInt($("mm").value,10);
  sicuro(() => scriviData(m));
  sicuro(renderQuota);
  sicuro(() => mostraTotale(totali.totale||0));
  sicuro(aggiornaTesta);
}
/* esegue un pezzo di interfaccia; se fallisce lo segnala e lascia andare avanti il resto */
function sicuro(fn){
  try{ fn(); }catch(e){ console.error(e); if(window.segnalaErrore) segnalaErrore(e); }
}

/* Striscia d'inchiostro in cima ad Aggiungi.
   Mese in corso con budget: quota di oggi = budget rimasto stamattina ÷ giorni rimasti
   (oggi incluso), la stessa regola del riepilogo. Sotto, il totale del mese sul budget.
   Altrimenti: il mese scelto. */
function renderQuota(){
  const box = $("qcard"); if(!box) return;
  const n = new Date();
  const m = parseInt($("mm").value,10) || n.getMonth()+1, a = getAnno();
  const tot = Number(totali.totale) || 0;
  const tetto = budgetMese && budgetMese.b ? Number(budgetMese.b.TOTALE) : 0;
  const corrente = m === n.getMonth()+1 && a === n.getFullYear();
  const totTxt = `<b id="mtot">${eur(totMostrato == null ? tot : totMostrato)}</b>`;
  const stato = pct => pct > 1 ? "bad" : pct >= .8 ? "warn" : "good";
  const barra = (pct, cls) =>
    `<div class="inch-bar"><i class="${cls}" style="width:${Math.min(100, Math.max(0, pct*100)).toFixed(1)}%"></i></div>`;
  const meseRiga = (pre) => `<div class="inch-righe"><span>${pre} ${totTxt}${tetto > 0 ? " di " + eur0(tetto) : ""}</span>` +
    (tetto > 0 ? `<span>${Math.round(tot/tetto*100)}% del budget</span>` : `<span>nessun budget</span>`) + `</div>`;

  if(!corrente){
    const pct = tetto > 0 ? tot / tetto : 0;
    box.innerHTML = `<div class="q-top"><div><div class="q-l">Stai registrando in ${MESI[m-1].toLowerCase()}${a !== n.getFullYear() ? " " + a : ""}</div>` +
        `<div class="q-v">${eur0(tot)}<small>nel mese</small></div></div>` +
        `<span class="pill neu"><span class="ms">event</span>altro mese</span></div>` +
      (tetto > 0 ? barra(pct, stato(pct)) : "") +
      `<div class="inch-righe"><span>${tetto > 0 ? (tetto - tot >= 0 ? eur0(tetto - tot) + " ancora nel budget" : eur0(tot - tetto) + " oltre il budget") : ""}</span>` +
      `<span>la quota di oggi vale solo per il mese in corso</span></div>`;
    totMostrato = tot;
    return;
  }

  const g = n.getDate();
  const oggiE = (mm, dd, aa) => mm === m && dd === g && (aa || a) === a;
  const spesoOggi =
    ultime.filter(e => oggiE(e.m, e.d, e.a)).reduce((t,e) => t + (Number(e.v)||0), 0) +
    coda.filter(c => oggiE(c.spesa.m, c.spesa.d, c.spesa.a)).reduce((t,c) => t + (Number(c.spesa.v)||0), 0);

  if(!(tetto > 0)){
    box.innerHTML = `<div class="q-top"><div><div class="q-l">Spesi oggi</div><div class="q-v">${eur(spesoOggi)}</div></div>` +
      `<button type="button" class="pill neu" data-azione="vai-mese"><span class="ms">tune</span>Imposta budget</button></div>` +
      meseRiga(MESI[m-1]);
    return;
  }

  const rimasti = giorniDelMese(m, a) - g + 1;
  const quota = Math.max(0, tetto - (tot - spesoOggi)) / rimasti;
  const resta = quota - spesoOggi;
  const pct = quota > 0 ? spesoOggi / quota : (spesoOggi > 0 ? 9.99 : 0);
  const pill = quota <= 0 ? `<span class="pill bad"><span class="ms">block</span>budget finito</span>`
    : resta >= 0 ? `<span class="pill ${pct>=.8?"warn":"good"}">${eur(resta)} disponibili</span>`
    : `<span class="pill bad">${eur(-resta)} oltre</span>`;
  box.innerHTML = `<div class="q-top"><div><div class="q-l">Oggi · quota ${quota > 0 ? eur0(quota) : "€ 0"}</div>` +
      `<div class="q-v">${eur(spesoOggi)}<small>spesi</small></div></div><div class="q-r">${pill}</div></div>` +
    barra(pct, stato(pct)) + meseRiga(MESI[m-1]);
}
$("qcard").addEventListener("click", e => {
  if(e.target.closest('[data-azione="vai-mese"]')) $("nav").querySelector('[data-v="sum"]').click();
});

/* "12,50": i centesimi in piccolo. Solo per un numero semplice, non per le operazioni. */
function conDecimali(e){
  if(!e) return "0";
  const i = e.indexOf(",");
  return i === -1 ? esc(e) : esc(e.slice(0,i)) + `<span class="dec">${esc(e.slice(i))}</span>`;
}

/* Totale del mese nella striscia in alto: conta fino alla cifra nuova invece di cambiare di colpo. */
const fabOk = { fino: 0, testo: "" };
let totMostrato = null, totAnim = 0, totVerso;
function mostraTotale(t){
  const scrivi = x => { const el = $("mtot"); if(el) el.textContent = eur(x); };
  const piano = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(totMostrato === null || piano || Math.abs(t - totMostrato) < 0.005){
    totMostrato = t; scrivi(t);
  } else if(totVerso === undefined || Math.abs(t - totVerso) > 0.005){
    const da = totMostrato, inizio = performance.now(), durata = 650;
    totVerso = t; cancelAnimationFrame(totAnim);
    const passo = ora => {
      const k = Math.min(1, Math.max(0, (ora - inizio) / durata)), e = 1 - Math.pow(1 - k, 3);
      totMostrato = da + (t - da) * e; scrivi(totMostrato);
      if(k < 1) totAnim = requestAnimationFrame(passo); else { totMostrato = t; totVerso = undefined; }
    };
    totAnim = requestAnimationFrame(passo);
  }
}

const GIORNI = ["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"];

/* ══════════ rotelle giorno / mese ══════════ */
const ALT = 44;                       // altezza di ogni voce, in pixel

function giorniDelMese(m, a){
  return new Date(a || getAnno(), m, 0).getDate();     // tiene conto degli anni bisestili
}

function costruisciRuota(el, voci, sceltoIdx, onScelta){
  const pad = (132 - ALT) / 2;
  el.innerHTML = `<div style="height:${pad}px"></div>` +
    voci.map((v,i)=>`<div class="wopt" data-i="${i}">${v}</div>`).join("") +
    `<div style="height:${pad}px"></div>`;

  const opts = [...el.querySelectorAll(".wopt")];
  const evidenzia = i => opts.forEach((o,j)=>o.classList.toggle("sel", j===i));

  // Posiziona la rotella con lo snap disattivato: se resta attivo, il browser
  // può ignorare lo scrollTop e riportare la selezione alla prima voce.
  let pronto = false;
  el.style.scrollSnapType = "none";
  el.scrollTop = sceltoIdx * ALT;
  evidenzia(sceltoIdx);

  requestAnimationFrame(() => {
    el.scrollTop = sceltoIdx * ALT;          // seconda passata, a layout avvenuto
    el.style.scrollSnapType = "y mandatory";
    setTimeout(() => { pronto = true; }, 120);
  });

  let t;
  el.onscroll = () => {
    const i = Math.max(0, Math.min(voci.length-1, Math.round(el.scrollTop / ALT)));
    evidenzia(i);
    if(!pronto) return;                       // ignora gli scorrimenti di assestamento
    clearTimeout(t);
    t = setTimeout(() => {
      vibra("rotella");
      onScelta(i);
    }, 130);
  };
  el.onclick = e => {
    const o = e.target.closest(".wopt"); if(!o) return;
    el.scrollTo({ top: Number(o.dataset.i) * ALT, behavior:"smooth" });
  };
}

function ruotaMesi(){
  const m = parseInt($("mm").value,10) || new Date().getMonth()+1;
  costruisciRuota($("wmm"), MESI, m-1, i => {
    const nuovo = i+1;
    if(parseInt($("mm").value,10) === nuovo) return;
    $("mm").value = nuovo;
    $("yy").value = annoPerMese(nuovo);
    // se il giorno non esiste nel nuovo mese, lo riporta all'ultimo valido
    const max = giorniDelMese(nuovo);
    if(parseInt($("dd").value,10) > max) $("dd").value = max;
    ruotaGiorni();
    riep = null; refresh(); paint();
  });
}

function ruotaGiorni(){
  const m = parseInt($("mm").value,10) || new Date().getMonth()+1;
  const max = giorniDelMese(m);
  const d = Math.min(parseInt($("dd").value,10) || 1, max);
  $("dd").value = d;
  const voci = Array.from({length:max},(_,i)=>String(i+1));
  costruisciRuota($("wdd"), voci, d-1, i => {
    $("dd").value = i+1;
    paint();
  });
}
function scriviData(m){
  const d = parseInt($("dd").value,10);
  const box = $("dfull"), ic = $("dIco");
  const errore = t => { ic.textContent = "error"; ic.style.color = "var(--bad)"; box.innerHTML = `<span style="color:var(--bad)">${t}</span>`; };
  if(!(m>=1 && m<=12) || !(d>=1 && d<=31)){ errore("Data incompleta"); return; }
  const anno = getAnno();
  const dt = new Date(anno, m-1, d);
  // se il giorno non esiste in quel mese (es. 31 novembre) JS scivola al mese dopo
  if(dt.getMonth() !== m-1){ errore(`Il ${d} non esiste a ${MESI[m-1].toLowerCase()}`); return; }
  const oggi = new Date();
  const eOggi = dt.toDateString() === oggi.toDateString();
  ic.textContent = eOggi ? "today" : "event"; ic.style.color = "";
  box.innerHTML = (eOggi ? `<b>Oggi</b> · ` : ``) + `${GIORNI[dt.getDay()]} <b>${d} ${MESI[m-1].toLowerCase()}${anno !== new Date().getFullYear() ? " " + anno : ""}</b>`;
}

function icona(primary){
  const c = col(primary);
  return `<span class="qd" style="background:${c}"><span class="ms f">${ico(primary)}</span></span>`;
}

function renderList(){
  const inCoda = coda.map(c => {
    const et = c.stato==="invio"  ? '<span class="st inv">scrivo…</span>'
             : c.stato==="errore" ? '<span class="st err2">non passata</span>'
             : '<span class="st att">in coda</span>';
    return `<div class="riga pend ${c.stato}">${icona(c.primary)}
      <span class="tx"><div class="t1">${esc(c.spesa.desc)}${et}</div>
      <div class="t2">${c.spesa.d}/${c.spesa.m} · ${esc(c.secondary)} · ${esc(c.spesa.broker)}${c.errore ? " · " + esc(c.errore) : ""}</div></span>
      <span class="v">${it(c.spesa.v)}</span></div>`;
  }).join("");

  const errori = coda.filter(c=>c.stato==="errore").length;
  const riprovaBtn = errori
    ? `<button class="btn tenue rip" style="width:100%;margin:0 0 10px"
        onclick="riprova()"><span class="ms">refresh</span>Riprova le ${errori} non passate</button>` : "";

  $("codainfo").innerHTML = coda.length ? `${coda.length} in coda` : "";
  $("dupLast").disabled = !ultime.length;

  // ricerca: con un testo nel campo mostra solo le spese che lo contengono
  const q = ($("listQ").value || "").trim().toLowerCase();
  $("listQClear").style.display = q ? "" : "none";
  const trova = e => !q || [e.desc, e.primary, e.secondary, e.broker, e.note]
    .some(x => String(x || "").toLowerCase().indexOf(q) !== -1);
  const filtrate = ultime.filter(trova);

  // un'intestazione per giorno ("Oggi", "Ieri", "sab 10 ott") con il totale delle spese mostrate
  const oggiD = new Date(), ieriD = new Date(); ieriD.setDate(ieriD.getDate()-1);
  const nomeGiorno = e => {
    const dt = new Date(e.a || getAnno(), e.m-1, e.d);
    if(dt.toDateString() === oggiD.toDateString()) return "Oggi";
    if(dt.toDateString() === ieriD.toDateString()) return "Ieri";
    return GIORNI[dt.getDay()].slice(0,3) + " " + e.d + " " + MESI3[e.m-1].toLowerCase();
  };
  const chiave = e => (e.a||"") + "-" + e.m + "-" + e.d;
  const somme = {};
  filtrate.forEach(e => somme[chiave(e)] = (somme[chiave(e)]||0) + (Number(e.v)||0));
  // l'ultimo giorno dell'elenco può essere incompleto (si vedono solo le ultime 12): lì niente totale
  const ultimaChiave = filtrate.length ? chiave(filtrate[filtrate.length-1]) : "";
  const incompleto = !q && ultime.length >= 12;
  const testa = (e,i) => (i===0 || chiave(filtrate[i-1]) !== chiave(e))
    ? `<div class="giorno"><span>${nomeGiorno(e)}</span>${
        (incompleto && chiave(e)===ultimaChiave) ? "" : `<b>${eur(somme[chiave(e)])}</b>`}</div>` : "";

  const scritte = filtrate.map((e,i) => testa(e,i) +
    `<div class="riga ripeti" data-u="${ultime.indexOf(e)}" role="button" tabindex="0" title="Tocca per registrarla di nuovo">${icona(e.primary)}
      <span class="tx"><div class="t1">${esc(e.desc)}</div>
      <div class="t2">${esc(e.secondary||e.primary)} · ${esc(e.broker)}${e.note ? " · " + esc(e.note) : ""}</div></span>
      <span class="v">${it(e.v)}</span>
      ${(i===0 && !q && e.annullabile && !coda.length)
        ? `<button class="tondo rip" onclick="annulla()" title="Annulla" aria-label="Annulla"><span class="ms">undo</span></button>`
        : ``}</div>`).join("");

  const vista_coda = q || !inCoda ? "" : `<div class="giorno"><span>In coda</span><b>${eur(coda.reduce((t,c)=>t+(Number(c.spesa.v)||0),0))}</b></div>` + inCoda;
  $("list").innerHTML = (vista_coda || scritte)
    ? riprovaBtn + `<div class="lista">${vista_coda}${scritte}</div>`
    : q ? `<div class="vuoto"><span class="ms">search_off</span>Nessuna spesa con «${esc(q)}» tra le ultime registrate.</div>`
        : `<div class="vuoto"><span class="ms">receipt_long</span>Nessuna spesa nel foglio.</div>`;
}
