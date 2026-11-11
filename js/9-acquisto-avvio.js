/* ══════════ ACQUISTO ══════════
   Registra un acquisto di titoli: il foglio aggiorna Pz. Carico e Quote in
   PORTAFOGLIO, le quote nei mesi della scheda dell'anno e, se scelto,
   la liquidità del conto. Tutti i calcoli veri li rifà lo script. */
let acq = null, acqTit = "", acqConto = "", acqInvio = false;

/* "1.234,56" → 1234.56 · "131.2" → 131.2 · "" → NaN */
function acqNum(s){
  s = String(s || "").trim().replace(/\s/g, "");
  if(!s) return NaN;
  if(s.indexOf(",") !== -1) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}
const acqFmt = (n, d) => Number(n).toLocaleString("it-IT", {minimumFractionDigits:d, maximumFractionDigits:d});
const acqQ = n => acqFmt(n, n % 1 ? 4 : 0);
const acqSym = v => v === "USD" ? "$" : "€";
const acqTitolo = () => acq && acq.titoli.find(t => t.nome === acqTit);

function caricaAcquisto(forza, sottofondo){
  if(acq && !forza){ if(!sottofondo) renderAcquisto(); if(!vecchi.buy) return; }
  const p = prendi("buy", "acqStato", [], forza);
  p.then(d => { if(!valida("buy", p)) return; vecchi.buy = false; acq = d; if(vista === "buy") renderAcquisto(); },
    err => {
      if(!valida("buy", p) || vista !== "buy" || acq) return;
      $("acqTit").innerHTML = `<div class="err" style="width:100%;margin:0"><span>${esc(err.message||err)}</span></div>`;
    });
}

function renderAcquisto(){
  if(acqTit && !acqTitolo()) acqTit = "";
  $("acqTit").innerHTML = acq.titoli.map(t =>
    `<button class="chip rip${t.nome===acqTit?" on":""}" data-n="${esc(t.nome)}">${esc(t.nome)}</button>`).join("")
    || `<div class="vuoto" style="width:100%">Nessun titolo in PORTAFOGLIO.</div>`;

  if(acqConto && acq.conti.indexOf(acqConto) === -1) acqConto = "";
  $("acqConti").innerHTML = [""].concat(acq.conti).map(c =>
    `<button class="chip rip${c===acqConto?" on":""}" data-c="${esc(c)}">${c ? esc(c) : "Non scalare"}</button>`).join("");

  if(!$("acqD").value) $("acqD").value = acq.oggi;
  if(!$("acqFx").value && acq.cambio) $("acqFx").value = acqFmt(acq.cambio, 4);

  const u = acq.ultimo;
  $("acqUlt").innerHTML = u ? `<div class="lista"><div class="riga">
      <div class="qd" style="background:var(--sheet-2);color:var(--ink-2)"><span class="ms">shopping_bag</span></div>
      <div class="tx"><div class="t1">${esc(u.titolo)} · ${acqQ(Number(u.quote))} q</div>
        <div class="t2">${esc(/^\d{4}-\d{2}-\d{2}$/.test(String(u.data)) ? dataLunga(u.data) : u.data)} · ${acqFmt(Number(u.prezzo), 2)} ${acqSym(u.valuta)}${u.eur ? " · " + eur(Number(u.eur)) : ""}</div></div>
      <button class="tondo rip" id="acqUndo" aria-label="Annulla l'ultimo acquisto"><span class="ms">undo</span></button>
    </div></div>` : `<div class="vuoto">Nessun acquisto registrato dall'app.</div>`;
  if($("acqUndo")) $("acqUndo").onclick = acqAnnulla;

  acqAnteprima();
}

function acqAnteprima(){
  const t = acqTitolo();
  const usd = !!t && t.valuta === "USD";
  $("acqFxBox").style.display = usd ? "" : "none";
  $("acqPlab").textContent = "Prezzo" + (t ? " " + acqSym(t.valuta) : "");
  $("acqPic").textContent = usd ? "attach_money" : "euro";
  $("acqHint").textContent = t && t.ticker ? t.ticker : "";
  $("acqPos").style.display = t ? "" : "none";
  if(t) $("acqPos").innerHTML = `<span class="ms">inventory_2</span>Ora <b>${acqQ(t.quote)} quote</b> a <b>${acqFmt(t.pz, 2)} ${acqSym(t.valuta)}</b>`;
  $("acqContoHint").textContent = acqConto ? "nel mese dell'acquisto" : "facoltativo";

  const q = acqNum($("acqQ").value), p = acqNum($("acqP").value);
  const c = $("acqC").value.trim() ? acqNum($("acqC").value) : 0;
  const fx = acqNum($("acqFx").value);
  const ok = !!t && q > 0 && p > 0 && c >= 0 && (!usd || fx > 0) && !!$("acqD").value;
  $("acqGo").disabled = !ok || acqInvio;
  $("acqPrev").className = ok ? "inch acq-prev" : "carta acq-prev";
  if(!ok){
    $("acqPrev").innerHTML = `<div class="acq-vuota"><span class="ms">info</span>${!t ? "Scegli il titolo." :
      !(q > 0) ? "Inserisci le quote." : !(p > 0) ? "Inserisci il prezzo." :
      !(c >= 0) ? "Commissioni non valide." : usd && !(fx > 0) ? "Inserisci il cambio EUR/USD." : "Scegli la data."}</div>`;
    return;
  }

  const qd = t.quote + q;
  const pz = (t.pz * t.quote + p * q + c * (usd ? fx : 1)) / qd;
  const tot = usd ? p * q / fx + c : p * q + c;
  const freccia = `<span class="ms">arrow_forward</span>`;
  $("acqPrev").innerHTML =
    `<div class="inch-sopra"><span>Spendi${c ? ", commissioni incluse" : ""}</span><span>${esc(t.nome)}</span></div>` +
    `<div class="inch-big" style="font-size:38px;line-height:44px;margin:4px 0 8px">${eur(tot)}</div>` +
    `<div class="acq-row"><span>Quote</span><b>${acqQ(t.quote)}${freccia}${acqQ(qd)}</b></div>` +
    `<div class="acq-row"><span>Pz. carico</span><b>${acqFmt(t.pz, 2)}${freccia}${acqFmt(pz, 2)} ${acqSym(t.valuta)}</b></div>` +
    (usd ? `<div class="acq-row"><span>In dollari</span><b>${acqFmt(p*q, 2)} $ a ${acqFmt(fx, 4)}</b></div>` : ``) +
    (acqConto ? `<div class="acq-row"><span>Scalato da</span><b>${esc(acqConto)}</b></div>` : ``);
}

$("acqTit").onclick = e => {
  const b = e.target.closest("[data-n]"); if(!b) return;
  acqTit = acqTit === b.dataset.n ? "" : b.dataset.n;
  [...$("acqTit").children].forEach(x => x.classList.toggle("on", x.dataset.n === acqTit));
  acqAnteprima();
};
$("acqConti").onclick = e => {
  const b = e.target.closest("[data-c]"); if(!b) return;
  acqConto = b.dataset.c;
  [...$("acqConti").children].forEach(x => x.classList.toggle("on", x.dataset.c === acqConto));
  acqAnteprima();
};
["acqQ","acqP","acqC","acqFx","acqD"].forEach(id => $(id).addEventListener("input", acqAnteprima));

$("acqGo").onclick = () => {
  if(acqInvio || $("acqGo").disabled) return;
  const t = acqTitolo();
  const dati = {
    titolo: acqTit, data: $("acqD").value,
    quote: acqNum($("acqQ").value), prezzo: acqNum($("acqP").value),
    commissioni: $("acqC").value.trim() ? acqNum($("acqC").value) : 0,
    cambio: t && t.valuta === "USD" ? acqNum($("acqFx").value) : null,
    conto: acqConto,
    idem: Date.now() + "-" + Math.random().toString(36).slice(2)
  };
  acqInvio = true; $("acqGo").disabled = true; $("acqGoTxt").textContent = "Scrivo nel foglio…";
  $("acqErr").innerHTML = "";
  const fine = () => { acqInvio = false; $("acqGoTxt").textContent = "Registra acquisto"; };
  google.script.run
    .withSuccessHandler(r => {
      fine();
      if(!r.ok){ $("acqErr").innerHTML = `<div class="err"><span>${esc(r.errore)}</span></div>`; acqAnteprima(); return; }
      vibra("ok");
      toast(r.titolo + ": " + acqQ(r.quoteDopo) + " q a " + acqFmt(r.pzDopo, 2) + " " + acqSym(r.valuta) +
            (r.conto ? " · −" + eur(r.controvaloreEur) + " da " + r.conto : ""));
      $("acqQ").value = ""; $("acqP").value = ""; $("acqC").value = "";
      invalida("port");                           // il portafoglio va riletto
      caricaAcquisto(true); caricaPortafoglio(false, true);
    })
    .withFailureHandler(err => {
      fine();
      $("acqErr").innerHTML = `<div class="err"><span>${esc(err.message||err)}</span></div>`;
      acqAnteprima();
    })
    .registraAcquisto(dati);
};

async function acqAnnulla(){
  const u = acq && acq.ultimo; if(!u) return;
  const si = await chiedi("Annullare l'acquisto?",
    u.titolo + " · " + acqQ(Number(u.quote)) + " quote del " + u.data +
    ". PORTAFOGLIO, mesi e liquidità tornano com'erano.", "undo", "Annulla acquisto");
  if(!si) return;
  google.script.run
    .withSuccessHandler(r => {
      if(!r.ok){ toast(r.errore, true); return; }
      toast("Acquisto annullato: " + r.titolo);
      invalida("port");
      caricaAcquisto(true); caricaPortafoglio(false, true);
    })
    .withFailureHandler(err => toast(String(err.message||err), true))
    .annullaUltimoAcquisto();
}

/* ══════════ budget ══════════ */
function renderBudgetFields(){
  if(!riep) return;
  const b = riep.budget || {};
  const nomi = ["TOTALE"].concat(Object.keys(b).filter(k=>k!=="TOTALE"));
  riep.categorie.forEach(c => { if(nomi.indexOf(c.nome)===-1) nomi.push(c.nome); });
  $("bfields").innerHTML = nomi.map(n =>
    `<div class="bedit"><label>${n==="TOTALE"?`<span class="qd sm" style="background:var(--ink);color:var(--paper)"><span class="ms">functions</span></span><b>Totale mese</b>`
      : `<span class="qd sm" style="background:${col(n)}"><span class="ms f">${ico(n)}</span></span>${esc(n)}`}</label>
      <input type="text" inputmode="numeric" data-b="${esc(n)}" value="${b[n]||""}" placeholder="—"></div>`).join("");
}
$("bopen").onclick = () => {
  const p = $("bpanel");
  p.hidden = !p.hidden;
  if(!p.hidden) renderBudgetFields();
};
$("bclose").onclick = () => { $("bpanel").hidden = true; };
$("bsave").onclick = () => {
  const v = [...$("bfields").querySelectorAll("input")].map(i=>({
    nome:i.dataset.b, valore:parseFloat(String(i.value).replace(",","."))
  })).filter(x=>x.valore>0);
  if(!v.length){ toast("Nessun valore valido", true); return; }
  $("bsave").disabled = true;
  google.script.run
    .withSuccessHandler(res => {
      $("bsave").disabled = false;
      if(!res.ok){ toast(res.errore, true); return; }
      $("bpanel").hidden = true; invalida("sum"); caricaRiepilogo(); toast("Budget salvato");
    })
    .withFailureHandler(err => { $("bsave").disabled=false; toast(String(err.message||err), true); })
    .salvaBudget(v);
};

let tt;
function toast(msg, bad){
  const t = $("toast");
  $("toasttxt").textContent = msg;
  t.querySelector(".ms").textContent = bad ? "error" : "check_circle";
  t.classList.toggle("bad", !!bad); t.classList.add("on");
  clearTimeout(tt); tt = setTimeout(()=>t.classList.remove("on"), msg.length > 60 ? 4000 : 2600);
}

/* cambio tema chiaro/scuro: rilegge i colori e ridisegna la vista aperta */
function ridisegna(){
  leggiPalette(); paint();
  if(vista==="sum" && riep) renderRiepilogo();
  if(vista==="year" && stat) renderAnni();
  if(vista==="port" && pagPort===1 && port && portLibero()) renderPortafoglio();
  if(vista==="port" && pagPort===0 && setDati) renderSettimana(false);
  if(vista==="buy" && acq) renderAcquisto();
}
if(window.matchMedia){
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  // con un tema scelto a mano, il cambio del telefono non conta
  const aggiorna = () => { if(pref.tema === "system"){ applicaTema("system"); ridisegna(); } };
  if(mq.addEventListener) mq.addEventListener("change", aggiorna); else if(mq.addListener) mq.addListener(aggiorna);
}

document.addEventListener("visibilitychange", () => {
  if(document.visibilityState!=="visible") return;
  // il portafoglio cambia ogni giorno: al rientro nell'app lo rilegge
  // in sottofondo anche se sei su un'altra scheda: i dati vecchi restano finché arrivano i nuovi
  caricaPortafoglio(true, vista!=="port");
  caricaAcquisto(true, vista!=="buy");
  caricaWallet();   // i pagamenti arrivati mentre l'app era chiusa
  caricaRicorrenti();
  if(vista==="port" && pagPort===0 && !setDati) caricaSettimana();
  if(vista==="port" && pagPort===1 && !portLibero()) caricaPortaLock();
  const n = new Date();
  if(parseInt($("mm").value,10) !== n.getMonth()+1){
    $("mm").value = n.getMonth()+1; $("dd").value = n.getDate(); $("yy").value = n.getFullYear();
    ruotaMesi(); ruotaGiorni();
    invalida("sum", "year"); refresh();
  }
  drena();
});

const now = new Date();
$("dd").value = now.getDate();
$("mm").value = now.getMonth()+1;
$("yy").value = now.getFullYear();
caricaCoda();
// voci e conti dell'ultima volta, così l'app è usabile subito (anche offline)
try{
  const st = JSON.parse(localStorage.getItem(CHIAVE_STATO) || "null");
  if(st){
    voci = st.voci || []; if(st.conti && st.conti.length){ conti = st.conti; renderConti(); }
    // totali e ultime spese salvati, se sono dello stesso mese: si vedono subito e
    // vengono sostituiti appena risponde il foglio. Finché non arriva la risposta
    // fresca l'annullamento resta spento (il numero di riga potrebbe essere cambiato).
    if(st.totali && st.m === now.getMonth()+1 && st.a === now.getFullYear()){
      totali = st.totali; totaliChiave = st.m + "-" + st.a;
      ultime = (st.ultime || []).map(e => Object.assign({}, e, {annullabile:false}));
    }
  }
}catch(e){}
sicuro(ruotaMesi);
sicuro(ruotaGiorni);
sicuro(paint);
// Mese, Anno, Portafoglio e Acquisto dell'ultima volta: a schermo subito, poi arrivano quelli freschi
sicuro(() => {
  if(!cfg.url || !cfg.pin) return;
  const s = datiRicordati("sum");  if(s && s.d && s.mese === chiaveMese()){ riep = s.d; riepChiave = s.mese; vecchi.sum = true; }
  const y = datiRicordati("year"); if(y && y.d && y.d.anni && y.d.anni.length){ stat = y.d; vecchi.year = true; }
  const f = datiRicordati("port"); if(f && f.d){ port = f.d; vecchi.port = true; }
  const b = datiRicordati("buy");  if(b && b.d){ acq = b.d; vecchi.buy = true; }
});
if(cfg.url && cfg.pin){ sicuro(refresh); sicuro(drena); precaricaTutto(); sicuro(salvaCfgSw); sicuro(attivaControlloInSottofondo); }
else apriImpostazioni();

/* Scorciatoie sull'icona (tenendola premuta): aprono direttamente una scheda. */
(function(){
  let v = null;
  try{ v = new URLSearchParams(location.search).get("v"); }catch(e){}
  const btn = v && v !== "add" ? $("nav").querySelector(`[data-v="${v}"]`) : null;
  if(btn && cfg.url && cfg.pin) btn.click();
  requestAnimationFrame(muoviIndicatore);
  document.body.classList.toggle("con-cta", vista === "add");
  $("ctaBar").hidden = vista !== "add";
  sicuro(aggiornaTesta);
})();

// rete tornata: invia la coda; e un tentativo ogni 30 secondi se resta qualcosa
window.addEventListener("online", () => { refresh(); drena(); });
setInterval(() => { if(coda.some(c => c.stato==="attesa")) drena(); }, 30000);
