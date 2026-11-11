/* ══════════ PORTAFOGLIO ══════════
   Solo lettura. Obiettivi dalla tabella di sinistra di «Asset Allocation»,
   posizioni da «PORTAFOGLIO», storico da «XIRR». */
let port = null, periodo = "6M", filtroPos = "Tutti", chAllo = null;
const PERIODI = [["1M",30],["3M",91],["6M",182],["YTD",null],["1A",365],["Tutto",0]];
const MESI3N = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
const pc1 = n => (n*100).toFixed(1).replace(".",",") + "%";
// percentuale compatta per gli obiettivi: 40% invece di 40,0%
const pcb = n => { const v = Math.round(n*1000)/10; return (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".",",")); };
const pcs = n => (n>0.00005?"+":n<-0.00005?"−":"") + Math.abs(n*100).toFixed(1).replace(".",",") + "%";
const dataCorta = s => { const p = s.split("-"); return Number(p[2]) + " " + MESI3N[Number(p[1])-1]; };
const dataLunga = s => { const p = s.split("-"); return Number(p[2]) + " " + MESI3N[Number(p[1])-1] + " " + p[0]; };
const giorniFra = (a, b) => (Date.UTC(+b.slice(0,4), +b.slice(5,7)-1, +b.slice(8,10)) -
                             Date.UTC(+a.slice(0,4), +a.slice(5,7)-1, +a.slice(8,10))) / 86400000;

function caricaPortafoglio(forza, sottofondo){
  const vede = () => vista === "port" && pagPort === 1 && portLibero();
  if(port && !forza){ if(!sottofondo && vede()) renderPortafoglio(); if(!vecchi.port) return; }
  // con dati già a schermo gira solo l'icona di aggiornamento
  if(!sottofondo){
    if(port && $("pfRef")) $("pfRef").classList.add("gira");
    else $("portbody").innerHTML = `<div class="skeleton" style="height:140px"></div><div class="skeleton"></div>`;
  }
  const p = prendi("port", "portafoglio", [], forza && !!port);
  p.then(d => { if(!valida("port", p)) return; vecchi.port = false; port = d; if(vede()) renderPortafoglio(); },
    err => {
      if(!valida("port", p)) return;
      if($("pfRef")) $("pfRef").classList.remove("gira");
      if(!vede()) return;
      if(port) toast(String(err.message||err), true);
      else $("portbody").innerHTML = `<div class="err"><span>${esc(err.message||err)}</span></div>`;
    });
}

/* ── loghi e simboli ──
   Azioni: logo dell'azienda dal servizio favicon di Google, partendo dal ticker.
   Se il ticker non è in elenco o il logo non arriva, iniziali su un colore.
   ETF: simbolo disegnato in base all'indice (bandiera USA, bandiera UE, globo…). */
const DOMINI = {
  GOOGL:"google.com", GOOG:"google.com", ENEL:"enel.com", REY:"reply.com", KO:"coca-colacompany.com",
  JNJ:"jnj.com", ADBE:"adobe.com", OWL:"blueowl.com", SPCX:"spacex.com", WSO:"watsco.com",
  STLAM:"stellantis.com", PG:"pg.com", UNA:"unilever.com", ULVR:"unilever.com", UNV0:"unilever.com",
  AAPL:"apple.com", MSFT:"microsoft.com", AMZN:"amazon.com", NVDA:"nvidia.com", V:"visa.com",
  O:"realtyincome.com", META:"meta.com", TSLA:"tesla.com", ISP:"intesasanpaolo.com", ENI:"eni.com",
  RACE:"ferrari.com", UCG:"unicredit.it", MA:"mastercard.com", PEP:"pepsico.com", MCD:"mcdonalds.com"
};
function simboloTicker(t){
  const s = String(t||"").toUpperCase().split(":").pop().split(".")[0];
  return s.replace(/^1(?=[A-Z])/, "");          // Borsa Italiana: 1KO → KO
}
function iniziali(nome){
  const p = String(nome).replace(/[^A-Za-zÀ-ÿ0-9& ]/g," ").trim().split(/\s+/);
  return ((p[0]||"?")[0] + (p[1] ? p[1][0] : (p[0]||"")[1]||"")).toUpperCase();
}
function coloreDa(testo){
  let h = 0; for(const ch of String(testo)) h = (h*31 + ch.charCodeAt(0)) >>> 0;
  return P.slot[h % P.slot.length];
}
function logoKo(img){
  const box = img.parentNode; if(!box) return;
  box.className = "pf-av mono" + (box.classList.contains("sm") ? " sm" : ""); box.style.background = img.dataset.c; box.textContent = img.dataset.i;
}
function stelleUE(){
  let d = "";
  for(let k=0;k<12;k++){
    const a = k*Math.PI/6, cx = 22+12*Math.cos(a), cy = 22+12*Math.sin(a);
    let pts = [];
    for(let j=0;j<10;j++){
      const r = j%2 ? 1.1 : 2.6, b = -Math.PI/2 + j*Math.PI/5;
      pts.push((cx+r*Math.cos(b)).toFixed(2)+","+(cy+r*Math.sin(b)).toFixed(2));
    }
    d += `<polygon points="${pts.join(" ")}" fill="#FFCC00"/>`;
  }
  return `<svg viewBox="0 0 44 44"><rect width="44" height="44" fill="#003399"/>${d}</svg>`;
}
function bandieraUSA(){
  let r = "", h = 44/13;
  for(let i=0;i<13;i+=2) r += `<rect y="${(i*h).toFixed(2)}" width="44" height="${h.toFixed(2)}" fill="#B22234"/>`;
  let st = "";
  for(let y=0;y<4;y++) for(let x=0;x<5;x++)
    st += `<circle cx="${(2.6+x*3.9+(y%2)*1.95).toFixed(2)}" cy="${(2.8+y*5.5).toFixed(2)}" r=".9" fill="#fff"/>`;
  return `<svg viewBox="0 0 44 44"><rect width="44" height="44" fill="#fff"/>${r}
    <rect width="21" height="${(7*h).toFixed(2)}" fill="#3C3B6E"/>${st}</svg>`;
}
function avatarEtf(p){
  const t = (p.nome+" "+p.ticker).toLowerCase();
  const icona = (ms, a, b) => `<span class="pf-av etf" style="background:linear-gradient(135deg,${a},${b})"><span class="ms f">${ms}</span></span>`;
  if(/s&p|500|cspx|sxr8|vuaa|sp500/.test(t)) return `<span class="pf-av etf">${bandieraUSA()}</span>`;
  if(/europ|imeu|meud|stoxx/.test(t))       return `<span class="pf-av etf">${stelleUE()}</span>`;
  if(/emerging|xmme|eimi|\bem\b/.test(t))   return icona("globe_asia", "#FBBC04", "#EA4335");
  if(/world|iwda|swda|acwi|vwce/.test(t))   return icona("public", "#4285F4", "#34A853");
  if(/bond|gov|sega|aggregate|obblig/.test(t)) return icona("account_balance", "#3A656F", "#5E9AA8");
  return icona("stacked_line_chart", "#1B6D35", "#3FA35B");
}
function avatar(p){
  if(/etf/i.test(p.tipo)) return avatarEtf(p);
  const dom = DOMINI[simboloTicker(p.ticker)], c = coloreDa(p.nome), ini = esc(iniziali(p.nome));
  if(!dom) return `<span class="pf-av mono" style="background:${c}">${ini}</span>`;
  return `<span class="pf-av"><img src="https://www.google.com/s2/favicons?domain=${dom}&sz=128" alt=""
    loading="lazy" referrerpolicy="no-referrer" data-c="${c}" data-i="${ini}" onerror="logoKo(this)"></span>`;
}

/* ── andamento ── */
function serieStorico(){
  const st = (port && port.storico) || [];
  if(st.length < 2) return st;
  const ultima = st[st.length-1][0];
  const def = PERIODI.find(p => p[0]===periodo) || PERIODI[2];
  let s;
  if(def[0]==="YTD") s = st.filter(x => x[0] >= ultima.slice(0,4)+"-01-01");
  else if(!def[1]) s = st;
  else s = st.filter(x => giorniFra(x[0], ultima) <= def[1]);
  return s.length >= 2 ? s : st.slice(-2);
}

function graficoStorico(){
  if(!$("cvStor")) return;
  const s = serieStorico();
  if(s.length < 2) return;
  const valori = s.map(x=>x[1]);
  const primo = valori[0], ultimo = valori[valori.length-1], diff = ultimo - primo;
  let iMax = 0, iMin = 0;
  valori.forEach((v,i) => { if(v > valori[iMax]) iMax = i; if(v < valori[iMin]) iMin = i; });
  // il valore investito cresce anche coi versamenti: la linea è inchiostro, non verde/rosso,
  // perché la differenza non è un guadagno (quello vero è nella carta in alto)
  const tinta = P.primario;

  $("storDelta").innerHTML = `${eur0(ultimo)}<small style="color:var(--ink-2)">${segno(diff)} nel periodo</small>`;
  $("storDa").textContent = "dal " + dataLunga(s[0][0]) + " · la variazione include i nuovi acquisti, non è solo rendimento";
  const tile = (k, v, d) => `<div><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
  $("storStats").innerHTML =
    tile("Massimo", eur0(valori[iMax]), dataCorta(s[iMax][0])) +
    tile("Minimo", eur0(valori[iMin]), dataCorta(s[iMin][0])) +
    tile("Ultimo", eur0(ultimo), dataCorta(s[s.length-1][0]));

  if(!chartDefaults()) return;
  const n = valori.length;
  if(chStor) chStor.destroy();
  chStor = new Chart($("cvStor"),{type:"line",
    data:{labels:s.map(x=>dataCorta(x[0])),
      datasets:[{label:"Valore",data:valori,borderColor:tinta,borderWidth:2.5,
        pointRadius:c => c.dataIndex===n-1 ? 4 : 0, pointBackgroundColor:tinta,
        pointBorderColor:P.superficie, pointBorderWidth:2,
        pointHoverRadius:5,pointHoverBorderWidth:2,pointHoverBorderColor:P.superficie,
        pointHoverBackgroundColor:tinta,tension:.3,fill:true,
        backgroundColor:c=>sfuma(c.chart.ctx,c.chart.chartArea,tinta)}]},
    options:{maintainAspectRatio:false,interaction:{mode:"index",intersect:false},
      layout:{padding:{top:8,right:6}},
      plugins:{legend:{display:false},
        tooltip:{...tip(),callbacks:{
          title:t=>dataLunga(s[t[0].dataIndex][0]),
          label:c=>{
            const d = c.raw - primo;
            return eur(c.raw) + "  ·  " + segno(d) + " (" + pcs(primo ? d/primo : 0) + ")";
          }}}},
      scales:{x:{grid:{display:false},border:{display:false},
          ticks:{maxTicksLimit:5,padding:6,maxRotation:0,autoSkip:true}},
        y:{grid:grid(),border:{display:false},grace:"10%",position:"right",
          ticks:{padding:6,maxTicksLimit:4,callback:v=>Math.round(v/1000).toLocaleString("it-IT")+"k"}}}}});
}

/* ── allocazione ──
   Obiettivi in euro con le stesse formule della tabella di sinistra di
   «Asset Allocation»: SET = importo fisso (colonna Action), OFF = resta com'è,
   quota = quota × (base − importi SET − valore delle voci OFF).
   Per le classi in alto la base è il totale; per il dettaglio è l'obiettivo della classe. */
function obiettiviLivello(voci, base){
  const fissi = voci.reduce((s,v) => s + (v.modo==="set" ? (v.fisso||0) : v.modo==="off" ? v.attuale : 0), 0);
  const resto = base - fissi;
  return voci.map(v => v.modo==="set" ? (v.fisso||0) : v.modo==="off" ? v.attuale : (v.quota||0)*resto);
}

/* Le voci su cui si investe davvero: il dettaglio delle classi che ce l'hanno
   (World, S&P 500…), altrimenti la classe stessa (Cash). Salta le voci OFF. */
function vociFinali(a, totale){
  const out = [];
  const obC = obiettiviLivello(a.classi, totale);
  a.classi.forEach((c,i) => {
    if(c.modo==="off") return;
    if(c.figli.length){
      const obF = obiettiviLivello(c.figli, obC[i]);
      c.figli.forEach((f,j) => { if(f.modo!=="off") out.push({nome:f.nome, modo:f.modo, quota:f.quota,
        attuale:f.attuale, obiettivo:obF[j], classe:c.nome}); });
    } else out.push({nome:c.nome, modo:c.modo, quota:c.quota, attuale:c.attuale, obiettivo:obC[i], classe:null});
  });
  return out;
}

/* Un colore fisso per voce, nell'ordine del foglio; gli importi fissi (Cash) in terziario. */
const ORDINE_COLORI = [0,6,1,2,3,4,5];
function coloriVoci(){
  const m = {}; let k = 0;
  if(!port || !port.allocazione) return m;
  vociFinali(port.allocazione, port.allocazione.totale).forEach(v => {
    m[v.nome] = v.modo==="set" ? P.concesso : P.slot[ORDINE_COLORI[k++ % ORDINE_COLORI.length]];
  });
  return m;
}

/* Nuovi soldi, con la stessa logica del foglio:
   1) prima gli importi fissi (SET, es. Cash fino a 8.500 €);
   2) il resto alle voci sotto obiettivo, in proporzione a quanto manca a ciascuna.
   Gli obiettivi sono ricalcolati sul totale nuovo (totale + importo). Non vende niente. */
function ripartisci(x){
  const a = port.allocazione;
  const totNuovo = a.totale + x;
  const voci = vociFinali(a, totNuovo);
  const quote = voci.map(() => 0);
  let resto = x;
  const distribuisci = indici => {
    const manca = indici.map(i => Math.max(0, voci[i].obiettivo - voci[i].attuale));
    const tot = manca.reduce((s,v)=>s+v,0);
    if(tot <= 0.005 || resto <= 0.005) return;
    const usa = Math.min(resto, tot);
    indici.forEach((i,k) => { quote[i] += usa*manca[k]/tot; });
    resto -= usa;
  };
  const idx = modo => voci.map((v,i)=>i).filter(i => voci[i].modo===modo);
  distribuisci(idx("set"));
  distribuisci(idx("rel"));
  if(resto > 0.005){                      // caso limite: avanzo diviso secondo gli obiettivi
    const rel = idx("rel"), totOb = rel.reduce((s,i)=>s+voci[i].obiettivo,0);
    if(totOb > 0) rel.forEach(i => { quote[i] += resto*voci[i].obiettivo/totOb; });
  }
  const nuovoClasse = {};
  voci.forEach((v,i) => { if(v.classe) nuovoClasse[v.classe] = (nuovoClasse[v.classe]||0) + v.attuale + quote[i]; });
  return voci.map((v,i) => ({nome:v.nome, modo:v.modo, classe:v.classe, quota:v.quota, importo:quote[i],
      dopoEur:v.attuale+quote[i], obiettivo:v.obiettivo,
      dopo: v.classe ? (v.attuale+quote[i]) / nuovoClasse[v.classe] : null}))
    .filter(r => r.importo >= 0.5)
    .sort((p,q) => q.importo - p.importo);
}

function leggiImporto(){
  return parseFloat(String($("calcIn").value).replace(/\./g,"").replace(",","."));
}
function renderCalcolo(){
  const box = $("calcRis"); if(!box) return;
  const x = leggiImporto();
  [...document.querySelectorAll("#calcQuick .chip")].forEach(c => c.classList.toggle("on", Number(c.dataset.q)===x));
  if(!(x > 0)){ box.innerHTML = ""; return; }
  const r = ripartisci(x), col = coloriVoci();
  if(!r.length){ box.innerHTML = ""; return; }
  box.innerHTML = `<div class="pf-split">${r.map((v,i) =>
      `<i style="flex:${v.importo} 1 0;background:${col[v.nome]||P.altro};animation-delay:${i*60}ms"></i>`).join("")}</div>` +
    r.map(v => {
      const sotto = v.classe && v.modo==="rel"
        ? `dopo ${pc1(v.dopo)} di ${esc(v.classe)} · obiettivo ${pcb(v.quota)}%`
        : `dopo ${eur0(v.dopoEur)} · obiettivo ${eur0(v.obiettivo)}`;
      return `<div class="pf-crow"><i class="pf-dot" style="background:${col[v.nome]||P.altro}"></i>
        <span class="nm">${esc(v.nome)}<small>${sotto}</small></span>
        <span class="vl">${eur0(v.importo)}</span></div>`;
    }).join("");
}

/* Chip di quanto manca o avanza: colonna Delta del foglio (Target − Current). */
function chipDelta(v){
  const d = v.delta != null ? v.delta : (v.obiettivo||0) - v.attuale;
  if(Math.abs(d) < 1) return `<span class="pf-chip ok">in linea</span>`;
  return d > 0 ? `<span class="pf-chip warn">mancano ${eur0(d)}</span>`
               : `<span class="pf-chip over">${eur0(-d)} in più</span>`;
}

function rigaAllo(colore, nome, larghezza, tacca, piede, chip, ritardo){
  return `<div class="pf-arow">
    <div class="pf-ahead"><i class="pf-dot" style="background:${colore}"></i><span class="nm">${esc(nome)}</span>${chip}</div>
    <div class="pf-track"><i class="pf-fill" style="width:${larghezza}%;background:${colore};animation-delay:${ritardo}ms"></i>
      ${tacca != null ? `<i class="pf-tick" style="left:${tacca}%"></i>` : ``}</div>
    <div class="pf-afoot">${piede}</div></div>`;
}

function bloccoAllocazione(a){
  const col = coloriVoci();
  const pct = (v, scala) => Math.max(0, Math.min(100, v/scala*100));
  const voci = vociFinali(a, a.totale);
  const totVoci = voci.reduce((s,v)=>s+v.attuale,0) || 1;

  const legenda = voci.map(v => `<div><i class="pf-dot" style="background:${col[v.nome]}"></i>
      <span class="n">${esc(v.nome)}</span><span class="p">${pc1(v.attuale/totVoci)}</span></div>`).join("");
  const kTot = a.totale >= 1000 ? "€ " + (a.totale/1000).toLocaleString("it-IT",{maximumFractionDigits:1}) + "k" : eur0(a.totale);
  const ciambella = `<div class="pf-donut">
      <div class="pf-dbox"><canvas id="cvAllo"></canvas>
        <div class="pf-dcen"><b>${kTot}</b><span>totale</span></div></div>
      <div class="pf-leg">${legenda}</div></div>`;

  let r = 0;
  const righe = a.classi.filter(c => c.modo!=="off").map(c => {
    const figli = c.figli.filter(f => f.modo!=="off");
    const testa = `<div class="pf-grp"><b>${esc(c.nome)}</b><span>${eur0(c.attuale)}${
      c.obiettivo != null ? " · obiettivo " + eur0(c.obiettivo) : ""}</span></div>`;

    if(!figli.length){
      const ob = c.obiettivo != null ? c.obiettivo : (c.fisso || 0);
      const scala = Math.max(c.attuale, ob) * 1.12 || 1;
      return testa + rigaAllo(col[c.nome]||P.altro, c.nome, pct(c.attuale, scala), ob ? pct(ob, scala) : null,
        `<b>${eur0(c.attuale)}</b> · obiettivo ${eur0(ob)}${c.modo==="set" ? " fissi" : ""}`, chipDelta(c), (r++)*70);
    }
    const somma = figli.reduce((s,f)=>s+f.attuale,0) || 1;
    const peso = f => f.pesoRel != null ? f.pesoRel : f.attuale/somma;
    const scala = Math.max(...figli.map(f => Math.max(peso(f), f.quota||0))) * 1.12 || 1;
    return testa + figli.map(f => f.modo==="set"
      ? rigaAllo(col[f.nome]||P.altro, f.nome, pct(f.attuale, Math.max(f.attuale, f.fisso||0)*1.12||1),
          pct(f.fisso||0, Math.max(f.attuale, f.fisso||0)*1.12||1),
          `<b>${eur0(f.attuale)}</b> · obiettivo ${eur0(f.fisso||0)} fissi`, chipDelta(f), (r++)*70)
      : rigaAllo(col[f.nome]||P.altro, f.nome, pct(peso(f), scala), f.quota ? pct(f.quota, scala) : null,
          `<b>${pc1(peso(f))}</b> di ${esc(c.nome)} · obiettivo ${pcb(f.quota||0)}%`, chipDelta(f), (r++)*70)
    ).join("");
  }).join("");
  return ciambella + righe;
}

function graficoAllocazione(){
  if(!chartDefaults() || !$("cvAllo") || !port.allocazione) return;
  const col = coloriVoci();
  const voci = vociFinali(port.allocazione, port.allocazione.totale);
  const tot = voci.reduce((s,v)=>s+v.attuale,0) || 1;
  if(chAllo) chAllo.destroy();
  chAllo = new Chart($("cvAllo"),{type:"doughnut",
    data:{labels:voci.map(v=>v.nome),datasets:[{data:voci.map(v=>v.attuale),
      backgroundColor:voci.map(v=>col[v.nome]),borderColor:P.superficie,borderWidth:3,borderRadius:6,
      spacing:1,hoverOffset:5}]},
    options:{maintainAspectRatio:false,cutout:"74%",
      plugins:{legend:{display:false},tooltip:{...tip(),callbacks:{
        label:c=>c.label+" · "+eur0(c.raw)+" ("+pc1(c.raw/tot)+")"}}}}});
}

/* ── oggi: variazione giornaliera di ciascun titolo ──
   varEur dal foglio; la % è sul valore di ieri (valore − varEur). */
let modoOggi = "%";
const pcs2 = n => (n>0.00005?"+":n<-0.00005?"−":"") + Math.abs(n*100).toFixed(2).replace(".",",") + "%";
const segno2 = n => (n>0.005?"+":n<-0.005?"−":"") + eur(Math.abs(n));
function datiOggi(pos){
  return pos.lista.filter(p => p.varEur != null && isFinite(p.varEur)).map(p => {
    const base = p.valore - p.varEur;
    return Object.assign({}, p, {pct: base > 0 ? p.varEur/base : 0});
  });
}
function avatarSm(p){ return avatar(p).replace('class="pf-av', 'class="pf-av sm'); }

let oggiTutti = false;
function bloccoOggi(pos){
  const d = datiOggi(pos);
  const k = modoOggi === "%" ? "pct" : "varEur";
  const fP = modoOggi === "%" ? pcs2 : segno2, fS = modoOggi === "%" ? segno2 : pcs2;
  const kS = modoOggi === "%" ? "varEur" : "pct";
  d.sort((a,b) => b[k] - a[k]);
  const eps = k === "pct" ? 0.00005 : 0.005;
  const su = d.filter(x => x[k] > eps).length, giu = d.filter(x => x[k] < -eps).length, pari = d.length - su - giu;
  const max = Math.max(...d.map(x => Math.abs(x[k]))) || 0;
  const cls = v => v > eps ? "up" : v < -eps ? "down" : "";

  const brd = `<div class="pf-brd">
      ${su ? `<i style="flex:${su} 1 0;background:var(--good)"></i>` : ``}
      ${pari ? `<i style="flex:${pari} 1 0;background:var(--sheet-3);animation-delay:80ms"></i>` : ``}
      ${giu ? `<i style="flex:${giu} 1 0;background:var(--bad);animation-delay:160ms"></i>` : ``}</div>
    <div class="pf-brdlab">
      <span><span class="ms f up-t">arrow_upward</span><b>${su}</b> in rialzo</span>
      ${pari ? `<span><b>${pari}</b> invariati</span>` : ``}
      <span><span class="ms f down-t">arrow_downward</span><b>${giu}</b> in ribasso</span></div>`;

  if(!max) return brd + `<div class="pf-mvnote"><span class="ms">bedtime</span>Nessuna variazione oggi: mercati chiusi o prezzi non ancora aggiornati.</div>`;

  const best = d[0], worst = d[d.length-1];
  const tile = (x, lab) => `<div>${avatarSm(x)}<div>
      <div class="k">${lab}</div><div class="v ${cls(x[k]) ? cls(x[k])+"-t" : ""}">${fP(x[k])}</div><div class="d">${esc(x.nome)}</div></div></div>`;
  const top = d.length > 1 ? `<div class="pf-mvtop">${tile(best, "Migliore")}${tile(worst, "Peggiore")}</div>` : ``;

  const righe = d.map((x, i) => {
    const c = cls(x[k]), w = Math.abs(x[k]) / max * 50;
    return `<div class="pf-mv">${avatarSm(x)}<div class="pf-mvc">
        <div class="pf-mvh"><span class="nm">${esc(x.nome)}</span><span class="vv ${c ? c+"-t" : ""}">${fP(x[k])}</span></div>
        <div class="pf-mvt"><i class="z"></i>${c ? `<i class="b ${c}" style="width:${w.toFixed(2)}%;animation-delay:${i*45}ms"></i>` : ``}</div>
        <div class="pf-mvf"><span>${fS(x[kS])}</span><span>${eur0(x.valore)}</span></div></div></div>`;
  }).join("");
  // tutti i titoli, sempre: la lista completa è il punto della carta
  return brd + top + `<div style="margin-top:6px">${righe}</div>`;
}

/* ── posizioni ── */
function bloccoPosizioni(pos){
  const lista = pos.lista.filter(p => filtroPos==="Tutti" || (filtroPos==="ETF" ? /etf/i.test(p.tipo) : !/etf/i.test(p.tipo)));
  const gruppi = {};
  lista.forEach(p => { if(!gruppi[p.tipo]) gruppi[p.tipo] = []; gruppi[p.tipo].push(p); });
  const nomi = Object.keys(gruppi).sort((a,b) =>
    gruppi[b].reduce((s,p)=>s+p.valore,0) - gruppi[a].reduce((s,p)=>s+p.valore,0));
  if(!nomi.length) return `<div class="vuoto">Nessuna posizione.</div>`;
  return `<div class="lista">` + nomi.map(g => {
    const righe = gruppi[g].slice().sort((a,b) => b.valore - a.valore);
    const tot = righe.reduce((s,p)=>s+p.valore,0);
    return `<div class="pf-lgrp"><span>${esc(g)}</span><span>${eur0(tot)}</span></div>` + righe.map(p => {
      const pill = p.rend != null ? `<span class="pf-pill ${p.rend>=0?"up":"down"}">${pcs(p.rend)}</span>` : ``;
      const oggi = p.varEur != null ? `<span class="pf-oggi">oggi ${segno(p.varEur)}</span>` : ``;
      return `<div class="riga pf-pos">${avatar(p)}
        <span class="tx"><div class="t1">${esc(p.nome)}</div>
          <div class="t2">${p.quote!=null ? p.quote.toLocaleString("it-IT")+" quote" : ""}</div></span>
        <span class="dx"><span class="v">${eur0(p.valore)}</span>${pill}${oggi}</span>
      </div>`;
    }).join("");
  }).join("") + `</div>`;
}

/* Portafoglio: patrimonio, andamento, oggi (raccolto), allocazione,
   dove mettere i nuovi soldi, posizioni. */
function renderPortafoglio(){
  const p = port, a = p.allocazione, pos = p.posizioni, st = p.storico || [];
  const errori = [p.erroreAllocazione, p.errorePosizioni, p.erroreStorico].filter(Boolean)
    .map(e => `<div class="err" style="margin:0 0 12px"><span>${esc(e)}</span></div>`).join("");

  // ── carta d'inchiostro in cima
  const cash = a ? a.classi.find(c => /cash|liquid/i.test(c.nome)) : null;
  const totale = a ? a.totale : (pos ? pos.totali.valore : 0);
  const T = pos ? pos.totali : null;
  const investito = T ? T.valore : totale - (cash ? cash.attuale : 0);
  const liq = cash ? cash.attuale : Math.max(0, totale - investito);
  const intero = Math.trunc(totale), cent = Math.round((totale - intero)*100);
  const baseOggi = T ? T.valore - T.varOggi : 0;
  const chipOggi = T && T.varOggi != null ? `<span class="pill ${T.varOggi>=0?"good":"bad"}">
      <span class="ms">${T.varOggi>=0?"trending_up":"trending_down"}</span>oggi ${segno(T.varOggi)} · ${pcs(baseOggi?T.varOggi/baseOggi:0)}</span>` : ``;
  const chipTot = T && T.costo ? `<span class="pill ${T.guadagno>=0?"good":"bad"}">
      <span class="ms">savings</span>guadagno ${segno(T.guadagno)} · ${pcs(T.guadagno/T.costo)}</span>` : ``;
  const ora = String(p.aggiornato||"").split(" ")[1] || "";
  const hero = `<div class="inch">
      <div class="inch-sopra"><span>Patrimonio totale</span>
        <button class="pf-ref rip" id="pfRef" aria-label="Aggiorna" onclick="caricaPortafoglio(true)"><span class="ms">refresh</span></button></div>
      <div class="inch-big">€ ${intero.toLocaleString("it-IT")}<small style="margin-left:0">,${String(cent).padStart(2,"0")}</small></div>
      <div class="pf-chips">${chipOggi}${chipTot}</div>
      ${totale > 0 ? `<div class="pf-comp">
        <i style="flex:${investito} 1 0;background:var(--card-text)"></i>
        <i style="flex:${liq} 1 0;background:var(--hl);animation-delay:120ms"></i></div>
      <div class="pf-complab">
        <span><i style="background:var(--card-text)"></i>Investito <b>${eur0(investito)}</b></span>
        <span><i style="background:var(--hl)"></i>Liquidità <b>${eur0(liq)}</b></span></div>` : ``}
    </div>`;

  // ── andamento
  const grafico = st.length >= 2 ? `<section class="sez"><div class="carta">
      <div class="carta-t"><b>Valore investito</b><span></span></div>
      <div class="pf-delta" id="storDelta"></div>
      <div class="pf-da" id="storDa"></div>
      <div class="cbox" style="height:200px;margin-top:12px"><canvas id="cvStor" role="img" aria-label="Valore investito nel tempo"></canvas></div>
      <div class="seg" id="periodi" style="margin-top:12px">${PERIODI.map(x =>
        `<button class="${x[0]===periodo?"on":""}" data-p="${x[0]}">${x[0]}</button>`).join("")}</div>
      <div class="pf-stats" id="storStats"></div></div></section>` : ``;

  // ── oggi
  const oggiOk = pos && pos.lista.some(x => x.varEur != null);
  const oggi = oggiOk ? `<section class="sez"><div class="carta">
      <div class="carta-t" style="align-items:center"><b>Oggi sui mercati</b>
        <div class="seg" id="oggiModo" style="width:96px">${["%","€"].map(m =>
          `<button class="${m===modoOggi?"on":""}" data-m="${m}">${m}</button>`).join("")}</div></div>
      <div id="oggiBox">${bloccoOggi(pos)}</div></div></section>` : ``;

  // ── allocazione e calcolatore
  const allocazione = a ? `<section class="sez"><div class="sez-t"><b>Allocazione</b><span>attuale · obiettivo</span></div><div class="carta">
      ${bloccoAllocazione(a)}</div></section>

    <section class="sez"><div class="sez-t"><b>Dove metto i nuovi soldi?</b><span>senza vendere niente</span></div><div class="carta">
      <label class="pf-in"><span class="cur">€</span>
        <input type="text" id="calcIn" inputmode="decimal" placeholder="0" autocomplete="off" aria-label="Importo da investire"></label>
      <div class="pf-quick" id="calcQuick">${[500,1000,2500,5000,10000].map(q =>
        `<button class="chip rip" data-q="${q}">${q >= 1000 ? (q/1000).toLocaleString("it-IT")+"k" : q}</button>`).join("")}</div>
      <div id="calcRis"></div></div></section>` : ``;

  // ── posizioni
  const posizioni = pos && pos.lista.length ? `<section class="sez">
      <div class="sez-t"><b>Posizioni</b><span>${pos.lista.length} titoli · rendimento totale</span></div>
      <div class="seg" id="posFiltro" style="margin-bottom:10px">${["Tutti","ETF","Azioni"].map(f =>
        `<button class="${f===filtroPos?"on":""}" data-f="${f}">${f}</button>`).join("")}</div>
      <div id="posBox">${bloccoPosizioni(pos)}</div></section>` : ``;

  $("portbody").innerHTML = errori + hero + grafico + oggi + allocazione + posizioni;
  sicuro(aggiornaTesta);

  if($("oggiModo")) $("oggiModo").onclick = e => {
    const b = e.target.closest("[data-m]"); if(!b || b.dataset.m===modoOggi) return;
    modoOggi = b.dataset.m;
    [...$("oggiModo").children].forEach(c => c.classList.toggle("on", c.dataset.m===modoOggi));
    $("oggiBox").innerHTML = bloccoOggi(pos);
  };
  if($("oggiBox")) $("oggiBox").onclick = e => {
    if(!e.target.closest('[data-azione="oggi-tutti"]')) return;
    oggiTutti = !oggiTutti; $("oggiBox").innerHTML = bloccoOggi(pos);
  };

  if($("periodi")) $("periodi").onclick = e => {
    const b = e.target.closest("[data-p]"); if(!b) return;
    periodo = b.dataset.p;
    [...$("periodi").children].forEach(c => c.classList.toggle("on", c.dataset.p===periodo));
    graficoStorico();
  };
  if($("posFiltro")) $("posFiltro").onclick = e => {
    const b = e.target.closest("[data-f]"); if(!b) return;
    filtroPos = b.dataset.f;
    [...$("posFiltro").children].forEach(c => c.classList.toggle("on", c.dataset.f===filtroPos));
    $("posBox").innerHTML = bloccoPosizioni(pos);
  };
  if($("calcIn")){
    $("calcIn").oninput = renderCalcolo;
    $("calcQuick").onclick = e => {
      const b = e.target.closest("[data-q]"); if(!b) return;
      $("calcIn").value = Number(b.dataset.q).toLocaleString("it-IT");
      renderCalcolo();
    };
  }
  graficoStorico();
  graficoAllocazione();
  if(!window.Chart && (st.length >= 2 || a)) $("portbody").insertAdjacentHTML("afterbegin",
    `<div class="err" style="margin:0 0 12px"><span>Non riesco a caricare la libreria dei grafici.</span></div>`);
}

/* ══════════ SETTIMANA · riepilogo del weekend ══════════
   Prima pagina del Portafoglio. Il foglio (Settimana.gs) decide se si può
   aprire: solo sabato e domenica, una volta per weekend. Qui si chiede lo
   «stato» (non consuma niente) e si apre solo toccando il pulsante.
   Una volta aperto, il riepilogo resta in memoria finché l'app è aperta. */
let pagPort = 0, setStato = null, setDati = null, setMin = 0, chSetPasso = null, chSetSett = null;
const PAGINE_PORT = ["La settimana", "Tutto il portafoglio"];
const GIORNI1 = ["L","M","M","G","V","S","D"];

function mostraPaginaPort(){
  $("pgNome").textContent = PAGINE_PORT[pagPort];
  [...$("pgDots").children].forEach((d,i) => d.classList.toggle("on", i===pagPort));
  $("pgPrima").disabled = pagPort === 0;
  $("pgDopo").disabled = pagPort === PAGINE_PORT.length - 1;
  $("setbody").hidden = pagPort !== 0;
  $("portbody").hidden = pagPort !== 1;
  sicuro(aggiornaTesta);
  if(pagPort === 0) caricaSettimana(); else caricaPortaLock();
}
function vaiPagina(n){
  if(n === pagPort || n < 0 || n >= PAGINE_PORT.length) return;
  pagPort = n;
  const v = $("viewPort"); v.classList.remove("view"); void v.offsetWidth; v.classList.add("view");
  window.scrollTo({top:0});
  mostraPaginaPort();
}
$("pgPrima").onclick = () => vaiPagina(pagPort - 1);
$("pgDopo").onclick = () => vaiPagina(pagPort + 1);

const vedeSett = () => vista === "port" && pagPort === 0;

function caricaSettimana(){
  if(setDati){ renderSettimana(false); return; }
  if(!setStato) $("setbody").innerHTML = `<div class="skeleton" style="height:340px"></div>`;
  api("settimana", ["stato"]).then(r => {
    setStato = r;
    if(vedeSett() && !setDati) renderStatoSettimana();
  }, err => {
    if(!vedeSett()) return;
    $("setbody").innerHTML = erroreSettimana(err);
  });
}

function erroreSettimana(err){
  const m = String(err && err.message || err);
  const manca = /sconosciuta/i.test(m);
  return `<div class="carta busta"><div class="busta-ic spento"><span class="ms">${manca ? "construction" : "cloud_off"}</span></div>
    <h3>${manca ? "Manca un pezzo nel foglio" : "Non riesco a leggere il foglio"}</h3>
    <p>${manca ? "Aggiungi Settimana.gs nel progetto Apps Script, la riga <b>settimana</b> in API_FUNZIONI e pubblica una nuova versione." : esc(m)}</p>
    <button class="btn rip" style="margin-top:18px" onclick="setStato=null;caricaSettimana()"><span class="ms">refresh</span>Riprova</button></div>`;
}

/* ── busta chiusa, pronta o già letta ── */
function renderStatoSettimana(){
  const r = setStato || {};
  if(r.stato === "errore"){ $("setbody").innerHTML = erroreSettimana(r.errore); return; }
  const giorni = (() => {
    const g = new Date().getDay(), oggi = (g + 6) % 7;
    return `<div class="sett-giorni" aria-hidden="true">${GIORNI1.map((x,i) =>
      `<span class="${i===oggi ? "oggi" : i >= 5 ? "fine" : ""}">${x}</span>`).join("")}</div>`;
  })();
  const ultimo = r.ultimo && r.ultimo.pct != null ? `<div class="ultimo">L'ultima volta, ${dataCorta(r.ultimo.da)}–${dataCorta(r.ultimo.a)}:
      <b>${pcs(r.ultimo.pct)}</b> · <b>${segno(r.ultimo.guadagno)}</b></div>` : ``;
  const quando = r.prossimo ? r.prossimo.testo : "sabato";
  let h;
  if(r.stato === "pronto"){
    h = `<div class="carta busta st-su">
      <div class="busta-ic"><span class="ms f">mark_email_unread</span></div>
      <h3>${r.riapri ? "Il riepilogo è ancora aperto" : "È arrivato il riepilogo"}</h3>
      <p>${r.riapri
        ? "Puoi rivederlo ancora per " + r.minutiRimasti + " minut" + (r.minutiRimasti === 1 ? "o" : "i") + ", poi si richiude fino a sabato prossimo."
        : "La settimana sui mercati, il passo rispetto al piano e cosa comprare dopo. Si apre una volta sola: prenditi un momento."}</p>
      <button class="cta rip" id="setApri"><span class="ms">drafts</span><span>${r.riapri ? "Rivedi il riepilogo" : "Apri il riepilogo"}</span></button>
      ${r.riapri ? `` : `<div class="bst-avv"><span class="ms">lock_clock</span>dopo resta chiuso fino a sabato prossimo</div>`}
      ${ultimo}</div>`;
  } else if(r.stato === "visto"){
    h = `<div class="carta busta st-su">
      <div class="busta-ic spento"><span class="ms">drafts</span></div>
      <h3>Riepilogo già letto</h3>
      <p>L'hai aperto ${esc(r.aperto || "questo weekend")}. Il prossimo arriva</p>
      <div class="quando">${esc(quando)}</div>
      ${giorni}${ultimo}</div>`;
  } else {
    const n = r.giorniMancanti;
    h = `<div class="carta busta st-su">
      <div class="busta-ic"><span class="ms">lock_clock</span></div>
      <h3>Il riepilogo si apre nel weekend</h3>
      <p>Durante la settimana il mercato fa il suo lavoro anche senza di te. Il prossimo riepilogo arriva</p>
      <div class="quando">${esc(quando)}</div>
      ${n != null ? `<div class="tra">${n === 1 ? "domani" : "tra " + n + " giorni"}</div>` : ``}
      ${giorni}${ultimo}</div>`;
  }
  $("setbody").innerHTML = h;
  if($("setApri")) $("setApri").onclick = apriSettimana;
  sicuro(aggiornaTesta);
}

function apriSettimana(){
  const b = $("setApri"); if(!b) return;
  b.disabled = true; b.querySelector("span:last-child").textContent = "Apro la busta…";
  api("settimana", ["apri"]).then(r => {
    if(r.stato === "aperto"){ setDati = r.dati; setMin = r.minutiRimasti || 0; if(vedeSett()) renderSettimana(true); }
    else { setStato = r; if(vedeSett()) renderStatoSettimana(); }
  }, err => {
    b.disabled = false; b.querySelector("span:last-child").textContent = "Apri il riepilogo";
    toast(String(err.message || err), true);
  });
}

/* ── il riepilogo aperto ── */
function verdettoSettimana(s, passo){
  const p = s ? s.pct : 0;
  const a = p > 0.015 ? "Settimana forte." : p > 0.002 ? "Settimana positiva." : p > -0.002 ? "Settimana quasi ferma."
          : p > -0.015 ? "Settimana in calo, niente di strano." : "Settimana pesante: capita, si guarda lontano.";
  if(!passo || passo.scarto == null) return a;
  const b = Math.abs(passo.scarto) < 250 ? " Sei praticamente sul piano."
          : passo.scarto > 0 ? " E sei sopra il piano." : " Sei un po' sotto il piano.";
  return a + b;
}

function renderSettimana(animata){
  const d = setDati, s = d.settimana, passo = d.passo, ver = d.versato, ren = d.rendimento || {};
  const ritardo = i => animata ? ` style="animation-delay:${i*110}ms"` : ``;
  const cls = animata ? "sez st-su" : "sez";
  const errori = (d.errori || []).map(e => `<div class="err" style="margin:0 0 12px"><span>${esc(e)}</span></div>`).join("");

  // 1. la settimana in una carta
  const hero = s ? `<div class="inch${animata ? " st-su" : ""}">
      <div class="inch-sopra"><span>Settimana ${dataCorta(s.da)} – ${dataCorta(s.a)}</span><span>${esc(String(d.creato||"").slice(11))}</span></div>
      <div class="inch-big">${segno(s.guadagno)}</div>
      <div class="pf-chips">
        <span class="pill ${s.pct >= 0 ? "good" : "bad"}"><span class="ms">${s.pct >= 0 ? "trending_up" : "trending_down"}</span>${pcs(s.pct)} in una settimana</span>
        ${s.flussi ? `<span class="pill neu"><span class="ms">add_card</span>versati ${eur0(s.flussi)}</span>` : ``}
      </div>
      <div class="st-verd">${esc(verdettoSettimana(s, passo))}</div>
      <div class="inch-righe"><span>Valore investito <b>${eur0(s.v1)}</b></span><span>una settimana fa <b>${eur0(s.v0)}</b></span></div>
    </div>` : `<div class="err"><span>Non ho abbastanza giorni nella scheda XIRR per la settimana.</span></div>`;

  // 2. il passo rispetto al piano
  let passoH = ``;
  if(passo && passo.scarto != null){
    const su = passo.scarto >= 0;
    let nota = ``;
    if(passo.scartoPrima != null && s){
      const mosso = passo.scarto - passo.scartoPrima;
      const crescita = passo.piano - (s.v0 - passo.scartoPrima);
      nota = `<div class="st-nota"><span class="ms">${mosso >= 0 ? "north_east" : "south_east"}</span><span>
        In una settimana lo scarto è ${mosso >= 0 ? "migliorato" : "peggiorato"} di <b>${eur0(Math.abs(mosso))}</b>.
        Il piano sale di circa <b>${eur0(crescita)}</b> a settimana tra versamenti e rendimento: per tenere il passo
        bastano quelli.</span></div>`;
    }
    passoH = `<section class="${cls}"${ritardo(1)}><div class="sez-t"><b>Il passo</b><span>reale contro piano ${passo.anno || ""}</span></div><div class="carta">
      <div class="st-num ${su ? "good" : "bad"}">${su ? "+" : "−"}${eur0(Math.abs(passo.scarto))}<small>${su ? "sopra" : "sotto"} il piano</small></div>
      <div class="st-sub">oggi il piano dice <b>${eur0(passo.piano)}</b>, hai <b>${eur0(passo.reale)}</b> · ${pcs(passo.scartoPct)}</div>
      <div class="cbox" style="height:190px;margin-top:12px"><canvas id="cvSetPasso" role="img" aria-label="Valore reale e piano nelle ultime settimane"></canvas></div>
      <div class="st-leg"><span><i></i>Reale</span><span><i class="tr"></i>Piano</span></div>
      ${nota}</div></section>`;
  }

  // 3. versamenti dell'anno
  let versH = ``;
  if(ver && ver.obiettivo){
    const anno = String(d.creato || "").slice(0,4);
    const quota = Math.max(0, Math.min(100, ver.reale / ver.obiettivo * 100));
    const diff = ver.reale - ver.piano;
    const mesi = ver.perMese || [];
    const max = Math.max(1, ...mesi.map(Math.abs));
    const meseOra = Number(String(d.creato || "").slice(5,7)) - 1;
    const barre = mesi.length ? `<div class="st-mesi" aria-hidden="true">${mesi.map((x,i) =>
      `<div><i class="${x < 0 ? "neg" : i === meseOra ? "ora" : ""}" style="height:${Math.max(3, Math.abs(x)/max*40)}px;animation-delay:${i*40}ms"></i>
       <span>${MESI3[i][0].toUpperCase()}</span></div>`).join("")}</div>` : ``;
    versH = `<section class="${cls}"${ritardo(2)}><div class="sez-t"><b>Versamenti ${anno}</b><span>obiettivo ${eur0(ver.obiettivo)} l'anno</span></div><div class="carta">
      <div class="st-num">${eur0(ver.reale)}<small>di ${eur0(ver.obiettivo)} · ${Math.round(quota)}%</small></div>
      <div class="pf-track" style="height:8px;margin-top:14px"><div class="pf-fill" style="width:${quota}%;background:var(--ink)"></div>
        <div class="pf-tick" style="left:${Math.min(100, ver.frazioneAnno*100)}%;background:var(--hl);width:4px"></div></div>
      <div class="pf-afoot">La tacca gialla è dove saresti a ritmo costante (${eur0(ver.piano)}):
        <b>${diff >= 0 ? "avanti di " + eur0(diff) : "indietro di " + eur0(-diff)}</b> · mancano ${eur0(Math.max(0, ver.obiettivo - ver.reale))} a fine anno</div>
      ${barre}</div></section>`;
  }

  // 4. settimana per settimana + rendimento
  const sett = d.storicoSett || [];
  const tile = (k, v, nota) => `<div><div class="k">${k}</div><div class="v">${v}</div><div class="d">${nota}</div></div>`;
  const pv = x => x == null ? "—" : pcs(x);
  const rendH = `<section class="${cls}"${ritardo(3)}><div class="sez-t"><b>Settimana per settimana</b><span>${sett.length > 1 ? "ultime " + sett.length : "si riempie col tempo"}</span></div><div class="carta">
      ${sett.length > 1 ? `<div class="cbox sm"><canvas id="cvSetSett" role="img" aria-label="Rendimento di ogni settimana"></canvas></div>` :
        `<div class="pf-afoot" style="margin-bottom:6px">Le settimane si contano da quando gli acquisti sono nella scheda «Movimenti»: il grafico cresce da solo.</div>`}
      <div class="pf-stats">${tile("Settimana", pv(ren.settimana), "al netto dei versamenti")}${tile("Da inizio anno", pv(ren.ytd), "rendimento " + String(d.creato||"").slice(0,4))}${tile("XIRR anno", pv(ren.xirr), "annualizzato")}</div>
    </div></section>`;

  // 5. chi ha mosso la settimana
  let mvH;
  const mv = d.movers;
  if(mv && mv.lista && mv.lista.length){
    const riga = x => `<div class="st-mv">${avatar(x).replace('class="pf-av', 'class="pf-av sm')}
        <div class="nm"><b>${esc(x.nome)}</b><small>${segno(x.eur)} sulla tua posizione</small></div>
        <span class="pf-pill ${x.pct >= 0 ? "up" : "down"}">${pcs(x.pct)}</span></div>`;
    const L = mv.lista;
    const corpo = L.length <= 6 ? L.map(riga).join("")
      : L.slice(0,3).map(riga).join("") + `<div class="st-mvsep">· · ·</div>` + L.slice(-3).map(riga).join("");
    mvH = `<section class="${cls}"${ritardo(4)}><div class="sez-t"><b>Chi ha mosso la settimana</b><span>prezzi dal ${dataCorta(mv.da)}</span></div>
      <div class="carta">${corpo}</div></section>`;
  } else {
    mvH = `<section class="${cls}"${ritardo(4)}><div class="sez-t"><b>Chi ha mosso la settimana</b></div>
      <div class="vuoto"><span class="ms">photo_camera</span>Ho appena fotografato i prezzi: dal prossimo weekend qui vedi chi è salito e chi è sceso.</div></section>`;
  }

  // 6. allocazione e prossimo acquisto
  let allH = ``;
  const a = d.allocazione;
  if(a && a.classi && a.classi.length){
    const voci = vociFinali(a, a.totale);
    const tot = a.totale || 1;
    // il prossimo acquisto fra le voci su cui investi già (una classe mai avviata, es. Bonds, non conta)
    const prox = voci.filter(v => v.modo !== "set" && v.attuale > 0).sort((x,y) => (y.obiettivo - y.attuale) - (x.obiettivo - x.attuale))[0];
    const scala = Math.max(...voci.map(v => Math.max(v.attuale, v.obiettivo))) / tot * 1.12 || 1;
    let k = 0;
    const righe = voci.map(v => {
      const att = v.attuale / tot, ob = v.obiettivo / tot, delta = v.obiettivo - v.attuale;
      const chip = Math.abs(delta) < tot * 0.005 ? `<span class="pf-chip ok">in linea</span>`
        : delta > 0 ? `<span class="pf-chip warn">−${eur0(delta)}</span>` : `<span class="pf-chip over">+${eur0(-delta)}</span>`;
      const c = P.slot[ORDINE_COLORI[(k++) % ORDINE_COLORI.length]];
      return `<div class="pf-arow"><div class="pf-ahead"><span class="pf-dot" style="background:${c}"></span><span class="nm">${esc(v.nome)}</span>${chip}</div>
        <div class="pf-track"><div class="pf-fill" style="width:${Math.min(100, att/scala*100)}%;background:${c}"></div>
          <div class="pf-tick" style="left:${Math.min(100, ob/scala*100)}%"></div></div>
        <div class="pf-afoot"><b>${pc1(att)}</b> del totale · obiettivo ${pc1(ob)}</div></div>`;
    }).join("");
    allH = `<section class="${cls}"${ritardo(5)}><div class="sez-t"><b>Allocazione</b><span>patrimonio ${eur0(a.totale)}</span></div><div class="carta">
      ${prox && prox.obiettivo > prox.attuale ? `<div class="st-prox"><span class="ms">shopping_bag</span><div>
        <b>Prossimo acquisto: ${esc(prox.nome)}</b><span>mancano ${eur0(prox.obiettivo - prox.attuale)} per tornare in linea</span></div></div>` : ``}
      ${righe}</div></section>`;
  }

  // 7. chiusura
  const tg = d.traguardo;
  const trag = tg ? `<div class="st-trag"><div class="pf-track" style="height:8px"><div class="pf-fill" style="width:${
      Math.max(2, Math.min(100, (1 - tg.manca/(tg.soglia - tg.da))*100))}%;background:var(--ink)"></div></div>
      <div class="pf-afoot"><span>Prossimo traguardo <b>${eur0(tg.soglia)}</b></span><span>mancano <b>${eur0(tg.manca)}</b></span></div></div>` : ``;
  const fine = `<section class="${cls}"${ritardo(6)}><div class="st-fine">
      <div class="busta-ic sm"><span class="ms">event_available</span></div>
      <b>Ci rivediamo ${esc(d.prossimo ? d.prossimo.testo : "sabato prossimo")}</b>
      <p>Fino ad allora non c'è niente da controllare: il PAC compra da solo e la fine del mese si chiude da sola.</p>
      ${trag}
      ${setMin ? `<div class="st-rivedi"><span class="ms">lock_clock</span>resta apribile ancora per ${setMin} minuti, poi si richiude</div>` : ``}
    </div></section>`;

  $("setbody").innerHTML = errori + hero + passoH + versH + rendH + mvH + allH + fine;
  sicuro(aggiornaTesta);
  graficoSetPasso(); graficoSetSett();
}

function graficoSetPasso(){
  const cv = $("cvSetPasso"), passo = setDati && setDati.passo;
  if(!cv || !passo || !passo.serie || passo.serie.length < 2 || !chartDefaults()) return;
  const S = passo.serie, n = S.length, tinta = P.primario;
  if(chSetPasso) chSetPasso.destroy();
  chSetPasso = new Chart(cv, {type:"line",
    data:{labels:S.map(x => dataCorta(x[0])), datasets:[
      {label:"Reale", data:S.map(x => x[1]), borderColor:tinta, borderWidth:2.5, tension:.3,
       pointRadius:c => c.dataIndex === n-1 ? 4 : 0, pointBackgroundColor:tinta, pointBorderColor:P.superficie, pointBorderWidth:2,
       pointHoverRadius:5, fill:true, backgroundColor:c => sfuma(c.chart.ctx, c.chart.chartArea, tinta)},
      {label:"Piano", data:S.map(x => x[2]), borderColor:P.testo3, borderWidth:2, borderDash:[5,4], tension:.2,
       pointRadius:0, pointHoverRadius:4, fill:false, spanGaps:true}]},
    options:{maintainAspectRatio:false, interaction:{mode:"index", intersect:false}, layout:{padding:{top:8,right:6}},
      plugins:{legend:{display:false}, tooltip:{...tip(), callbacks:{
        title:t => dataLunga(S[t[0].dataIndex][0]),
        label:c => c.raw == null ? null : c.dataset.label + "  " + eur0(c.raw),
        afterBody:t => { const r = S[t[0].dataIndex]; return r[2] == null ? "" : "scarto " + segno(r[1] - r[2]); }}}},
      scales:{x:{grid:{display:false}, border:{display:false}, ticks:{maxTicksLimit:4, padding:6, maxRotation:0}},
        y:{grid:grid(), border:{display:false}, grace:"6%", position:"right",
          ticks:{padding:6, maxTicksLimit:4, callback:v => (v/1000).toLocaleString("it-IT",{maximumFractionDigits:1}) + "k"}}}}});
}

function graficoSetSett(){
  const cv = $("cvSetSett"), L = setDati && setDati.storicoSett;
  if(!cv || !L || L.length < 2 || !chartDefaults()) return;
  const n = L.length;
  const col = (x, i) => (x.pct >= 0 ? P.bene : P.male) + (i === n-1 ? "" : "8C");
  if(chSetSett) chSetSett.destroy();
  chSetSett = new Chart(cv, {type:"bar",
    data:{labels:L.map(x => dataCorta(x.a)), datasets:[{data:L.map(x => x.pct*100),
      backgroundColor:L.map(col), borderRadius:4, borderSkipped:false, maxBarThickness:26}]},
    options:{maintainAspectRatio:false, layout:{padding:{top:6,right:6}},
      plugins:{legend:{display:false}, tooltip:{...tip(), callbacks:{
        title:t => { const x = L[t[0].dataIndex]; return dataCorta(x.da) + " – " + dataCorta(x.a); },
        label:c => { const x = L[c.dataIndex]; return pcs(x.pct) + "  ·  " + segno(x.guadagno); }}}},
      scales:{x:{grid:{display:false}, border:{display:false}, ticks:{maxTicksLimit:6, maxRotation:0, padding:4}},
        y:{grid:grid(), border:{display:false}, position:"right", grace:"15%",
          ticks:{padding:6, maxTicksLimit:4, callback:v => v.toLocaleString("it-IT",{maximumFractionDigits:1}) + "%"}}}}});
}

/* ══════════ «Tutto il portafoglio»: una volta al giorno ══════════
   La seconda pagina si apre una volta al giorno (il lucchetto è nel foglio,
   Settimana.gs). Dopo l'apertura resta visibile qualche minuto, poi si
   richiude fino a domani. I dati si caricano lo stesso in sottofondo,
   ma si disegnano solo a pagina aperta. */
let portSblocco = false, portScade = 0, portTimer = null;
const portLibero = () => portSblocco && Date.now() < portScade;
const vedePorta = () => vista === "port" && pagPort === 1;

function caricaPortaLock(){
  if(portLibero()){ caricaPortafoglio(); return; }
  portSblocco = false;
  $("portbody").innerHTML = `<div class="skeleton" style="height:300px"></div>`;
  api("settimana", ["porta-stato"]).then(r => { if(vedePorta() && !portLibero()) renderPortaLock(r); },
    err => { if(vedePorta()) $("portbody").innerHTML = erroreSettimana(err); });
}

function renderPortaLock(r){
  if(!r || !r.porta){
    $("portbody").innerHTML = erroreSettimana(new Error("Funzione sconosciuta: aggiorna Settimana.gs"));
    return;
  }
  if(r.stato === "errore"){ $("portbody").innerHTML = erroreSettimana(r.errore); return; }
  const domani = r.prossimo ? r.prossimo.testo : "domani";
  let h;
  if(r.stato === "pronto"){
    h = `<div class="carta busta st-su">
      <div class="busta-ic"><span class="ms f">visibility</span></div>
      <h3>${r.riapri ? "Il portafoglio è ancora aperto" : "Il portafoglio di oggi"}</h3>
      <p>${r.riapri
        ? "Puoi rivederlo ancora per " + r.minutiRimasti + " minut" + (r.minutiRimasti === 1 ? "o" : "i") + ", poi si richiude fino a domani."
        : "Posizioni, allocazione e andamento. Si apre una volta al giorno e resta aperto pochi minuti: guarda quello che ti serve."}</p>
      <button class="cta rip" id="portApri"><span class="ms">lock_open</span><span>${r.riapri ? "Rivedi il portafoglio" : "Apri il portafoglio"}</span></button>
      ${r.riapri ? `` : `<div class="bst-avv"><span class="ms">lock_clock</span>dopo si riapre ${esc(domani)}</div>`}</div>`;
  } else {
    h = `<div class="carta busta st-su">
      <div class="busta-ic spento"><span class="ms">visibility_off</span></div>
      <h3>Per oggi l'hai già visto</h3>
      <p>L'hai aperto ${esc(r.aperto || "oggi")}. Si riapre</p>
      <div class="quando">${esc(domani)}</div>
      <div class="tra">il riepilogo della settimana resta sulla pagina accanto</div></div>`;
  }
  $("portbody").innerHTML = h;
  if($("portApri")) $("portApri").onclick = apriPorta;
}

function apriPorta(){
  const b = $("portApri"); if(!b) return;
  b.disabled = true; b.querySelector("span:last-child").textContent = "Apro…";
  api("settimana", ["porta-apri"]).then(r => {
    if(!r || !r.porta){ renderPortaLock(r); return; }
    if(r.stato !== "aperto"){ if(vedePorta()) renderPortaLock(r); return; }
    const min = r.minutiRimasti || 15;
    portSblocco = true; portScade = Date.now() + min * 60000;
    clearTimeout(portTimer);
    portTimer = setTimeout(() => { portSblocco = false; if(vedePorta()) caricaPortaLock(); }, min * 60000 + 500);
    if(port) renderPortafoglio(); else caricaPortafoglio();
    toast("Aperto per " + min + " minuti");
  }, err => {
    b.disabled = false; b.querySelector("span:last-child").textContent = "Apri il portafoglio";
    toast(String(err.message || err), true);
  });
}
