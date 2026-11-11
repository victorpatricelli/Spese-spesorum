/* ══════════ navigazione ══════════ */
/* Testata: una riga piccola di contesto sopra il titolo grande della scheda. */
function aggiornaTesta(){
  const n = new Date();
  const m = parseInt($("mm").value,10) || n.getMonth()+1, a = getAnno();
  const oggiLungo = GIORNI[n.getDay()] + " " + n.getDate() + " " + MESI[n.getMonth()].toLowerCase();
  const t = {
    add:  ["Oggi", oggiLungo],
    sum:  [MESI[m-1] + (a !== n.getFullYear() ? " " + a : ""), "Riepilogo del mese"],
    year: [annoSel ? String(annoSel) : "Anno", "Spese per anno"],
    port: pagPort === 0 ? ["Portafoglio", setDati ? "Riepilogo del weekend" : "Riepilogo: sabato e domenica"]
        : !portLibero() ? ["Portafoglio", "Una volta al giorno"]
        : ["Portafoglio", port && port.aggiornato ? "aggiornato alle " + (String(port.aggiornato).split(" ")[1] || port.aggiornato) : "Investimenti"],
    buy:  ["Acquisto", "Registra titoli comprati"]
  }[vista] || ["Spese", ""];
  $("ptitle").textContent = t[0];
  $("tsopra").textContent = t[1];
}
$("nav").onclick = e => {
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.v === vista) return;
  vista = b.dataset.v;
  [...$("nav").querySelectorAll("button")].forEach(t=>{
    // Acquisto non ha più un tasto suo: è una pagina del Portafoglio
    const qui = t.dataset.v === (vista === "buy" ? "port" : vista);
    t.classList.toggle("on", qui);
    if(qui) t.setAttribute("aria-current","page"); else t.removeAttribute("aria-current");
  });
  ["add","sum","year","port","buy"].forEach(k => {
    const el = $({add:"viewAdd",sum:"viewSum",year:"viewYear",port:"viewPort",buy:"viewBuy"}[k]);
    el.hidden = vista!==k;
    if(vista===k){ el.classList.remove("view"); void el.offsetWidth; el.classList.add("view"); }
  });
  // il pulsante Aggiungi fisso in basso esiste solo nella scheda Aggiungi
  $("ctaBar").hidden = vista !== "add";
  document.body.classList.toggle("con-cta", vista === "add");
  chiudiFoglio();
  window.scrollTo({top:0});
  sicuro(aggiornaTesta);
  sicuro(() => {
    if(vista==="sum")  caricaRiepilogo();
    if(vista==="year") caricaAnni();
    if(vista==="port") mostraPaginaPort();
    if(vista==="buy")  caricaAcquisto();
  });
};
window.addEventListener("scroll", () => $("appbar").classList.toggle("su", window.scrollY > 4), {passive:true});

/* Indicatore della barra in basso: si sposta sotto la scheda scelta. */
function muoviIndicatore(){
  const b = $("nav").querySelector("button.on"), ind = $("navInd");
  if(!b || !ind) return;
  const box = $("nav").getBoundingClientRect(), r = b.getBoundingClientRect();
  ind.style.width = r.width + "px"; ind.style.height = r.height + "px";
  ind.style.transform = `translate(${r.left - box.left - $("nav").clientLeft}px, ${r.top - box.top - $("nav").clientTop}px)`;
  if(!ind.classList.contains("pronto")) requestAnimationFrame(() => ind.classList.add("pronto"));
}
$("nav").addEventListener("click", () => requestAnimationFrame(muoviIndicatore));
$("vaiAcquisto").onclick = () => { $("nav").querySelector('[data-v="buy"]').click(); requestAnimationFrame(muoviIndicatore); };
$("tornaPort").onclick = () => { $("nav").querySelector('[data-v="port"]').click(); requestAnimationFrame(muoviIndicatore); };
window.addEventListener("resize", muoviIndicatore);
if(document.fonts && document.fonts.ready) document.fonts.ready.then(muoviIndicatore);
