/* ══════════ ANNO ══════════ */
function ricalcola(){
  invalida("year", "sum");
  $("yearbody").innerHTML = `<div class="vuoto">Ricalcolo dal foglio…</div>`;
  google.script.run
    .withSuccessHandler(() => caricaAnni())
    .withFailureHandler(err => { $("yearbody").innerHTML = `<div class="err"><span>${esc(err.message||err)}</span></div>`; })
    .azzeraCacheStat();
}

function caricaAnni(sottofondo){
  const vede = () => vista === "year";
  if(stat){ if(!sottofondo) renderAnni(); if(!vecchi.year) return; }
  if(!sottofondo && !stat) $("yearbody").innerHTML = `<div class="skel" style="height:190px"></div><div class="skel" style="height:240px"></div>`;
  const p = prendi("year", "statisticheAnnuali");
  p.then(s => {
    if(!valida("year", p)) return;
    if(!s || !s.anni || !s.anni.length){ if(vede()) $("yearbody").innerHTML=`<div class="vuoto">Nessuna scheda «Spese &lt;anno&gt;» trovata.</div>`; return; }
    vecchi.year = false; stat = s; if(vede()) renderAnni();
  }, err => { if(valida("year", p) && vede() && !stat) $("yearbody").innerHTML=`<div class="err"><span>${esc(err.message||err)}</span></div>`; });
}

/* Barre mese per mese (HTML): la barra scelta in inchiostro col valore sopra
   (all'inizio il mese più caro), il mese in corso a righe, quelli futuri appena accennati,
   la linea tratteggiata del budget mensile. Tocca una barra per il suo valore. */
let annoSel = null, barraSel = null;
function barreMesi(a){
  const corrente = a.anno === stat.annoCorrente, mc = stat.meseCorrente;
  const tetto = budgetMese && budgetMese.b ? Number(budgetMese.b.TOTALE) : 0;
  const max = Math.max(1, ...a.mensili, tetto * 1.04);
  const piuCaro = a.mensili.indexOf(Math.max(...a.mensili));
  const sel = barraSel != null ? barraSel : piuCaro;
  const alt = 132;                                   // altezza utile in px
  const linea = tetto > 0 ? `<span class="tetto" style="bottom:${Math.round(tetto / max * alt)}px"><span>budget ${eur0(tetto)}</span></span>` : "";
  return `<div class="barre" id="barre">${linea}${a.mensili.map((v,i) => {
      const futuro = corrente && i+1 > mc, inCorso = corrente && i+1 === mc;
      const h = Math.max(4, Math.round(v / max * alt));
      const cls = (futuro || !v ? "zero" : "") + (inCorso ? " corso" : "") + (i === sel ? " sel" : "");
      return `<div data-i="${i}" title="${MESI[i]} · ${eur0(v)}" role="button" aria-label="${MESI[i]} ${eur0(v)}">` +
        (i === sel && v ? `<span class="tip" style="bottom:${h + 6}px">${eur0(v)}</span>` : "") +
        `<i class="${cls.trim()}" style="height:${h}px"></i></div>`;
    }).join("")}</div>
    <div class="mesi12">${MESI3.map((m,i) => `<span class="${i===sel?"on":""}">${m}</span>`).join("")}</div>
    ${a.mensili[sel] ? `<div class="apri-mese"><button type="button" class="btn tenue rip" data-apri="${sel}">
      <span class="ms">calendar_month</span>Apri ${MESI[sel].toLowerCase()}${a.anno !== new Date().getFullYear() ? " " + a.anno : ""}<span class="ms">chevron_right</span></button></div>` : ""}`;
}
function renderAnni(){
  const s = stat, anni = s.anni;
  if(!annoSel || !anni.some(x => x.anno === annoSel)) annoSel = anni[anni.length-1].anno;
  const idx = anni.findIndex(x => x.anno === annoSel);
  const a = anni[idx], prec = idx > 0 ? anni[idx-1] : null;
  const corrente = a.anno === s.annoCorrente;
  const tetto = budgetMese && budgetMese.b ? Number(budgetMese.b.TOTALE) : 0;

  // segmenti: gli ultimi tre anni (gli altri si scelgono dalla tabella)
  const seg = anni.slice(-3).map(x => `<button type="button" class="${x.anno===annoSel?"on":""}" data-anno="${x.anno}">${x.anno}</button>`).join("");

  const proiez = corrente ? a.media * 12 : a.totale;
  const confr = prec ? (corrente ? a.ytd - prec.ytd : a.totale - prec.totale) : null;
  const confrBase = prec ? (corrente ? prec.ytd : prec.totale) : 0;
  const confrPct = confrBase ? confr / confrBase : 0;
  const pillConfr = prec ? `<span class="pill ${confr > 0 ? "bad" : "good"}"><span class="ms">${confr > 0 ? "north_east" : "south_east"}</span>${
      confr > 0 ? "+" : confr < 0 ? "−" : ""}${Math.round(Math.abs(confrPct)*100)}% vs ${prec.anno}</span>` : "";
  const piuCaro = a.mensili.indexOf(Math.max(...a.mensili));
  const notaConfr = prec ? `Rispetto al ${prec.anno}${corrente ? " nello stesso periodo" : ""}: <b>${segno(confr)}</b> (allora ${eur0(confrBase)}).` : "Primo anno registrato.";
  const notaBudget = tetto ? ` Con il budget di ${eur0(tetto)} al mese l'anno vale <b>${eur0(tetto*12)}</b>${corrente ? `: al ritmo attuale chiudi ${proiez > tetto*12 ? "sopra" : "sotto"} di ${eur0(Math.abs(tetto*12 - proiez))}` : ""}.` : "";
  const hero = `<div class="inch">
    <div class="inch-sopra"><span>Speso nel ${a.anno}${corrente ? " · fino a " + MESI[s.meseCorrente-1].toLowerCase() : ""}</span>${pillConfr}</div>
    <div class="inch-big">${eur0(a.totale)}</div>
    <div class="inch-righe" style="margin-top:4px"><span>media <b>${eur0(a.media)}</b> al mese</span>
      <span>${corrente ? `proiezione <b>${eur0(proiez)}</b>` : `più caro <b>${a.mensili[piuCaro] ? MESI[piuCaro].toLowerCase() : "—"}</b>`}</span></div>
    <div class="inch-nota">${notaConfr}${notaBudget}</div></div>`;

  // categorie con la variazione sull'anno prima
  const mappaPrec = {};
  if(prec) prec.categorie.forEach(c => mappaPrec[c.nome] = c.valore);
  const catRighe = a.categorie.slice(0,10).map(c => {
    const p = mappaPrec[c.nome] || 0, d = p ? (c.valore/p - 1)*100 : null;
    return `<div class="crow"><span class="qd" style="background:${col(c.nome)}"><span class="ms f">${ico(c.nome)}</span></span>
      <div class="nm"><b>${esc(c.nome)}</b><small>${a.totale ? Math.round(c.valore/a.totale*100) : 0}% dell'anno · ${eur0(c.valore / (corrente ? s.meseCorrente : 12))}/mese</small></div>
      <div class="vl"><b>${eur0(c.valore)}</b>${
        !prec ? "" : corrente
          // anno in corso: il confronto in % con un anno intero sarebbe falsato, quindi solo il valore di allora
          ? `<small>${prec.anno}: ${p ? eur0(p) : "—"}</small>`
          : `<small style="color:${d===null?P.testo3:(d>0?P.male:P.bene)}">${d===null ? "nuova" : (d>0?"+":"") + Math.round(d) + "% su " + prec.anno}</small>`}</div></div>`;
  }).join("");

  const righe = anni.slice().reverse().map(x => `
    <tr data-anno="${x.anno}" class="${x.anno===annoSel?"sel":""}"><td><span>${x.anno}</span></td>
      <td>${eur0(x.totale)}</td><td>${eur0(x.media)}</td>
      <td>${x.piuAlto.mese?MESI3[x.piuAlto.mese-1]:"—"}</td><td>${x.righe}</td></tr>`).join("");

  const piedi = `<div class="piedi"><span>Mese più caro: <b>${a.mensili[piuCaro] ? MESI[piuCaro].toLowerCase() + " · " + eur0(a.mensili[piuCaro]) : "—"}</b></span>${
    corrente ? `<span><b>${MESI[s.meseCorrente-1].toLowerCase()}</b> in corso</span>` : ""}</div>`;

  $("yearbody").innerHTML = `<div class="seg hl-on tabmesi" id="anniSeg">${seg}</div>${hero}
    <section class="sez"><div class="carta">
      <div class="carta-t"><b>Mese per mese</b><span>tocca una barra</span></div>
      <div id="barreBox">${barreMesi(a)}</div>${piedi}</div></section>

    <section class="sez"><div class="carta">
      <div class="carta-t"><b>Cumulato da gennaio</b><span>confronto con gli anni prima</span></div>
      <div class="cbox"><canvas id="cvCum" role="img" aria-label="Spesa cumulata per anno"></canvas></div>
      <div class="leg" id="legCum"></div></div></section>

    <section class="sez"><div class="sez-t"><b>Categorie ${a.anno}</b>${prec?`<span>${corrente ? "e quanto nel " + prec.anno + " intero" : "variazione su " + prec.anno}</span>`:``}</div>
      <div class="carta">${striscia(a.categorie)}<div style="margin-top:6px">${catRighe || `<div class="vuoto">Nessuna categoria.</div>`}</div></div></section>

    <section class="sez"><div class="sez-t" style="align-items:center"><b>Tutti gli anni</b>
        <button class="btn testo rip" onclick="ricalcola()"><span class="ms">refresh</span>Ricalcola</button></div>
      <div class="carta" style="padding-top:12px"><table class="tbl" id="tblAnni"><thead><tr>
        <th>Anno</th><th>Totale</th><th>Media</th><th>Picco</th><th>Voci</th>
      </tr></thead><tbody>${righe}</tbody></table></div></section>`;
  sicuro(aggiornaTesta);

  if(!window.Chart){
    $("yearbody").insertAdjacentHTML("beforeend",
      `<div class="err"><span>Non riesco a caricare la libreria dei grafici.</span></div>`);
    return;
  }
  chartDefaults();
  const ultimi = anni.slice(0, idx+1).slice(-3);
  // anno scelto in inchiostro pieno, quelli prima in grigio tratteggiato
  const tinte = [P.altro, P.testo3, P.primario].slice(-ultimi.length);
  if(chCum) chCum.destroy();
  const ds = ultimi.map((x,i)=>{
    let acc=0; const cum=x.mensili.map(v=>{acc+=v; return acc;});
    const ultimoMese = x.anno===s.annoCorrente ? s.meseCorrente : 12;
    const scelto = x.anno===annoSel;
    return {label:String(x.anno),
      data:cum.map((v,j)=> j<ultimoMese ? v : null),
      borderColor:tinte[i],borderWidth:scelto?2.5:1.75,borderDash:scelto?[]:[5,4],
      pointRadius:0,pointHoverRadius:5,tension:.3,fill:scelto,
      backgroundColor:c=>sfuma(c.chart.ctx,c.chart.chartArea,tinte[i].slice(0,7))};
  });
  chCum = new Chart($("cvCum"),{type:"line",data:{labels:MESI3,datasets:ds},
    options:{maintainAspectRatio:false,interaction:{mode:"index",intersect:false},
      plugins:{legend:{display:false},
        tooltip:{...tip(),displayColors:true,boxWidth:8,boxHeight:8,usePointStyle:true,
          callbacks:{label:c=>c.raw==null?null:c.dataset.label+": "+eur0(c.raw)}}},
      scales:{x:{grid:{display:false},border:{display:false},ticks:{padding:4,maxRotation:0,autoSkip:true,autoSkipPadding:6}},
        y:{grid:grid(),border:{display:false},position:"right",ticks:{maxTicksLimit:5,padding:6,callback:v=>"€"+Math.round(v/1000)+"k"}}}}});
  $("legCum").innerHTML = ds.slice().reverse().map(d =>
    `<span><i class="lin" style="border-top-color:${d.borderColor};border-top-style:${d.borderDash.length?"dashed":"solid"}"></i>${d.label}</span>`).join("");
}
$("yearbody").addEventListener("click", e => {
  const ap = e.target.closest("[data-apri]");
  if(ap){                                    // «Apri ottobre»: riepilogo di quel mese
    vibra("tap");
    vaiAlMese(Number(ap.dataset.apri) + 1, annoSel);
    $("nav").querySelector('[data-v="sum"]').click();
    return;
  }
  const b = e.target.closest("[data-anno]");
  if(b){
    const n = Number(b.dataset.anno);
    if(n !== annoSel){ vibra("tap"); annoSel = n; barraSel = null; renderAnni();
      if(b.tagName === "TR") window.scrollTo({top:0, behavior:"smooth"}); }
    return;
  }
  const bar = e.target.closest("#barre [data-i]");
  if(bar && stat){
    barraSel = Number(bar.dataset.i);
    const a = stat.anni.find(x => x.anno === annoSel);
    if(a) $("barreBox").innerHTML = barreMesi(a);
  }
});
