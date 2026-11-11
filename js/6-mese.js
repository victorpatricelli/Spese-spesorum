/* ══════════ Chart.js ══════════ */
let chProj=null, chCat=null, chDay=null, chAnni=null, chCum=null, chCatAnno=null, chStor=null;
function chartDefaults(){
  if(!window.Chart) return false;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 11;
  Chart.defaults.color = P.testo2;
  Chart.defaults.borderColor = P.griglia;
  Chart.defaults.animation.duration = 700;
  Chart.defaults.animation.easing = "easeOutQuart";
  return true;
}
const grid = () => ({ color:P.griglia, drawTicks:false });
const tip = () => ({ backgroundColor:P.inv, borderWidth:0,
  titleColor:P.invTesto, bodyColor:P.invTesto, padding:10, cornerRadius:8,
  displayColors:false, titleFont:{weight:"600",size:12}, bodyFont:{size:12},
  boxPadding:4 });
function sfuma(ctx, area, hex){
  if(!area) return hex+"22";
  const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, hex+"47"); g.addColorStop(1, hex+"00");
  return g;
}
/* linea verticale tratteggiata sul giorno di oggi */
const lineaOggi = {
  id:"lineaOggi",
  afterDatasetsDraw(c, _, o){
    if(o.indice == null || o.indice < 0) return;
    const x = c.scales.x.getPixelForValue(o.indice), a = c.chartArea;
    const ctx = c.ctx; ctx.save();
    ctx.strokeStyle = P.testo3; ctx.lineWidth = 1; ctx.setLineDash([2,3]);
    ctx.beginPath(); ctx.moveTo(x, a.top+14); ctx.lineTo(x, a.bottom); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = P.testo2; ctx.font = "600 11px " + Chart.defaults.font.family;
    ctx.textAlign = x > a.right - 30 ? "right" : "center";
    ctx.fillText("oggi", x, a.top+8); ctx.restore();
  }
};
/* ══════════ MESE ══════════ */
const chiaveMese = () => (parseInt($("mm").value,10) || new Date().getMonth()+1) + "-" + getAnno();
let riepChiave = "";
function caricaRiepilogo(sottofondo){
  const vede = () => vista === "sum";
  if(!sottofondo) segmentiMesi();
  const k = chiaveMese();
  if(riep && riepChiave === k){ if(!sottofondo) renderRiepilogo(); if(!vecchi.sum) return; }
  if(!sottofondo && !(riep && riepChiave === k)){
    $("sumbody").innerHTML = `<div class="skel" style="height:190px"></div><div class="skel" style="height:220px"></div>`;
    $("sumcat").innerHTML = "";
  }
  const m = parseInt($("mm").value,10) || new Date().getMonth()+1;
  const p = prendi("sum", "riepilogoMese", [m, getAnno()], inVolo.sum && inVolo.sum.mese !== k);
  p.mese = k;
  p.then(r => {
    if(!valida("sum", p) || chiaveMese() !== k) return;   // nel frattempo è cambiato qualcosa
    if(!r){ riep = null; if(vede()) $("sumbody").innerHTML = `<div class="vuoto">Nessun dato per questo mese.</div>`; return; }
    vecchi.sum = false; riep = r; riepChiave = k; ricordaBudget(r.budget);
    if(vede()) renderRiepilogo();
    renderBudgetFields();
  }, err => {
    if(valida("sum", p) && vede() && !riep) $("sumbody").innerHTML = `<div class="err"><span>${esc(err.message||err)}</span></div>`;
  });
}

/* Andamento del mese:
   - linea piena: speso reale fino a oggi;
   - tratteggio: da oggi a fine mese, spese già programmate + ritmo normale
     (senza straordinarie, calcolato dallo script) per ogni giorno dopo oggi;
     finisce esattamente sulla proiezione mostrata sopra;
   - budget in linea retta solo se c'è un tetto. */
function graficoProiezione(r){
  if(!chartDefaults()) return;
  const gg = r.giorniMese, oggi = r.giorniTrascorsi, stato = r.stato || "corrente";
  const lab = Array.from({length:gg},(_,i)=>i+1);
  const ritmo = r.ritmo != null ? r.ritmo : r.media;

  const reale = stato==="futuro" ? lab.map(()=>null) : r.cumulata.map((v,i)=> i<oggi ? v : null);
  // giorno j (1…gg): cumulata[j-1] include già le spese programmate fino a quel giorno
  const proiez = stato==="chiuso" ? null
    : lab.map((j,i)=> j < Math.max(oggi,1) ? null : r.cumulata[i] + ritmo*(j-oggi));

  const sfora = r.tetto && r.proiezione > r.tetto;
  const tinta = sfora ? P.male : P.primario;

  const ds = [];
  if(stato!=="futuro") ds.push({label:"Speso",data:reale,borderColor:tinta,borderWidth:2.25,
    pointRadius:0,pointHoverRadius:5,pointHoverBorderWidth:2,pointHoverBorderColor:P.carta,pointHoverBackgroundColor:tinta,
    tension:.3,fill:true,backgroundColor:c=>sfuma(c.chart.ctx,c.chart.chartArea,tinta)});
  if(proiez) ds.push({label:"Proiezione",data:proiez,borderColor:tinta,borderWidth:2,borderDash:[5,4],
    pointRadius:0,pointHoverRadius:4,tension:.15,fill:false});
  if(r.tetto) ds.push({label:"Budget in linea retta",data:lab.map(j=> r.tetto*j/gg),borderColor:P.budget,borderWidth:1.25,
    borderDash:[2,3],pointRadius:0,pointHoverRadius:0,fill:false});

  if(chProj) chProj.destroy();
  chProj = new Chart($("cvProj"),{type:"line",data:{labels:lab,datasets:ds},plugins:[lineaOggi],
    options:{maintainAspectRatio:false,interaction:{mode:"index",intersect:false},
      layout:{padding:{top:4}},
      plugins:{legend:{display:false},lineaOggi:{indice: stato==="corrente" ? oggi-1 : null},
        tooltip:{...tip(),displayColors:true,boxWidth:8,boxHeight:8,usePointStyle:true,
        callbacks:{title:t=>t[0].label+" "+MESI[r.mese-1].toLowerCase(),
          label:c=>c.raw==null?null:c.dataset.label+": "+eur0(c.raw)}}},
      scales:{x:{grid:{display:false},border:{display:false},ticks:{maxTicksLimit:7,padding:6,maxRotation:0}},
        y:{grid:grid(),border:{display:false},beginAtZero:true,position:"right",
          ticks:{padding:6,maxTicksLimit:5,callback:v=>"€"+v.toLocaleString("it-IT")}}}}});

  // legenda HTML (l'identità non è mai affidata al solo colore)
  $("legProj").innerHTML = ds.map(d =>
    `<span><i class="lin" style="border-top-color:${d.borderColor};border-top-style:${d.borderDash?(d.borderDash[0]<3?"dotted":"dashed"):"solid"}"></i>${d.label}</span>`).join("");
}

/* Barre troppo alte (l'affitto del giorno 1 schiaccia tutto il resto):
   la scala si ferma poco sopra la seconda barra più alta, la barra tagliata
   porta il suo valore scritto in cima. */
const barreTagliate = {
  id:"barreTagliate",
  afterDatasetsDraw(c, _, o){
    if(!o.tetto) return;
    const ctx = c.ctx, meta = c.getDatasetMeta(0), dati = c.data.datasets[0].data;
    ctx.save(); ctx.font = "700 10.5px " + Chart.defaults.font.family; ctx.textAlign = "center";
    meta.data.forEach((b, i) => {
      if(!(dati[i] > o.tetto)) return;
      const y = c.chartArea.top;
      ctx.fillStyle = P.carta; ctx.fillRect(b.x - b.width/2 - 1, y + 5, b.width + 2, 3);   // lo "strappo"
      const t = "€" + Math.round(dati[i]).toLocaleString("it-IT");
      const w = ctx.measureText(t).width + 10;
      const x = Math.min(c.chartArea.right - w/2, Math.max(c.chartArea.left + w/2, b.x));
      ctx.fillStyle = P.inv; ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x - w/2, y - 13, w, 17, 6); else ctx.rect(x - w/2, y - 13, w, 17);
      ctx.fill(); ctx.fillStyle = P.invTesto; ctx.fillText(t, x, y);
    });
    ctx.restore();
  }
};
function graficoGiorni(r){
  if(!chartDefaults()) return;
  const oggi = r.giorniTrascorsi, stato = r.stato || "corrente";
  const ord = r.perGiorno.slice().sort((a,b) => b-a);
  const tetto = ord[1] > 0 && ord[0] > ord[1]*2.5 ? Math.ceil(ord[1]*1.25/50)*50 : null;
  if(chDay) chDay.destroy();
  chDay = new Chart($("cvDay"),{type:"bar",
    data:{labels:Array.from({length:r.giorniMese},(_,i)=>i+1),
      datasets:[{data:r.perGiorno,borderRadius:{topLeft:3,topRight:3},borderSkipped:"bottom",maxBarThickness:12,
        backgroundColor:r.perGiorno.map((_,i)=> stato==="corrente" && (i+1)===oggi ? P.primario
          : (i+1)>oggi ? P.altro : P.testo3)}]},
    options:{maintainAspectRatio:false,layout:{padding:{top:16}},
      plugins:{legend:{display:false},lineaOggi:{indice: stato==="corrente" ? oggi-1 : null},barreTagliate:{tetto},
        tooltip:{...tip(),callbacks:{
        title:t=>t[0].label+" "+MESI[r.mese-1].toLowerCase(),
        label:c=>c.raw?(Number(c.label)>oggi?"programmata "+eur(c.raw):eur(c.raw)):"nessuna spesa"}}},
      scales:{x:{grid:{display:false},border:{display:false},ticks:{maxTicksLimit:8,padding:4,maxRotation:0}},
        y:{grid:grid(),border:{display:false},beginAtZero:true,max:tetto || undefined,position:"right",
          ticks:{maxTicksLimit:4,padding:6,callback:v=>"€"+v.toLocaleString("it-IT")}}}},
    plugins:[lineaOggi, barreTagliate]});
}

/* Striscia di composizione: sempre nello stesso ordine di colore (non di classifica),
   così due colori vicini restano distinguibili anche per chi non vede bene i colori.
   Le categorie senza colore proprio finiscono insieme in «altro», in fondo. */
function striscia(categorie){
  const pezzi = [], altro = {valore:0};
  categorie.filter(c => c.valore > 0).forEach(c => { if(SLOT[c.nome]) pezzi.push(c); else altro.valore += c.valore; });
  pezzi.sort((a,b) => SLOT[a.nome] - SLOT[b.nome]);
  if(altro.valore > 0) pezzi.push({nome:"altro", valore:altro.valore});
  return `<div class="strip" role="img" aria-label="Composizione per categoria">${pezzi.map((p,i) =>
    `<i style="flex:${p.valore} 1 0;background:${p.nome==="altro"?P.altro:col(p.nome)};animation-delay:${i*40}ms" title="${esc(p.nome)} · ${eur0(p.valore)}"></i>`).join("")}</div>`;
}

/* Selettore del mese: i due precedenti, quello scelto e il successivo.
   Cambiare mese qui cambia anche la data proposta in Aggiungi (come la rotella). */
function segmentiMesi(){
  const m = parseInt($("mm").value,10) || new Date().getMonth()+1, a = getAnno();
  const n = new Date(), oraIdx = n.getFullYear()*12 + n.getMonth();
  // quanti mesi si vedono dipende dallo spazio (le frecce portano oltre)
  const passi = window.innerWidth >= 980 ? [-4,-3,-2,-1,0,1] : window.innerWidth < 440 ? [-1,0,1] : [-2,-1,0,1];
  const lista = passi.map(k => { const d = new Date(a, m-1+k, 1); return { m:d.getMonth()+1, a:d.getFullYear() }; });
  $("sumMesi").innerHTML = lista.map(x => {
    const futuro = x.a*12 + x.m-1 > oraIdx;
    const nome = MESI[x.m-1] + (x.a !== n.getFullYear() ? " ’" + String(x.a).slice(2) : "");
    return `<button type="button" class="${x.m===m && x.a===a ? "on" : ""}${futuro ? " fut" : ""}" data-m="${x.m}" data-a="${x.a}">${nome}</button>`;
  }).join("");
  // avanti al massimo un anno dopo il mese in corso (le spese programmate)
  $("meseDopo").disabled = a*12 + m-1 >= oraIdx + 12;
}
/* Frecce ‹ ›: un mese prima o dopo, senza limiti all'indietro. */
function spostaMese(passo){
  const m = parseInt($("mm").value,10) || new Date().getMonth()+1, a = getAnno();
  const d = new Date(a, m-1+passo, 1);
  vibra("tap");
  vaiAlMese(d.getMonth()+1, d.getFullYear());
  caricaRiepilogo();
}
$("mesePrima").onclick = () => spostaMese(-1);
window.addEventListener("resize", () => { if(vista === "sum") sicuro(segmentiMesi); });
/* Sul PC: frecce sinistra/destra della tastiera nella scheda Mese. */
document.addEventListener("keydown", e => {
  if(vista !== "sum" || e.ctrlKey || e.metaKey || e.altKey || document.querySelector(".scrim.on")) return;
  const t = e.target;
  if(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  if(e.key === "ArrowLeft"){ e.preventDefault(); $("mesePrima").click(); }
  if(e.key === "ArrowRight"){ e.preventDefault(); $("meseDopo").click(); }
});
$("meseDopo").onclick = () => { if(!$("meseDopo").disabled) spostaMese(1); };
$("sumMesi").onclick = e => {
  const b = e.target.closest("[data-m]"); if(!b || b.classList.contains("on")) return;
  vibra("tap");
  vaiAlMese(Number(b.dataset.m), Number(b.dataset.a));
  caricaRiepilogo();
};
function vaiAlMese(m, a){
  $("mm").value = m; $("yy").value = a;
  const max = giorniDelMese(m, a);
  if(parseInt($("dd").value,10) > max) $("dd").value = max;
  if(!$("picker").hidden){ ruotaMesi(); ruotaGiorni(); }
  riep = null; refresh(); paint();
}

/* Mese: carta d'inchiostro con speso, budget, passo e proiezione in una barra sola;
   il registro dei numeri; i due grafici; le categorie con il loro budget. */
function renderRiepilogo(){
  const r = riep, tetto = r.tetto, stato = r.stato || "corrente";
  const nomeMese = MESI[r.mese-1].toLowerCase();
  const spesoFinora = r.spesoAOggi != null ? r.spesoAOggi : r.totale;
  const pct = tetto ? r.totale/tetto : 0;
  // passo del budget: quanto avresti speso a oggi andando in linea retta verso il tetto
  const ideale = tetto ? tetto*r.giorniTrascorsi/r.giorniMese : 0;
  const scarto = spesoFinora - ideale;
  const p100 = x => Math.min(100, Math.max(0, x*100)).toFixed(1) + "%";

  /* ── carta d'inchiostro ── */
  const esito = !tetto ? "" : pct >= 1 ? `<span class="pill bad"><span class="ms">error</span>${eur0(r.totale-tetto)} oltre il budget</span>`
    : stato==="corrente" ? (scarto<=0 ? `<span class="pill good"><span class="ms">check</span>${eur0(-scarto)} sotto il passo</span>`
                                      : `<span class="pill warn"><span class="ms">speed</span>${eur0(scarto)} sopra il passo</span>`)
    : stato==="chiuso" ? `<span class="pill good"><span class="ms">savings</span>${eur0(tetto-r.totale)} avanzati</span>`
    : `<span class="pill neu">già impegnati</span>`;
  const progr = r.programmate>0 ? ` Contati anche <b>${eur0(r.programmate)}</b> registrati con data futura.` : "";
  const alGiorno = r.giorniRimasti > 0 ? r.residuo / r.giorniRimasti : 0;
  const nota = !tetto ? `Imposta il budget qui sotto per avere il passo, la proiezione e la quota di ogni giorno.`
    : stato==="chiuso" ? `Mese chiuso: budget di ${eur0(tetto)}, ${r.totale>tetto?"superato di":"avanzati"} <b>${eur0(Math.abs(tetto-r.totale))}</b>.`
    : r.residuo < 0 ? `Budget di ${eur0(tetto)} superato di <b>${eur0(-r.residuo)}</b>.` + progr
    : stato==="futuro" ? `Mese futuro: ${eur0(r.totale)} già programmati.`
    : `Restano <b>${eur0(r.residuo)}</b> per ${r.giorniRimasti} giorni, oggi incluso: <b>${eur0(alGiorno)} al giorno</b>.` + progr;
  const proiezPct = tetto && stato!=="chiuso" ? r.proiezione/tetto : 0;
  const hero = `<div class="inch">
    <div class="inch-sopra"><span>Speso a ${nomeMese}${r.anno !== new Date().getFullYear() ? " " + r.anno : ""}</span>
      <button type="button" class="pill neu rip" data-azione="budget">${tetto ? "Budget " + eur0(tetto) : "Imposta budget"}<span class="ms">edit</span></button></div>
    <div class="inch-big">${eur0(r.totale)}${tetto ? `<small>di ${eur0(tetto)}</small>` : `<small>${r.numSpese} spese</small>`}</div>
    ${tetto ? `<div class="inch-bar" role="img" aria-label="${Math.round(pct*100)}% del budget usato">
        ${proiezPct > pct ? `<i class="ombra" style="width:${p100(proiezPct)}"></i>` : ""}
        <i class="${pct>=1?"bad":pct>=.8?"warn":""}" style="width:${p100(pct)}"></i>
        ${stato==="corrente" ? `<span class="passo" style="left:${p100(ideale/tetto)}"></span>` : ""}</div>
      <div class="inch-righe"><span>${Math.round(pct*100)}% usato${stato==="corrente" ? ` · <i class="lg-passo"></i>passo ${eur0(ideale)}` : ""}</span>
        <span>${stato!=="chiuso" ? `<i class="lg-ombra"></i>proiezione ${eur0(r.proiezione)}` : r.numSpese + " spese"}</span></div>` : ""}
    ${esito ? `<div style="margin-top:12px">${esito}</div>` : ""}
    <div class="inch-nota">${nota}</div></div>`;

  /* ── registro dei numeri ── */
  const C = (icona, etichetta, valore, sotto, colore) => `<div>
    <div class="k"><span class="ms">${icona}</span>${etichetta}</div>
    <div class="v"${colore ? ` style="color:${colore}"` : ""}>${valore}</div>
    <div class="d">${sotto}</div></div>`;
  const cel = [];
  if(stato==="futuro"){
    cel.push(C("event_upcoming", "Già programmati", eur0(r.totale), r.numSpese + (r.numSpese===1 ? " spesa" : " spese") + " con data futura"));
    cel.push(C("trending_up", "Stima del mese", eur0(r.proiezione), "sul ritmo recente di " + eur0(r.ritmo||0) + " al giorno"));
  } else {
    if(stato==="chiuso")
      cel.push(C("local_fire_department", "Giorno più caro", eur0(r.piuCaro.valore), r.piuCaro.giorno ? "il " + r.piuCaro.giorno + " " + nomeMese : "—"));
    else {
      const sfora = tetto && r.proiezione > tetto;
      cel.push(C(sfora ? "warning" : "trending_up", "Proiezione", eur0(r.proiezione),
        tetto ? (sfora ? eur0(r.proiezione - tetto) + " oltre il budget" : eur0(tetto - r.proiezione) + " sotto il budget")
              : "ritmo " + eur0(r.ritmo||0) + " al giorno", sfora ? P.male : null));
    }
    /* Senza viaggi: il mese senza la categoria Travel, confrontato col budget. */
    const viaggi = Number((r.categorie.find(c => c.nome === "Travel") || {}).valore) || 0;
    if(viaggi > 0){
      const ord = r.totale - viaggi, oltreOrd = tetto && ord > tetto;
      cel.push(C("no_luggage", "Senza viaggi", eur0(ord), "esclusi " + eur0(viaggi) + " di viaggi" +
        (tetto ? (oltreOrd ? " · " + eur0(ord - tetto) + " oltre" : " · " + eur0(tetto - ord) + " sotto il budget") : ""), oltreOrd ? P.male : null));
    }
    if(r.confronto){
      const c = r.confronto, diff = c.attuale - c.precedente;
      const nomeM = MESI[c.mese-1].toLowerCase() + (c.anno!==r.anno ? " " + c.anno : "");
      cel.push(C(diff>0 ? "north_east" : "south_east", "Vs " + nomeM, segno(diff),
        (c.tipo==="pari giorno" ? "allo stesso giorno" : "mese intero") + " · allora " + eur0(c.precedente), diff>0 ? P.male : P.bene));
    }
    cel.push(C("functions", "Media al giorno", eur0(r.media), stato==="corrente" ? "fino a oggi, senza programmate" : "sul mese intero"));
    cel.push(C("event_busy", "Giorni a zero", String(r.giorniZero),
      stato==="corrente" ? "su " + Math.max(0, r.giorniTrascorsi-1) + " giorni, oggi escluso" : "su " + r.giorniMese + " giorni"));
    if(r.maxSpesa) cel.push(C("arrow_upward", "Spesa più grande", eur(r.maxSpesa.valore), esc(r.maxSpesa.desc) + " · il " + r.maxSpesa.giorno));
    if(r.minSpesa) cel.push(C("arrow_downward", "Spesa più piccola", eur(r.minSpesa.valore), esc(r.minSpesa.desc) + " · il " + r.minSpesa.giorno));
  }
  if(cel.length % 2) cel[cel.length-1] = cel[cel.length-1].replace("<div>", '<div class="largo">');

  /* ── grafici ── */
  const straord = r.straordinarie || {num:0,totale:0,soglia:100};
  const notaRitmo = stato==="chiuso" ? "" :
    `Il tratteggio aggiunge <b>${eur0(r.ritmo||0)}</b> per ogni giorno ${stato==="corrente"?"dopo oggi":"del mese"}` +
    (straord.num ? `: il tuo ritmo normale, senza ${straord.num} spes${straord.num===1?"a":"e"} una tantum (${eur0(straord.totale)})` : "") +
    (r.ritmoStorico!=null && r.giorniTrascorsi<14 ? `; nei primi giorni pesa anche la media dei mesi scorsi (${eur0(r.ritmoStorico)}/giorno)` : "") + ".";
  const legGiorni = `<div class="leg"><span><i style="background:${P.testo3}"></i>spese fatte</span>` +
    (stato==="corrente" ? `<span><i style="background:${P.primario}"></i>oggi</span>` : "") +
    (r.programmate>0 && stato!=="chiuso" ? `<span><i style="background:${P.altro}"></i>con data futura</span>` : "") + `</div>`;

  $("sumbody").innerHTML = hero +
    `<section class="sez"><div class="libro">${cel.join("")}</div></section>
    <section class="sez"><div class="carta">
      <div class="carta-t"><b>${stato==="chiuso"?"Andamento":"Andamento e proiezione"}</b>
        <span>${stato==="chiuso"?"speso cumulato":"ritmo " + eur0(r.ritmo||0) + "/giorno"}</span></div>
      <div class="cbox"><canvas id="cvProj" role="img" aria-label="Speso cumulato di ${nomeMese}"></canvas></div>
      <div class="leg" id="legProj"></div>
      ${notaRitmo ? `<div class="cnota">${notaRitmo}</div>` : ""}</div></section>
    <section class="sez"><div class="carta">
      <div class="carta-t"><b>Giorno per giorno</b>
        <span>${r.piuCaro.giorno ? "picco il " + r.piuCaro.giorno + " · " + eur0(r.piuCaro.valore) : ""}</span></div>
      <div class="cbox sm"><canvas id="cvDay" role="img" aria-label="Spese di ogni giorno di ${nomeMese}"></canvas></div>${legGiorni}</div></section>`;

  sicuro(renderCategorie);
  sicuro(aggiornaTesta);
  if(window.Chart){ graficoProiezione(r); graficoGiorni(r); }
  else $("sumbody").insertAdjacentHTML("beforeend",
    `<div class="err"><span>Non riesco a caricare la libreria dei grafici.</span></div>`);
}
/* Categorie del mese. Tocco su una categoria = si apre il dettaglio delle sottocategorie,
   preso dai totali per sottocategoria che il foglio manda con statoIniziale
   (gli stessi delle mattonelle in Aggiungi). Restano aperte cambiando mese. */
const catAperte = new Set();
let totaliChiave = "";          // mese-anno a cui si riferiscono «totali»
function sottoDi(nome){
  if(totaliChiave !== riepChiave) return null;               // totali di un altro mese: in arrivo
  const ps = (totali && totali.perSotto) || {};
  return Object.keys(ps).filter(k => k.split("|")[0] === nome && Number(ps[k]) > 0)
    .map(k => ({ nome: k.split("|").slice(1).join("|") || "—", valore: Number(ps[k]) }))
    .sort((x, y) => y.valore - x.valore);
}
function renderCategorie(){
  const r = riep; if(!r) return;
  const base = r.categorie.reduce((t,c) => t + c.valore, 0);
  const righe = r.categorie.map(c => {
    const b = r.budget[c.nome], colore = col(c.nome), oltre = b && c.valore > b;
    const scala = b ? Math.max(c.valore, b) : 0;
    const aperta = catAperte.has(c.nome);
    let sotto = "";
    if(aperta){
      const l = sottoDi(c.nome);
      sotto = `<div class="csotto">${!l ? `<div class="nessuna">Carico le sottocategorie…</div>`
        : !l.length ? `<div class="nessuna">Nessuna sottocategoria per questa categoria.</div>`
        : l.map(s => `<div class="srow"><b>${esc(s.nome)}</b><span>${eur(s.valore)}</span>
            <div class="trk"><i style="width:${(s.valore/l[0].valore*100).toFixed(1)}%;background:${colore}"></i></div>
            <small>${c.valore ? Math.round(s.valore/c.valore*100) : 0}% di ${esc(c.nome)}</small></div>`).join("")}</div>`;
    }
    return `<div class="crow apri${aperta?" aperta":""}" data-cat="${esc(c.nome)}" role="button" tabindex="0" aria-expanded="${aperta}">
      <span class="qd" style="background:${colore}"><span class="ms f">${ico(c.nome)}</span></span>
      <div class="nm"><b>${esc(c.nome)}</b><small>${base ? Math.round(c.valore/base*100) : 0}% del mese</small>
        ${b ? `<div class="trk"><i style="width:${(c.valore/scala*100).toFixed(1)}%;background:${oltre?P.male:colore}"></i>${oltre ? `<i class="tk" style="left:${(b/scala*100).toFixed(1)}%"></i>` : ""}</div>` : ""}</div>
      <div class="vl"><b>${eur0(c.valore)}</b>${b
        ? `<small class="${oltre?"bad":""}">${oltre ? "+" + eur0(c.valore-b) + " su " + eur0(b) : "di " + eur0(b)}</small>`
        : `<small>senza budget</small>`}</div>
      <span class="ms giu" aria-hidden="true">expand_more</span></div>${sotto}`;
  }).join("");
  $("sumcat").innerHTML = `<div class="sez-t"><b>Categorie</b><span>tocca per le sottocategorie</span></div>` +
    (r.categorie.length ? `<div class="carta">${striscia(r.categorie)}<div style="margin-top:6px">${righe}</div>` +
      (r.senzaCategoria ? `<div class="cnota">${eur0(r.senzaCategoria)} sono nel totale ma non qui: la voce scelta non ha una categoria nella scheda «Categorie Spese».</div>` : "") +
      `</div>` : `<div class="vuoto">Nessuna spesa con categoria in questo mese.</div>`);
}
function apriCategoria(nome){
  vibra("tap");
  if(catAperte.has(nome)) catAperte.delete(nome); else catAperte.add(nome);
  renderCategorie();
}
$("sumcat").addEventListener("click", e => {
  const c = e.target.closest("[data-cat]"); if(c) apriCategoria(c.dataset.cat);
});
$("sumcat").addEventListener("keydown", e => {
  if((e.key === "Enter" || e.key === " ") && e.target.matches("[data-cat]")){
    e.preventDefault(); apriCategoria(e.target.dataset.cat);
    const t = $("sumcat").querySelector(`[data-cat="${CSS.escape(e.target.dataset.cat)}"]`); if(t) t.focus();
  }
});

$("sumbody").addEventListener("click", e => {
  if(!e.target.closest('[data-azione="budget"]')) return;
  if($("bpanel").hidden) $("bopen").click();
  $("bsec").scrollIntoView({behavior:"smooth", block:"start"});
});
