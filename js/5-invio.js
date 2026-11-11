/* ══════════ FOGLIO «NUOVA SPESA» ══════════
   Sul telefono il modulo (importo, voce, tastierino, conto, data, nota) non sta
   più in pagina: sale dal basso quando serve. Lo aprono il tasto «Nuova spesa»,
   il tocco su un pagamento Wallet, su una ricorrente o su una spesa già
   registrata. Il tasto Indietro di Android lo chiude. Su PC resta in pagina. */
const foglioLargo = () => window.matchMedia && matchMedia("(min-width:980px)").matches;
function apriFoglio(){
  const f = $("foglio");
  if(foglioLargo() || f.classList.contains("on")) return;
  f.classList.add("on"); f.setAttribute("aria-hidden", "false");
  document.body.classList.add("foglio-aperto");
  f.querySelector(".foglio-in").scrollTop = 0;
  try{ history.pushState({ foglio: true }, ""); }catch(e){}
}
function chiudiFoglio(daIndietro){
  const f = $("foglio");
  if(!f || !f.classList.contains("on")) return;
  f.classList.remove("on"); f.setAttribute("aria-hidden", "true");
  document.body.classList.remove("foglio-aperto");
  if(!daIndietro){ try{ if(history.state && history.state.foglio) history.back(); }catch(e){} }
}
window.addEventListener("popstate", () => chiudiFoglio(true));
/* Sul telefono il foglio sta fuori dalle schede (figlio diretto della pagina), così copre
   anche la barra in basso; su PC torna dentro la scheda Oggi, prima delle spese registrate. */
function collocaFoglio(){
  const f = $("foglio"), v = $("viewAdd"), dentro = f.parentNode === v;
  if(foglioLargo() && !dentro){ chiudiFoglio(); v.insertBefore(f, v.querySelector("section.sez")); }
  else if(!foglioLargo() && dentro) document.body.appendChild(f);
}
collocaFoglio();
if(window.matchMedia){
  const mqF = matchMedia("(min-width:980px)");
  if(mqF.addEventListener) mqF.addEventListener("change", collocaFoglio); else if(mqF.addListener) mqF.addListener(collocaFoglio);
}
$("apriFoglio").onclick = () => { vibra("tap"); apriFoglio(); };
$("foglioX").onclick = () => chiudiFoglio();
$("foglio").addEventListener("click", e => { if(e.target === $("foglio")) chiudiFoglio(); });
document.addEventListener("keydown", e => { if(e.key === "Escape") chiudiFoglio(); });

function showErr(m){ $("errbox").innerHTML = `<div class="err"><span>${esc(m)}</span></div>`; }
function showNota(m){ $("errbox").innerHTML = `<div class="avv"><span class="ms">account_balance_wallet</span><span>${esc(m)}</span></div>`; }
function clearErr(){ $("errbox").innerHTML = ""; }

$("fab").onclick = () => {
  const v = val(), voce = voceScelta();
  if(!(v>0 && voce)) return;
  clearErr();
  coda.push({
    id: Date.now()+"-"+Math.random().toString(36).slice(2,7),
    stato:"attesa", primary:voce.primary, secondary:voce.secondary,
    spesa:{ idem: null,
            a: getAnno(),
            m: parseInt($("mm").value,10) || new Date().getMonth()+1,
            d: parseInt($("dd").value,10) || new Date().getDate(),
            desc: voce.entry, v: v, broker: broker, note: $("note").value.trim(),
            walletId: walletCorrente || undefined }
  });
  coda[coda.length-1].spesa.idem = coda[coda.length-1].id;
  walletCorrente = null; renderWallet();
  salvaCoda();
  espr=""; $("desc").value=""; $("note").value="";
  cercaAperta = false; $("cercaBox").hidden = true;
  // il totale in testata riguarda solo il mese mostrato
  if(coda[coda.length-1].spesa.m === parseInt($("mm").value,10))
    totali.totale = (totali.totale||0) + v;
  invalida("sum", "year");
  vibra("invio");
  fabOk.fino = Date.now() + 1100; fabOk.testo = eur(v);
  setTimeout(chiudiFoglio, 650);   // il tempo di vedere la conferma sul tasto
  setTimeout(paint, 1150);
  paint(); drena();
};

/* Testo sullo scalo della liquidità restituito da aggiungiSpesa. */
function testoLiquidita(l){
  if(!l || !l.fatto) return "";
  return " · " + l.conto + " " + eur0(l.prima) + " → " + eur(l.dopo);
}

function drena(){
  if(inviando) return;
  const item = coda.find(c => c.stato==="attesa");
  if(!item) return;
  inviando = true; item.stato = "invio"; salvaCoda(); paint();

  google.script.run
    .withSuccessHandler(res => {
      inviando = false;
      if(!res.ok){
        item.stato="errore"; item.errore=res.errore;
        showErr(res.errore); toast(res.errore, true); vibra("errore");
      } else {
        if(res.mese === parseInt($("mm").value,10)){ totali = res.totali; totaliChiave = res.mese + "-" + (res.anno || item.spesa.a); }
        ultime.unshift({m:item.spesa.m,d:item.spesa.d,desc:item.spesa.desc,v:item.spesa.v,
          broker:item.spesa.broker,primary:res.primary,secondary:res.secondary,
          riga:res.riga, idem:item.spesa.idem, a:res.anno || item.spesa.a, annullabile:true,
          walletId:item.spesa.walletId});
        ultime = ultime.slice(0,12);
        coda = coda.filter(c => c.id !== item.id);
        // spesa scritta: Mese e Anno si rileggono in sottofondo (quando la coda è vuota)
        invalida("sum", "year");
        if(!coda.some(c => c.stato==="attesa")) precaricaTutto();
        if(item.spesa.walletId){ wallet = wallet.filter(w => w.id !== item.spesa.walletId); renderWallet(); }
        ricRegistrata(item.spesa);
        toast("Riga " + res.riga + " · " + res.secondary + testoLiquidita(res.liquidita));
        vibra("ok");
        controllaBudget(res, Number(item.spesa.v) || 0);
        // la spesa è scritta, ma il saldo non è stato scalato: lo dice senza bloccare
        if(res.liquidita && !res.liquidita.fatto && res.liquidita.motivo)
          showNota("Saldo non aggiornato: " + res.liquidita.motivo);
      }
      salvaCoda(); paint(); drena();
    })
    .withFailureHandler(err => {
      inviando = false;
      // senza rete la spesa resta in coda e riparte da sola quando torna la connessione
      if(err && err.rete){
        item.stato = "attesa"; salvaCoda(); paint();
        toast(navigator.onLine ? err.message : "Offline: la spesa resta in coda", true);
        return;
      }
      item.stato="errore"; item.errore=String(err.message||err);
      showErr(item.errore); toast("Una spesa non è passata", true); vibra("errore");
      salvaCoda(); paint(); drena();
    })
    .aggiungiSpesa(item.spesa);
}
async function annulla(){
  const e = ultime[0];
  if(!e || !e.annullabile) return;
  const si = await chiedi("Annullare la spesa?",
    "«" + e.desc + "» da " + eur(e.v) + ": ripulisco la riga " + e.riga +
    " e rimetto l'importo sul saldo di " + e.broker + ".", "undo", "Annulla spesa");
  if(!si) return;

  google.script.run
    .withSuccessHandler(res => {
      if(!res.ok){ toast(res.errore, true); return; }
      if(res.totali && e.m === parseInt($("mm").value,10)) totali = res.totali;
      ultime.shift();
      invalida("sum", "year");
      clearErr(); paint(); precaricaTutto();
      // presa da Wallet: il pagamento torna fra quelli da confermare
      if(e.walletId) google.script.run.withSuccessHandler(() => caricaWallet())
        .withFailureHandler(() => {}).riapriWallet(e.walletId);
      caricaRicorrenti();   // se era una ricorrente, torna fra quelle da registrare
      toast("Riga " + e.riga + " annullata" + (res.liquidita && res.liquidita.fatto ? " · saldo ripristinato" : ""));
    })
    .withFailureHandler(err => toast(String(err.message||err), true))
    .annullaRiga(e.riga, e.idem, e.m, e.a || getAnno());
}

function riprova(){
  coda.forEach(c => { if(c.stato==="errore") c.stato="attesa"; });
  clearErr(); salvaCoda(); paint(); drena();
}
window.addEventListener("beforeunload", e => {
  if(coda.length){ e.preventDefault(); e.returnValue=""; }
});

function refresh(){
  const m = parseInt($("mm").value,10) || new Date().getMonth()+1;
  const anno = getAnno();
  google.script.run
    .withSuccessHandler(st => {
      totali=st.totali; voci=st.voci||[]; totaliChiave = m + "-" + anno;
      // ogni spesa ricorda l'anno (cioè la scheda) da cui viene: serve per annullarla
      ultime=(st.ultime||[]).map(e => Object.assign({a: anno}, e));
      if(st.conti && st.conti.length){ conti = st.conti; renderConti(); }
      if(Array.isArray(st.wallet)){ wallet = st.wallet; renderWallet(); }
      caricaRicorrenti();
      // voci e conti ricordati: servono per registrare spese anche offline
      // e totali/ultime spese del mese: alla prossima apertura si vedono subito,
      // mentre il foglio risponde in sottofondo
      try{ localStorage.setItem(CHIAVE_STATO, JSON.stringify({voci:voci, conti:st.conti||[],
        m:m, a:anno, totali:totali, ultime:ultime})); }catch(e){}
      clearErr(); paint();
      if(vista === "sum" && riep && catAperte.size) sicuro(renderCategorie);   // sottocategorie aperte
      aggiornaBudgetInSottofondo();
      precaricaTutto();
    })
    .withFailureHandler(err => {
      if(err && err.rete && voci.length){
        toast(navigator.onLine ? err.message : "Offline: puoi registrare, invio appena torna la rete", true);
      } else {
        showErr(err.message||err);
        toast("Non riesco a leggere il foglio", true);
      }
      paint();
    })
    .statoIniziale(m, getAnno());
}
