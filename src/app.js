// ================= App de Rifas =================
// Interfaz y lógica. No depende de Electron: recibe la base de datos en iniciarApp(db, downloads).

// ---------- utilidades ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nowISO = () => new Date().toISOString();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clientId = 'c' + Math.random().toString(36).slice(2);
const METODOS = ['Pago móvil','Transferencia','Efectivo','Zelle','Binance','Otro'];
const MONEDAS = ['$','Bs','COP','€','USDT'];
const EPS = 0.005;

const S = {
  db:null, downloads:null, dbListo:false,
  rifas:[], rifasCargadas:false, stats:{},
  tasas:{ '$':1, 'USDT':1 }, tasasFecha:'',
  rifaId:null, raw:new Map(), numsCargados:false,
  tab:'numeros', filtro:'todos', q:'', qComp:'',
  multi:false, sel:new Set(), unsubNums:null, aviso:''
};

function rifa(){ const r = S.rifas.find(r => r.id === S.rifaId); return r || null; }
function ancho(r){ return Math.max(2, String(r.inicio + r.cantidad - 1 - (r.inicio === 1 ? 1 : 0)).length) }
function fmtNum(r, n){ return String(n).padStart(ancho(r), '0') }
function rango(r){ const a=[]; for(let i=0;i<r.cantidad;i++) a.push(r.inicio+i); return a }
function fmtM(v, m){
  const dec = m === 'COP' ? 0 : 2;
  const s = (Number(v)||0).toLocaleString('es-VE',{minimumFractionDigits:dec,maximumFractionDigits:dec});
  if(m === '$') return '$' + s;
  if(m === '€') return '€' + s;
  if(m === 'Bs') return 'Bs ' + s;
  return s + ' ' + m;
}
const money = (v, r) => fmtM(v, (r && r.moneda) || '$');
const pctTxt = p => (Math.floor(p * 10) / 10).toLocaleString('es-VE') + '%';
function fmtFecha(f){ if(!f) return ''; const d = new Date(f.length<=10 ? f+'T00:00:00' : f); return isNaN(d) ? f : d.toLocaleDateString('es-VE',{day:'2-digit',month:'short',year:'numeric'}) }
function fmtFechaHora(f){ if(!f) return ''; const d=new Date(f); return isNaN(d)?f:d.toLocaleString('es-VE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) }
function telWa(t){
  let d = String(t||'').replace(/\D/g,'');
  if(!d) return '';
  if(d.startsWith('0')) d = '58' + d.slice(1);
  else if(d.length === 10 && d.startsWith('4')) d = '58' + d;
  return d;
}
function toast(msg){
  document.querySelectorAll('.toast').forEach(x=>x.remove());
  const t = document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(), 2800);
}
async function copiar(texto){
  try{ await navigator.clipboard.writeText(texto); toast('Copiado'); }
  catch(e){
    const sh = modal(`<h2>Copiar</h2><p class="muted">Selecciona el texto y cópialo.</p><textarea style="min-height:220px" readonly>${esc(texto)}</textarea><div class="acts"><button class="btn" data-x>Cerrar</button></div>`);
    sh.querySelector('textarea').select();
  }
}
function errorTxt(e){
  const c = e && e.code;
  if(c==='quota_exceeded') return 'Se llenó el espacio de la base de datos. Borra rifas viejas.';
  if(c==='invalid_argument') return 'No tienes permiso para guardar aquí, o un dato no es válido.';
  if(c==='unavailable') return 'No se pudo guardar. Intenta de nuevo.';
  return 'No se pudo guardar' + (e && e.message ? ': ' + e.message : '');
}

// ---------- tasas de cambio ----------
// S.tasas[m] = cuántas unidades de la moneda m equivalen a 1 $.
function tasaEntre(m, base){
  if(m === base) return 1;
  const a = Number(S.tasas[m]), b = Number(S.tasas[base]);
  if(!(a > 0) || !(b > 0)) return null;
  return a / b; // unidades de m por 1 unidad de base
}

// ---------- modelo ----------
function normRifa(r){
  const o = { ...r };
  o.cantidad = Number(o.cantidad)||100; o.inicio = Number(o.inicio)||0; o.precio = Number(o.precio)||0; o.moneda = o.moneda || '$';
  if(!Array.isArray(o.premios)){
    o.premios = [{ id:'p1', nombre: o.premio || 'Premio mayor', requisito:100, fecha:o.fecha||'', loteria:o.loteria||'', ganador: o.ganador ? { ...o.ganador, juega:true } : null }];
  }
  o.premios = o.premios.map(p => ({ ...p, requisito: Number(p.requisito)||0 }));
  return o;
}
function premiosOrden(r){
  return [...r.premios].sort((a,b) => (a.fecha||'9999').localeCompare(b.fecha||'9999') || a.requisito - b.requisito);
}
function premioMayor(r){ const ps = premiosOrden(r); return ps[ps.length-1]; }
function proximoPremio(r){ return premiosOrden(r).find(p => !p.ganador) || null; }

// Calcula abonado, % y estado de un número a partir de su historial de abonos.
function info(r, d){
  if(!d) return null;
  const precio = r.precio;
  let abonos = d.abonos;
  if(!Array.isArray(abonos)){ // datos de la versión anterior
    const ab = d.estado === 'pagado' ? precio : Math.min(Number(d.abonado)||0, precio);
    abonos = ab > 0 ? [{ id:'m', monto:ab, moneda:r.moneda, tasa:1, equiv:ab, metodo:d.metodo||'', referencia:d.referencia||'', fecha:d.fecha||'' }] : [];
  }
  const abonado = abonos.reduce((s,a) => s + (Number(a.equiv)||0), 0);
  const pct = precio > 0 ? Math.min(100, abonado / precio * 100) : 100;
  const estado = abonado >= precio - EPS ? 'pagado' : 'apartado';
  return { ...d, num:Number(d.num), abonos, abonado, pct, debe: Math.max(0, precio - abonado), estado };
}
function num(n){ const r = rifa(); return r ? info(r, S.raw.get(n)) : null; }
function numerosVendidos(){ const r = rifa(); return [...S.raw.values()].map(d => info(r, d)).sort((a,b)=>a.num-b.num); }
function juega(p, inf){ return !!inf && inf.pct + 1e-9 >= p.requisito; }

function calcStats(r, lista){
  let pag=0, apa=0, cobrado=0;
  for(const d of lista){ if(d.estado==='pagado') pag++; else apa++; cobrado += Math.min(d.abonado, r.precio); }
  const vendidos = pag + apa;
  return { total:r.cantidad, pag, apa, libres:r.cantidad-vendidos, cobrado, porCobrar: vendidos*r.precio - cobrado, potencial: r.cantidad*r.precio };
}

// ---------- modal ----------
function modal(html){
  const m = $('#modal');
  m.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
  m.hidden = false;
  const sh = m.querySelector('.sheet');
  sh.querySelectorAll('[data-x]').forEach(b => b.onclick = cerrarModal);
  return sh;
}
function cerrarModal(){ const m=$('#modal'); m.hidden=true; m.innerHTML=''; }
$('#modal').addEventListener('click', e => { if(e.target.id === 'modal') cerrarModal(); });
function confirmar(msg, okTxt='Sí', peligro=false){
  return new Promise(res => {
    const sh = modal(`<h2>${esc(msg)}</h2><div class="acts"><button class="btn" id="cNo">Cancelar</button><button class="btn ${peligro?'danger':'pri'}" id="cSi">${esc(okTxt)}</button></div>`);
    sh.querySelector('#cNo').onclick = () => { cerrarModal(); res(false) };
    sh.querySelector('#cSi').onclick = () => { cerrarModal(); res(true) };
  });
}

// ---------- datos ----------
function iniciarDB(){
  const timer = setTimeout(()=>{ if(!S.rifasCargadas){ S.aviso='Todavía no hay conexión con la base de datos.'; render(); } }, 10000);
  S.db.collection('rifas').onSnapshot(snap => {
    S.rifas = snap.docs.filter(d => d.data() && d.data().nombre).map(d => normRifa({ id:d.id, ...d.data() }))
      .sort((a,b) => String(b.creada||'').localeCompare(String(a.creada||'')));
    if(!snap.metadata.fromCache){ clearTimeout(timer); S.aviso=''; }
    S.rifasCargadas = true;
    if(S.rifaId && !rifa()) salirRifa();
    if(!S.rifaId) cargarStatsLista();
    render();
  }, err => { clearTimeout(timer); S.aviso = 'No se pudo leer la base de datos ('+err.code+').'; S.rifasCargadas=true; render(); });
  S.db.doc('config/tasas').onSnapshot(s => {
    if(s.exists){ const d = s.data(); S.tasas = { ...S.tasas, ...(d.tasas||{}), '$':1 }; S.tasasFecha = d.actualizado||''; }
    render();
  }, () => {});
}

let statsPend = null;
function cargarStatsLista(){
  clearTimeout(statsPend);
  statsPend = setTimeout(async () => {
    for(const r of S.rifas){
      try{
        const q = await S.db.collection(`rifas/${r.id}/numeros`).limit(1000).get();
        S.stats[r.id] = calcStats(r, q.docs.map(d=>d.data()).filter(d => d && d.nombre).map(d => info(r, d)));
      }catch(e){}
    }
    if(!S.rifaId) render();
  }, 300);
}

function abrirRifa(id){
  if(S.unsubNums) S.unsubNums();
  S.rifaId = id; S.raw = new Map(); S.numsCargados = false;
  S.tab='numeros'; S.filtro='todos'; S.q=''; S.qComp=''; S.multi=false; S.sel.clear();
  const timer = setTimeout(()=>{ if(!S.numsCargados){ S.aviso='Los números aún no cargan.'; render(); } }, 10000);
  S.unsubNums = S.db.collection(`rifas/${id}/numeros`).limit(1000).onSnapshot(snap => {
    const m = new Map();
    for(const d of snap.docs){ const x = d.data(); if(x && x.nombre) m.set(Number(x.num), x); }
    S.raw = m; S.numsCargados = true;
    if(!snap.metadata.fromCache){ clearTimeout(timer); S.aviso=''; }
    render();
  }, err => { clearTimeout(timer); S.aviso='Error leyendo números ('+err.code+').'; render(); });
  render(); window.scrollTo(0,0);
}
function salirRifa(){
  if(S.unsubNums) S.unsubNums();
  S.unsubNums=null; S.rifaId=null; S.multi=false; S.sel.clear();
  cargarStatsLista(); render(); window.scrollTo(0,0);
}
function refNum(n){ return S.db.doc(`rifas/${S.rifaId}/numeros/${n}`); }
async function guardarNum(d){
  const { abonado, pct, debe, estado, ...limpio } = d; // lo calculado no se guarda
  limpio.estado = estado; // se guarda solo como referencia rápida
  limpio.actualizado = nowISO();
  await refNum(d.num).set(limpio);
}

// ---------- render ----------
function render(){
  renderTop();
  const app = $('#app');
  let h = S.aviso ? `<div class="banner">${esc(S.aviso)}</div>` : '';
  if(!S.dbListo && !S.iniciado){ app.innerHTML = h + '<p class="muted">Cargando…</p>'; return; }
  if(!S.dbListo){ app.innerHTML = h + `<div class="card empty"><h3>No se pudo abrir la base de datos</h3><p class="muted">Cierra la app y vuelve a abrirla.</p></div>`; $('#multibar').innerHTML=''; return; }
  if(!S.rifasCargadas){ app.innerHTML = h + '<p class="muted">Cargando rifas…</p>'; return; }
  h += S.rifaId ? vistaRifa() : vistaLista();
  app.innerHTML = h;
  renderMultibar();
}
function renderTop(){
  const t = $('#top'); const r = rifa();
  if(!S.rifaId || !r){
    t.innerHTML = `<h1>🎟️ Rifas</h1>${S.dbListo?`${botonSync()}<button class="btn" id="bTasas" title="Tasas">💱<span class="lbl"> Tasas</span></button>${S.respaldo?'<button class="btn" id="bRespaldo" title="Respaldo">💾<span class="lbl"> Respaldo</span></button>':''}<button class="btn pri" id="bNueva" title="Nueva rifa">+<span class="lbl"> Nueva</span></button>`:''}`;
  } else {
    t.innerHTML = `<button class="btn icon" id="bAtras" aria-label="Volver">←</button><h1>${esc(r.nombre)}</h1><button class="btn" id="bImagen" title="Imagen para estados">🖼️<span class="lbl"> Imagen</span></button><button class="btn" id="bTasas" title="Tasas">💱<span class="lbl"> Tasas</span></button><button class="btn icon" id="bEditar" aria-label="Editar rifa">⚙️</button>`;
  }
}
function lineaPremios(r){
  return premiosOrden(r).map(p => `${esc(p.nombre)}${p.requisito<100?` (${p.requisito}%)`:''}${p.fecha?' · '+esc(fmtFecha(p.fecha)):''}${p.ganador?' ✓':''}`).join('<br>');
}
function vistaLista(){
  if(!S.rifas.length) return `<div class="card empty"><h3>Aún no tienes rifas</h3><p class="muted">Crea tu primera rifa para empezar a vender números.</p><button class="btn pri" id="bNueva2">+ Crear rifa</button></div>`;
  return `<div class="lista">` + S.rifas.map(r => {
    const s = S.stats[r.id];
    const pctP = s ? s.pag/s.total*100 : 0, pctA = s ? s.apa/s.total*100 : 0;
    const prox = proximoPremio(r);
    return `<div class="card rcard" data-abrir="${esc(r.id)}">
      <div class="row"><h3 class="grow">${esc(r.nombre)}</h3>${r.estado==='finalizada'?'<span class="tag fin">Finalizada</span>':'<span class="tag">Activa</span>'}</div>
      <div class="muted">${money(r.precio,r)} por número · ${r.cantidad} números</div>
      <div class="muted" style="font-size:13px;margin-top:4px">${prox?`Próximo: ${esc(prox.nombre)}${prox.fecha?' · '+esc(fmtFecha(prox.fecha)):''}`:'Todos los premios sorteados'}</div>
      <div class="bar"><i style="width:${pctP}%;background:var(--pag)"></i><i style="width:${pctA}%;background:var(--apar)"></i></div>
      <div class="row" style="font-size:13px">${s?`<span class="grow">${s.pag+s.apa}/${s.total} vendidos</span><span>Cobrado <b>${money(s.cobrado,r)}</b></span>`:'<span class="muted">calculando…</span>'}</div>
    </div>`;
  }).join('') + `</div>`;
}
function vistaRifa(){
  const r = rifa(); if(!r) return '';
  const tabs = [['numeros','Números'],['compradores','Compradores'],['premios','Premios'],['resumen','Resumen']];
  let h = `<div class="muted">${money(r.precio,r)} por número · ${premiosOrden(r).length} premio(s)</div>`;
  h += `<div class="tabs">${tabs.map(([k,v])=>`<button data-tab="${k}" class="${S.tab===k?'on':''}">${v}</button>`).join('')}</div>`;
  if(!S.numsCargados) return h + '<p class="muted">Cargando números…</p>';
  if(S.tab==='numeros') h += tabNumeros(r);
  if(S.tab==='compradores') h += tabCompradores(r);
  if(S.tab==='premios') h += tabPremios(r);
  if(S.tab==='resumen') h += tabResumen(r);
  return h;
}
function tabNumeros(r){
  const lista = numerosVendidos();
  const s = calcStats(r, lista);
  const fil = [['todos','Todos ('+s.total+')'],['libres','Libres ('+s.libres+')'],['apartados','Deben ('+s.apa+')'],['pagados','Pagados ('+s.pag+')']];
  const prox = proximoPremio(r);
  if(prox && prox.requisito < 100) fil.push(['juegan', `Juegan ${esc(prox.nombre)} (${lista.filter(d=>juega(prox,d)).length})`]);
  let h = `<div class="row"><div class="chips grow">${fil.map(([k,v])=>`<button class="chip ${S.filtro===k?'on':''}" data-fil="${k}">${v}</button>`).join('')}</div>
    <button class="btn sm ${S.multi?'pri':''}" id="bMulti">${S.multi?'✓ Selección múltiple':'Seleccionar varios'}</button></div>
    <div style="margin-top:10px"><input type="search" id="qNum" placeholder="Buscar número o nombre…" value="${esc(S.q)}"></div>`;
  const q = S.q.trim().toLowerCase();
  const ganadores = new Map(r.premios.filter(p => p.ganador && p.ganador.juega).map(p => [Number(p.ganador.numero), p.nombre]));
  const celdas = [];
  for(const n of rango(r)){
    const d = info(r, S.raw.get(n)); const est = d ? d.estado : 'libre';
    if(S.filtro==='libres' && d) continue;
    if(S.filtro==='apartados' && est!=='apartado') continue;
    if(S.filtro==='pagados' && est!=='pagado') continue;
    if(S.filtro==='juegan' && !(prox && juega(prox, d))) continue;
    const txt = fmtNum(r,n);
    if(q && !(txt.includes(q) || (d && (String(d.nombre).toLowerCase().includes(q) || String(d.telefono||'').includes(q))))) continue;
    const cls = ['n', d?est:'', S.sel.has(n)?'sel':'', ganadores.has(n)?'gan':''].join(' ');
    const tit = d ? `${d.nombre} · ${pctTxt(d.pct)}` : 'Libre';
    const barra = d && d.estado==='apartado' ? `<i class="pb" style="width:${d.pct}%"></i>` : '';
    celdas.push(`<button class="${cls}" data-n="${n}" title="${esc(tit)}">${txt}${barra}</button>`);
  }
  h += `<div class="legend"><span style="--c:var(--libre)">Libre</span><span style="--c:var(--apar)">Debe (la barrita es lo abonado)</span><span style="--c:var(--pag)">Pagado</span><span style="--c:#eab308">Ganador</span></div>`;
  h += celdas.length ? `<div class="grid" id="grid">${celdas.join('')}</div>` : `<p class="muted" style="margin-top:16px">No hay números que coincidan.</p>`;
  return h;
}

function compradores(r){
  const map = new Map();
  for(const d of numerosVendidos()){
    const key = telWa(d.telefono) || String(d.nombre).trim().toLowerCase();
    if(!map.has(key)) map.set(key, { nombre:d.nombre, telefono:d.telefono, nums:[] });
    map.get(key).nums.push(d);
  }
  return [...map.values()].map(c => {
    const pagado = c.nums.reduce((s,d)=>s+Math.min(d.abonado, r.precio),0);
    return { ...c, total: c.nums.length*r.precio, pagado, debe: c.nums.length*r.precio - pagado };
  }).sort((a,b)=> b.debe - a.debe || String(a.nombre).localeCompare(String(b.nombre)));
}
function tabCompradores(r){
  const q = S.qComp.trim().toLowerCase();
  const lista = compradores(r).filter(c => !q || String(c.nombre).toLowerCase().includes(q) || String(c.telefono||'').includes(q));
  S._compVista = lista;
  let h = `<input type="search" id="qComp" placeholder="Buscar comprador…" value="${esc(S.qComp)}">`;
  if(!lista.length) return h + `<p class="muted" style="margin-top:16px">${S.raw.size?'Nadie coincide con la búsqueda.':'Todavía no has vendido números.'}</p>`;
  h += `<div class="comp" style="margin-top:12px">` + lista.map((c,i) => {
    const wa = telWa(c.telefono);
    return `<div class="card">
      <div class="row"><h4 class="grow">${esc(c.nombre)}</h4>${c.debe>EPS?`<span class="debe">Debe ${money(c.debe,r)}</span>`:'<span class="tag fin">Al día</span>'}</div>
      <div class="muted">${esc(c.telefono||'Sin teléfono')} · ${c.nums.length} número(s) · ${money(c.total,r)}</div>
      <div class="nums">${c.nums.map(d=>`<b class="${d.estado}" title="${pctTxt(d.pct)}">${fmtNum(r,d.num)}${d.estado==='apartado'?' · '+Math.floor(d.pct)+'%':''}</b>`).join('')}</div>
      <div class="row">${c.debe>EPS?`<button class="btn sm ok" data-abonarcomp="${i}">Registrar abono</button>`:''}
      ${wa?`<a class="btn sm" href="https://wa.me/${wa}?text=${encodeURIComponent(msgComprador(r,c))}" target="_blank" rel="noopener">WhatsApp</a>`:''}
      <button class="btn sm" data-copiarmsg="${i}">Copiar mensaje</button></div>
    </div>`;
  }).join('') + `</div>`;
  return h;
}
function msgComprador(r, c){
  let m = `Hola ${c.nombre}! Tus números de la rifa "${r.nombre}":\n`;
  m += c.nums.map(d => `• ${fmtNum(r,d.num)}: ${d.estado==='pagado'?'pagado':'abonado '+Math.floor(d.pct)+'%'}`).join('\n');
  m += `\nTotal: ${money(c.total,r)}. Pagado: ${money(c.pagado,r)}.`;
  if(c.debe > EPS) m += ` Pendiente: ${money(c.debe,r)}.`;
  const pend = premiosOrden(r).filter(p => !p.ganador);
  if(pend.length){
    m += `\n\nPremios:`;
    for(const p of pend){
      const juegan = c.nums.filter(d => juega(p,d)).length;
      m += `\n• ${p.nombre}${p.fecha?' ('+fmtFecha(p.fecha)+')':''}: `;
      if(juegan === c.nums.length) m += 'ya participas ✅';
      else m += `necesitas tener ${p.requisito}% abonado (${money(r.precio*p.requisito/100,r)} por número)` + (juegan?`; ya juegan ${juegan} de ${c.nums.length}`:'');
    }
  }
  return m + `\n\n¡Gracias y suerte! 🍀`;
}

function tabPremios(r){
  const lista = numerosVendidos();
  let h = `<p class="muted" style="margin-top:0">Cada premio tiene su fecha y el % mínimo abonado para participar. Para cambiarlos usa ⚙️.</p>`;
  h += premiosOrden(r).map(p => {
    const juegan = lista.filter(d => juega(p,d)).length;
    let cuerpo;
    if(p.ganador){
      const g = p.ganador;
      cuerpo = `<div class="ganador"><div class="big">${fmtNum(r,g.numero)}</div>
        <h3 style="margin:4px 0">${g.nombre?esc(g.nombre):'Número no vendido'}</h3>
        <div class="${g.juega?'':'debe'}">${g.juega?'Ganador ✅':(g.nombre?`No participaba: tenía ${pctTxt(g.pct||0)} abonado`:'Nadie gana con este número')}</div>
        <div class="muted" style="font-size:13px;margin-top:6px">${g.metodo==='aleatorio'?'Sorteado en la app':'Resultado de la lotería'} · ${esc(fmtFechaHora(g.fecha))}</div>
        <button class="btn sm" style="margin-top:10px" data-quitargan="${esc(p.id)}">Borrar resultado</button></div>`;
    } else {
      cuerpo = `<div class="row" style="margin-top:10px"><input type="text" inputmode="numeric" data-numgan="${esc(p.id)}" placeholder="Número que salió" style="max-width:170px">
        <button class="btn pri" data-vergan="${esc(p.id)}">Ver ganador</button><button class="btn" data-azar="${esc(p.id)}">🎲 Sortear en la app</button></div>
        <div data-resgan="${esc(p.id)}" style="margin-top:10px"></div>`;
    }
    return `<div class="card" style="margin-bottom:12px">
      <div class="row"><h3 class="grow" style="margin:0">${esc(p.nombre)}</h3><span class="tag">${p.requisito>=100?'Número pagado completo':`Con ${p.requisito}% abonado`}</span></div>
      <div class="muted">${p.fecha?'Sorteo '+esc(fmtFecha(p.fecha)):'Sin fecha'}${p.loteria?' · '+esc(p.loteria):''} · Participan ahora: <b>${juegan}</b> número(s)</div>
      ${cuerpo}</div>`;
  }).join('');
  return h;
}

function tabResumen(r){
  const lista = numerosVendidos();
  const s = calcStats(r, lista);
  const porMoneda = {}, porMetodo = {};
  for(const d of lista) for(const a of d.abonos){
    porMoneda[a.moneda] = (porMoneda[a.moneda]||0) + (Number(a.monto)||0);
    const k = a.metodo || 'Sin indicar'; porMetodo[k] = (porMetodo[k]||0) + (Number(a.equiv)||0);
  }
  const pct = s.total ? Math.round((s.pag+s.apa)/s.total*100) : 0;
  let h = `<div class="stats">
    <div class="stat"><small>Vendidos</small><b>${s.pag+s.apa} / ${s.total}</b><small>${pct}%</small></div>
    <div class="stat"><small>Pagados completo</small><b style="color:var(--pag)">${s.pag}</b></div>
    <div class="stat"><small>Deben</small><b style="color:var(--apar)">${s.apa}</b></div>
    <div class="stat"><small>Libres</small><b>${s.libres}</b></div>
    <div class="stat"><small>Cobrado (equivalente)</small><b>${money(s.cobrado,r)}</b></div>
    <div class="stat"><small>Por cobrar</small><b class="${s.porCobrar>EPS?'debe':''}">${money(s.porCobrar,r)}</b></div>
    <div class="stat"><small>Si se vende todo</small><b>${money(s.potencial,r)}</b></div>
  </div>`;
  const ms = Object.entries(porMoneda);
  if(ms.length) h += `<div class="card" style="margin-top:12px"><b>Dinero recibido por moneda</b><table class="det" style="margin-top:6px">${ms.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${fmtM(v,k)}</td></tr>`).join('')}</table></div>`;
  const me = Object.entries(porMetodo);
  if(me.length) h += `<div class="card" style="margin-top:12px"><b>Por método de pago (en ${esc(r.moneda)})</b><table class="det" style="margin-top:6px">${me.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${money(v,r)}</td></tr>`).join('')}</table></div>`;
  h += `<div class="card" style="margin-top:12px"><b>Participantes por premio</b><table class="det" style="margin-top:6px">${premiosOrden(r).map(p=>`<tr><td>${esc(p.nombre)}${p.fecha?' · '+esc(fmtFecha(p.fecha)):''}</td><td>${lista.filter(d=>juega(p,d)).length} número(s) con ${p.requisito}% o más</td></tr>`).join('')}</table></div>`;
  h += `<div class="card" style="margin-top:12px"><b>Compartir y exportar</b>
    <div class="row" style="margin-top:10px">
      <button class="btn pri" id="bImagen2">🖼️ Imagen para estados</button>
      <button class="btn" id="bCopLibres">Copiar números libres</button>
      <a class="btn" href="https://wa.me/?text=${encodeURIComponent(textoLibres(r))}" target="_blank" rel="noopener">Enviar libres por WhatsApp</a>
      <button class="btn" id="bCSV">Exportar a Excel (CSV)</button>
    </div></div>`;
  return h;
}
function textoLibres(r){
  const libres = rango(r).filter(n => !S.raw.has(n)).map(n => fmtNum(r,n));
  let t = `🎟️ RIFA: ${r.nombre}\n💵 Precio: ${money(r.precio,r)} (aceptamos varias monedas)\n\n🏆 Premios:\n`;
  t += premiosOrden(r).map(p => `• ${p.nombre}${p.fecha?' — '+fmtFecha(p.fecha):''}${p.loteria?' ('+p.loteria+')':''}${p.requisito<100?` — juegas con ${p.requisito}% abonado`:' — número pagado completo'}${p.ganador?' [ya sorteado]':''}`).join('\n');
  t += `\n\nNúmeros disponibles (${libres.length}):\n${libres.join(' ')}`;
  return t;
}
function renderMultibar(){
  const mb = $('#multibar');
  if(!(S.rifaId && S.multi && S.tab==='numeros')){ mb.innerHTML=''; return; }
  const r = rifa();
  mb.innerHTML = `<div class="multibar"><span class="grow"><b>${S.sel.size}</b> seleccionado(s)${S.sel.size?' · '+money(S.sel.size*r.precio,r):''}</span>
    <button class="btn" id="bMultiCancel">Cancelar</button><button class="btn pri" id="bMultiAsig" ${S.sel.size?'':'disabled'}>Asignar</button></div>`;
}

// ---------- formulario de rifa ----------
function filaPremio(p){
  return `<div class="premio-ed" data-pid="${esc(p.id)}">
    <div class="row"><input type="text" class="grow" data-k="nombre" placeholder="Nombre del premio" value="${esc(p.nombre)}" required style="flex:1;min-width:0">
      <button type="button" class="btn sm danger" data-quitarpremio title="Quitar premio">✕</button></div>
    <div class="three">
      <label class="f"><span>% abonado para jugar</span><input type="number" data-k="requisito" min="0" max="100" step="1" value="${esc(p.requisito)}"></label>
      <label class="f"><span>Fecha</span><input type="date" data-k="fecha" value="${esc(p.fecha||'')}"></label>
      <label class="f"><span>Lotería</span><input type="text" data-k="loteria" value="${esc(p.loteria||'')}" placeholder="Triple Táchira"></label>
    </div></div>`;
}
function formRifa(r){
  const e = r || { nombre:'', precio:'', moneda:'$', cantidad:100, inicio:0, notas:'',
    premios:[{ id:uid(), nombre:'Premio mayor', requisito:100, fecha:'', loteria:'' }] };
  const sh = modal(`<h2>${r?'Editar rifa':'Nueva rifa'}</h2>
  <form id="fRifa">
    <label class="f"><span>Nombre de la rifa</span><input type="text" name="nombre" required value="${esc(e.nombre)}" placeholder="Ej: Rifa de diciembre"></label>
    <div class="two">
      <label class="f"><span>Precio por número</span><input type="number" name="precio" required min="0" step="0.01" value="${esc(e.precio)}"></label>
      <label class="f"><span>Moneda de referencia</span><select name="moneda">${MONEDAS.map(m=>`<option ${e.moneda===m?'selected':''}>${m}</option>`).join('')}</select></label>
    </div>
    <p class="muted" style="font-size:13px;margin:-4px 0 10px">Los compradores pueden pagar en cualquier moneda; la app lo convierte con la tasa.</p>
    <div class="two">
      <label class="f"><span>Cantidad de números</span><input type="number" name="cantidad" required min="2" max="1000" value="${esc(e.cantidad)}"></label>
      <label class="f"><span>Empieza en</span><select name="inicio"><option value="0" ${Number(e.inicio)===0?'selected':''}>0 (00, 01, 02…)</option><option value="1" ${Number(e.inicio)===1?'selected':''}>1 (01, 02, 03…)</option></select></label>
    </div>
    <div class="row" style="margin:6px 0 8px"><b class="grow">Premios</b><button type="button" class="btn sm" id="bAddPremio">+ Premio especial</button></div>
    <div id="premiosEd">${premiosOrden(normRifa(e)).map(filaPremio).join('')}</div>
    <label class="f"><span>Notas</span><textarea name="notas">${esc(e.notas||'')}</textarea></label>
    <div id="errRifa" class="debe"></div>
    <div class="acts">${r?'<button type="button" class="btn danger" id="bBorrarRifa" style="margin-right:auto">Eliminar</button>':''}<button type="button" class="btn" data-x>Cancelar</button><button class="btn pri">Guardar</button></div>
  </form>`);
  const cont = sh.querySelector('#premiosEd');
  sh.querySelector('#bAddPremio').onclick = () => {
    const n = cont.querySelectorAll('.premio-ed').length;
    cont.insertAdjacentHTML('afterbegin', filaPremio({ id:uid(), nombre:`Premio especial ${n}`, requisito:50, fecha:'', loteria:'' }));
  };
  cont.addEventListener('click', ev => {
    const b = ev.target.closest('[data-quitarpremio]'); if(!b) return;
    if(cont.querySelectorAll('.premio-ed').length <= 1) return toast('La rifa necesita al menos un premio');
    b.closest('.premio-ed').remove();
  });
  sh.querySelector('#fRifa').onsubmit = async ev => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const previos = r ? new Map(r.premios.map(p => [p.id, p])) : new Map();
    const premios = [...cont.querySelectorAll('.premio-ed')].map(el => {
      const g = k => el.querySelector(`[data-k=${k}]`).value.trim();
      const id = el.dataset.pid; const prev = previos.get(id);
      return { id, nombre:g('nombre') || 'Premio', requisito: Math.min(100, Math.max(0, Number(g('requisito'))||0)), fecha:g('fecha'), loteria:g('loteria'), ganador: prev ? (prev.ganador||null) : null };
    });
    const datos = {
      nombre: f.get('nombre').trim(), precio: Number(f.get('precio'))||0, moneda: f.get('moneda'),
      cantidad: Math.min(1000, Math.max(2, parseInt(f.get('cantidad'))||100)), inicio: Number(f.get('inicio')),
      notas: f.get('notas').trim(), premios
    };
    datos.estado = premios.every(p => p.ganador) ? 'finalizada' : 'activa';
    if(r){
      const fuera = numerosVendidos().filter(d => d.num < datos.inicio || d.num > datos.inicio + datos.cantidad - 1);
      if(fuera.length){ sh.querySelector('#errRifa').textContent = `No se puede: los números ${fuera.slice(0,8).map(d=>d.num).join(', ')} ya están vendidos y quedarían fuera del rango.`; return; }
    }
    const btn = ev.target.querySelector('button.pri'); btn.disabled = true;
    try{
      if(r){
        const { id, ...resto } = r;
        await S.db.doc(`rifas/${r.id}`).set({ ...resto, ...datos, premio:null, fecha:null, loteria:null, ganador:null });
        cerrarModal(); toast('Rifa actualizada');
      } else {
        const ref = S.db.collection('rifas').doc();
        await ref.set({ ...datos, creada:nowISO() });
        cerrarModal(); toast('Rifa creada'); abrirRifa(ref.id);
      }
    }catch(e){ btn.disabled=false; sh.querySelector('#errRifa').textContent = errorTxt(e); }
  };
  const bb = sh.querySelector('#bBorrarRifa');
  if(bb) bb.onclick = async () => {
    if(!await confirmar(`¿Eliminar la rifa "${r.nombre}" y todos sus números? No se puede deshacer.`, 'Eliminar', true)) return;
    try{
      const q = await S.db.collection(`rifas/${r.id}/numeros`).limit(1000).get();
      for(const d of q.docs) await S.db.doc(`rifas/${r.id}/numeros/${d.id}`).delete();
      await S.db.doc(`rifas/${r.id}`).delete();
      toast('Rifa eliminada'); salirRifa();
    }catch(e){ toast(errorTxt(e)); }
  };
}

// ---------- tasas ----------
function ventanaTasas(){
  const sh = modal(`<h2>Tasas del día</h2>
    <p class="muted">Cuánto vale 1 $ en cada moneda. Se usan para convertir los abonos; en cada abono puedes cambiar la tasa si ese día fue otra.</p>
    <form id="fTasas">${MONEDAS.filter(m=>m!=='$').map(m=>`<label class="f"><span>1 $ = … ${esc(m)}</span><input type="number" name="${esc(m)}" min="0" step="any" value="${esc(S.tasas[m]||'')}"></label>`).join('')}
    <div class="muted" style="font-size:13px">${S.tasasFecha?'Última actualización: '+esc(fmtFechaHora(S.tasasFecha)):''}</div>
    <div class="acts"><button type="button" class="btn" data-x>Cancelar</button><button class="btn pri">Guardar</button></div></form>`);
  sh.querySelector('#fTasas').onsubmit = async ev => {
    ev.preventDefault();
    const f = new FormData(ev.target); const tasas = { '$':1 };
    for(const m of MONEDAS) if(m!=='$'){ const v = Number(f.get(m)); if(v>0) tasas[m]=v; }
    try{ await S.db.doc('config/tasas').set({ tasas, actualizado: nowISO() }); cerrarModal(); toast('Tasas guardadas'); }
    catch(e){ toast(errorTxt(e)); }
  };
}

// ---------- campos de abono (se reusan en varios formularios) ----------
function camposAbono(r, sugerido, titulo){
  return `<fieldset class="abono"><legend>${titulo}</legend>
    <div class="two">
      <label class="f"><span>Monto</span><input type="number" name="monto" min="0" step="any" placeholder="0"></label>
      <label class="f"><span>Moneda</span><select name="amoneda">${MONEDAS.map(m=>`<option ${m===r.moneda?'selected':''}>${m}</option>`).join('')}</select></label>
    </div>
    <div class="two">
      <label class="f" data-wtasa><span data-ltasa>Tasa</span><input type="number" name="tasa" min="0" step="any"></label>
      <label class="f"><span>Método</span><select name="metodo">${METODOS.map(m=>`<option>${m}</option>`).join('')}</select></label>
    </div>
    <label class="f"><span>Referencia</span><input type="text" name="referencia" placeholder="Últimos dígitos"></label>
    <div class="row"><span class="grow muted" data-equiv></span>${sugerido>0?`<button type="button" class="btn sm" data-completo>Pagar completo</button>`:''}</div>
  </fieldset>`;
}
// Conecta los campos de abono: tasa sugerida, equivalente en vivo y botón "pagar completo".
function activarAbono(cont, r, sugerido){
  const q = n => cont.querySelector(`[name=${n}]`);
  const upd = () => {
    const m = q('amoneda').value; const base = r.moneda;
    const w = cont.querySelector('[data-wtasa]');
    w.style.display = m === base ? 'none' : '';
    cont.querySelector('[data-ltasa]').textContent = `Tasa: 1 ${base} = … ${m}`;
    const t = m === base ? 1 : Number(q('tasa').value);
    const monto = Number(q('monto').value)||0;
    cont.querySelector('[data-equiv]').textContent = monto ? (t>0 ? `≈ ${money(monto/t, r)}` : 'Falta la tasa') : '';
  };
  q('amoneda').onchange = () => { const t = tasaEntre(q('amoneda').value, r.moneda); q('tasa').value = t ? +t.toFixed(6) : ''; upd(); };
  q('monto').oninput = upd; q('tasa').oninput = upd;
  const bc = cont.querySelector('[data-completo]');
  if(bc) bc.onclick = () => {
    const m = q('amoneda').value; const t = m === r.moneda ? 1 : Number(q('tasa').value);
    if(!(t>0)) return toast('Primero pon la tasa');
    q('monto').value = +(sugerido * t).toFixed(m==='COP'?0:2); upd();
  };
  q('amoneda').onchange();
}
// Lee el abono del formulario. Devuelve null si no hay monto, o {error} si falta algo.
function leerAbono(cont, r){
  const q = n => cont.querySelector(`[name=${n}]`);
  const monto = Number(q('monto').value)||0;
  if(monto <= 0) return null;
  const moneda = q('amoneda').value;
  const tasa = moneda === r.moneda ? 1 : Number(q('tasa').value);
  if(!(tasa > 0)) return { error:'Falta la tasa de cambio para ' + moneda };
  return { id:uid(), monto, moneda, tasa, equiv: monto / tasa, metodo:q('metodo').value, referencia:q('referencia').value.trim(), fecha:nowISO() };
}
// Reparte un abono entre varios números, llenando primero los que tienen más abonado.
function repartir(r, numsInfo, abono){
  let resto = abono.equiv; const res = [];
  const orden = [...numsInfo].sort((a,b) => b.pct - a.pct || a.num - b.num);
  for(const d of orden){
    if(resto <= EPS) break;
    const falta = Math.max(0, r.precio - d.abonado); if(falta <= EPS) continue;
    const eq = Math.min(falta, resto); resto -= eq;
    const parte = eq / abono.equiv;
    res.push({ d, abono: { ...abono, id:uid(), equiv:eq, monto: abono.monto * parte } });
  }
  return { partes:res, sobra: resto > EPS ? resto : 0 };
}

// ---------- asignar / editar número ----------
function formNumero(nums, actual){
  const r = rifa();
  const e = actual || { nombre:'', telefono:'', nota:'' };
  const comps = compradores(r);
  const sh = modal(`<h2>${actual?'Editar datos del '+fmtNum(r,actual.num):'Asignar '+(nums.length>1?nums.length+' números':'número '+fmtNum(r,nums[0]))}</h2>
  ${nums.length>1?`<div class="nums">${nums.map(n=>`<b>${fmtNum(r,n)}</b>`).join('')}</div>`:''}
  <form id="fNum">
    <label class="f"><span>Nombre del comprador</span><input type="text" name="nombre" required list="dlComp" value="${esc(e.nombre)}" autocomplete="off"></label>
    <datalist id="dlComp">${comps.map(c=>`<option value="${esc(c.nombre)}">`).join('')}</datalist>
    <label class="f"><span>Teléfono (WhatsApp)</span><input type="tel" name="telefono" value="${esc(e.telefono)}" placeholder="0414-1234567"></label>
    <label class="f"><span>Nota</span><input type="text" name="nota" value="${esc(e.nota)}"></label>
    ${actual?'':camposAbono(r, nums.length*r.precio, `Abono ahora (opcional) · total ${money(nums.length*r.precio,r)}`)}
    ${!actual && nums.length>1?'<p class="muted" style="font-size:13px">El abono se reparte entre los números, completando uno por uno.</p>':''}
    <div id="errNum" class="debe"></div>
    <div class="acts"><button type="button" class="btn" data-x>Cancelar</button><button class="btn pri">Guardar</button></div>
  </form>`);
  const form = sh.querySelector('#fNum');
  if(!actual) activarAbono(form, r, nums.length*r.precio);
  form.nombre.addEventListener('change', () => {
    const c = comps.find(c => c.nombre.toLowerCase() === form.nombre.value.trim().toLowerCase());
    if(c && !form.telefono.value) form.telefono.value = c.telefono || '';
  });
  form.onsubmit = async ev => {
    ev.preventDefault();
    const datos = { nombre: form.nombre.value.trim(), telefono: form.telefono.value.trim(), nota: form.nota.value.trim() };
    const err = m => { sh.querySelector('#errNum').textContent = m; };
    const btn = form.querySelector('button.pri');
    if(actual){
      btn.disabled = true;
      try{ await guardarNum({ ...num(actual.num), ...datos }); cerrarModal(); toast('Guardado'); }
      catch(e){ btn.disabled=false; err(errorTxt(e)); }
      return;
    }
    const ab = leerAbono(form, r);
    if(ab && ab.error) return err(ab.error);
    btn.disabled = true;
    const res = await asignar(r, nums, datos, ab);
    if(res.error){ btn.disabled=false; return err(res.error); }
    cerrarModal(); S.multi=false; S.sel.clear(); render();
    let msg = res.ocupados.length ? `Guardado. Ya estaban ocupados: ${res.ocupados.map(n=>fmtNum(r,n)).join(', ')}` : (nums.length>1 ? `${nums.length} números asignados` : 'Número asignado');
    if(res.sobra) msg += `. Sobró ${money(res.sobra,r)} del abono (no se registró).`;
    toast(msg);
  };
}
async function asignar(r, nums, datos, abono){
  const ocupados = []; const libres = []; const t = nowISO();
  for(const n of nums){
    const ref = refNum(n);
    try{
      let ok = true;
      try{ const l = await ref.acquire({ holder: clientId, ttlMs: 5000 }); ok = l.acquired; }catch(e){ ok = true; }
      if(!ok){ ocupados.push(n); continue; }
      const cur = await ref.get();
      if(cur.exists && cur.data() && cur.data().nombre){ ocupados.push(n); continue; }
      libres.push(n);
    }catch(e){ return { error: errorTxt(e), ocupados }; }
  }
  const base = libres.map(n => info(r, { num:n, ...datos, abonos:[], fecha:t }));
  let sobra = 0;
  if(abono){
    const rep = repartir(r, base, abono); sobra = rep.sobra;
    for(const p of rep.partes) p.d.abonos.push(p.abono);
  }
  try{ for(const d of base) await guardarNum(d); }
  catch(e){ return { error: errorTxt(e), ocupados }; }
  return { ocupados, sobra };
}

// ---------- detalle de un número ----------
function detalleNumero(n){
  const r = rifa(); const d = num(n);
  const wa = telWa(d.telefono);
  const c = compradores(r).find(c => c.nums.some(x => x.num===n));
  const prem = premiosOrden(r).map(p => {
    if(p.ganador) return `<tr><td>${esc(p.nombre)}</td><td class="muted">ya sorteado</td></tr>`;
    return `<tr><td>${esc(p.nombre)}${p.fecha?'<br><small class="muted">'+esc(fmtFecha(p.fecha))+'</small>':''}</td><td>${juega(p,d)?'<span style="color:var(--pag);font-weight:600">Participa ✅</span>':`<span class="debe">Le falta ${money(Math.max(0, r.precio*p.requisito/100 - d.abonado), r)}</span> <small class="muted">(necesita ${p.requisito}%)</small>`}</td></tr>`;
  }).join('');
  const abonos = d.abonos.length ? d.abonos.map(a => `<tr><td>${esc(fmtFechaHora(a.fecha))}<br><small class="muted">${esc(a.metodo||'')}${a.referencia?' · Ref '+esc(a.referencia):''}</small></td>
      <td>${fmtM(a.monto,a.moneda)}${a.moneda!==r.moneda?`<br><small class="muted">≈ ${money(a.equiv,r)} (tasa ${+Number(a.tasa).toFixed(4)})</small>`:''}
      <button class="btn sm danger" data-quitarabono="${esc(a.id)}" title="Borrar abono" style="float:right">✕</button></td></tr>`).join('') : `<tr><td colspan="2" class="muted">Sin abonos todavía</td></tr>`;
  const sh = modal(`<h2>Número ${fmtNum(r,n)} · ${esc(d.nombre)}</h2>
    <div class="muted">${esc(d.telefono||'Sin teléfono')}${d.nota?' · '+esc(d.nota):''}</div>
    <div class="bar" style="height:10px"><i style="width:${d.pct}%;background:${d.estado==='pagado'?'var(--pag)':'var(--apar)'}"></i></div>
    <div class="row"><b class="grow">${d.estado==='pagado'?'Pagado completo':'Abonado '+pctTxt(d.pct)}</b><span>${money(Math.min(d.abonado,r.precio),r)} de ${money(r.precio,r)}</span></div>
    ${d.debe>EPS?`<div class="debe">Debe ${money(d.debe,r)}</div>`:''}
    <h3 style="margin:14px 0 4px;font-size:15px">Premios</h3><table class="det">${prem}</table>
    <h3 style="margin:14px 0 4px;font-size:15px">Abonos</h3><table class="det">${abonos}</table>
    ${c && c.nums.length>1?`<p class="muted" style="font-size:13px">Sus números: ${c.nums.map(x=>fmtNum(r,x.num)).join(', ')}</p>`:''}
    <div class="acts" style="justify-content:flex-start">
      ${d.debe>EPS?'<button class="btn ok" id="dAbonar">+ Registrar abono</button>':''}
      <button class="btn" id="dEditar">Editar datos</button>
      ${wa && c?`<a class="btn" href="https://wa.me/${wa}?text=${encodeURIComponent(msgComprador(r,c))}" target="_blank" rel="noopener">WhatsApp</a>`:''}
      <button class="btn danger" id="dLiberar">Liberar número</button>
    </div>`);
  const ba = sh.querySelector('#dAbonar');
  if(ba) ba.onclick = () => formAbono(r, [d], `Abono al ${fmtNum(r,n)} (debe ${money(d.debe,r)})`);
  sh.querySelector('#dEditar').onclick = () => formNumero([n], d);
  sh.querySelectorAll('[data-quitarabono]').forEach(b => b.onclick = async () => {
    if(!await confirmar('¿Borrar este abono?', 'Borrar', true)) return;
    const act = num(n);
    try{ await guardarNum({ ...act, abonos: act.abonos.filter(a => a.id !== b.dataset.quitarabono) }); toast('Abono borrado'); }catch(e){ toast(errorTxt(e)); }
  });
  sh.querySelector('#dLiberar').onclick = async () => {
    if(!await confirmar(`¿Liberar el número ${fmtNum(r,n)} de ${d.nombre}? Se borran sus abonos y queda disponible otra vez.`, 'Liberar', true)) return;
    try{ await refNum(n).delete(); toast('Número liberado'); }catch(e){ toast(errorTxt(e)); }
  };
}
// Registrar un abono para uno o varios números (se reparte).
function formAbono(r, numsInfo, titulo){
  const debe = numsInfo.reduce((s,d)=>s+d.debe,0);
  const sh = modal(`<h2>Registrar abono</h2><form id="fAb">${camposAbono(r, debe, titulo)}
    ${numsInfo.length>1?`<p class="muted" style="font-size:13px">Se reparte entre ${numsInfo.length} números, completando primero los que van más adelantados.</p>`:''}
    <div id="errAb" class="debe"></div>
    <div class="acts"><button type="button" class="btn" data-x>Cancelar</button><button class="btn pri">Guardar abono</button></div></form>`);
  const form = sh.querySelector('#fAb');
  activarAbono(form, r, debe);
  form.monto.focus();
  form.onsubmit = async ev => {
    ev.preventDefault();
    const ab = leerAbono(form, r);
    if(!ab) return sh.querySelector('#errAb').textContent = 'Escribe el monto.';
    if(ab.error) return sh.querySelector('#errAb').textContent = ab.error;
    const frescos = numsInfo.map(d => num(d.num)).filter(Boolean);
    const rep = repartir(r, frescos, ab);
    form.querySelector('button.pri').disabled = true;
    try{
      for(const p of rep.partes){ const act = num(p.d.num); await guardarNum({ ...act, abonos:[...act.abonos, p.abono] }); }
      cerrarModal();
      toast(rep.sobra ? `Abono guardado. Sobró ${money(rep.sobra,r)} (ya estaba todo pagado).` : 'Abono guardado');
    }catch(e){ form.querySelector('button.pri').disabled = false; sh.querySelector('#errAb').textContent = errorTxt(e); }
  };
}

// ---------- premios: sorteo ----------
async function guardarGanador(r, pid, numero, metodo){
  const d = num(numero);
  const premios = r.premios.map(p => {
    if(p.id !== pid) return p;
    return { ...p, ganador: { numero, nombre: d ? d.nombre : '', telefono: d ? (d.telefono||'') : '', pct: d ? d.pct : 0, juega: juega(p, d), metodo, fecha: nowISO() } };
  });
  try{
    await S.db.doc(`rifas/${r.id}`).update({ premios, estado: premios.every(p => p.ganador) ? 'finalizada' : 'activa' });
    toast('Resultado guardado');
  }catch(e){ toast(errorTxt(e)); }
}

// ---------- exportar ----------
async function exportarCSV(r){
  const prem = premiosOrden(r).filter(p => p.requisito < 100);
  const filas = [['Numero','Comprador','Telefono','Estado','% abonado',`Abonado (${r.moneda})`,`Debe (${r.moneda})`, ...prem.map(p=>'Juega '+p.nombre), 'Abonos','Nota']];
  for(const n of rango(r)){
    const d = info(r, S.raw.get(n));
    if(!d){ filas.push([fmtNum(r,n),'','','libre','','','', ...prem.map(()=>''), '', '']); continue; }
    filas.push([fmtNum(r,n), d.nombre, d.telefono||'', d.estado, Math.floor(d.pct), Math.min(d.abonado,r.precio).toFixed(2).replace('.',','), d.debe.toFixed(2).replace('.',','),
      ...prem.map(p => juega(p,d)?'si':'no'),
      d.abonos.map(a => `${fmtM(a.monto,a.moneda)} ${a.metodo||''}${a.referencia?' ref '+a.referencia:''} ${fmtFechaHora(a.fecha)}`).join(' | '), d.nota||'']);
  }
  const csv = '﻿' + filas.map(f => f.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const nombre = 'rifa-' + r.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '.csv';
  if(S.downloads){ try{ const ok = await S.downloads.save({ filename: nombre, data: csv }); if(ok !== false) toast('Archivo guardado'); return; }catch(e){} }
  copiar(csv);
}

// ---------- sincronización (solo si la plataforma la ofrece) ----------
const SYNC_TXT = { 'apagado':'Sin sincronizar', 'sincronizando':'Sincronizando…', 'al-dia':'Al día', 'sin-conexion':'Sin conexión', 'error':'Error' };
function botonSync(){
  if(!S.sync) return '';
  const e = S.sync.estado();
  return `<button class="btn icon" id="bSync" title="${esc(SYNC_TXT[e.estado]||'')}">☁️<i class="dot ${esc(e.estado)}"></i></button>`;
}
function ventanaSync(){
  const e = S.sync.estado(); const c = e.cfg || {};
  const sh = modal(`<h2>Sincronizar</h2>
    <p class="muted">Conecta la app a tu servidor CouchDB (en tu PC con Tailscale, o en la nube) para tener las mismas rifas en la computadora y en el teléfono. Sin internet sigue funcionando y se pone al día cuando vuelva la conexión.</p>
    <div class="card" style="margin-bottom:12px"><div class="row"><i class="dot big ${esc(e.estado)}"></i><b class="grow">${esc(SYNC_TXT[e.estado]||e.estado)}</b></div>
      ${e.detalle?`<div class="muted" style="font-size:13px;margin-top:4px">${esc(e.detalle)}</div>`:''}
      ${e.ultimo?`<div class="muted" style="font-size:13px;margin-top:4px">Último cambio sincronizado: ${esc(fmtFechaHora(e.ultimo))}</div>`:''}</div>
    <form id="fSync">
      <label class="f"><span>Dirección del servidor</span><input type="text" name="url" required placeholder="https://tu-pc.tailxxxx.ts.net" value="${esc(c.url||'')}" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <label class="f"><span>Nombre de la base</span><input type="text" name="base" value="${esc(c.base||'rifas')}" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
      <div class="two">
        <label class="f"><span>Usuario</span><input type="text" name="usuario" value="${esc(c.usuario||'')}" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
        <label class="f"><span>Clave</span><input type="password" name="clave" ${c.url?'placeholder="(sin cambios)"':''}></label>
      </div>
      <div id="errSync" class="debe"></div>
      <div class="acts">${c.url?'<button type="button" class="btn danger" id="bSyncOff" style="margin-right:auto">Desconectar</button>':''}<button type="button" class="btn" data-x>Cerrar</button><button class="btn pri">${c.url?'Guardar y reconectar':'Conectar'}</button></div>
    </form>`);
  const form = sh.querySelector('#fSync');
  form.onsubmit = async ev => {
    ev.preventDefault();
    const cfg = { url: form.url.value.trim(), base: form.base.value.trim() || 'rifas', usuario: form.usuario.value.trim(), clave: form.clave.value };
    if(!/^https?:\/\//.test(cfg.url)) return sh.querySelector('#errSync').textContent = 'La dirección debe empezar con https://';
    if(c.url && !cfg.clave) return sh.querySelector('#errSync').textContent = 'Escribe la clave otra vez para reconectar.';
    const b = form.querySelector('button.pri'); b.disabled = true; b.textContent = 'Probando conexión…';
    try{ await S.sync.configurar(cfg); cerrarModal(); toast('Conectado. Sincronizando…'); }
    catch(err){ b.disabled = false; b.textContent = 'Conectar'; sh.querySelector('#errSync').textContent = err.message || String(err); }
  };
  const off = sh.querySelector('#bSyncOff');
  if(off) off.onclick = async () => {
    if(!await confirmar('¿Desconectar la sincronización? Los datos de este equipo se quedan, pero ya no se comparten.', 'Desconectar', true)) return;
    await S.sync.desactivar(); toast('Sincronización desconectada');
  };
}

// ---------- respaldo (solo si la plataforma lo ofrece) ----------
function ventanaRespaldo(){
  const sh = modal(`<h2>Respaldo</h2>
    <p class="muted">Guarda una copia de todas tus rifas en un archivo. Con ese archivo puedes recuperarlas en esta u otra computadora.</p>
    <div class="acts" style="justify-content:flex-start"><button class="btn pri" id="rExp">Guardar respaldo</button>
    <label class="btn">Cargar respaldo<input type="file" id="rImp" accept=".json,application/json" hidden></label></div>
    <div id="rMsg" class="muted" style="margin-top:10px"></div>
    <div class="acts"><button class="btn" data-x>Cerrar</button></div>`);
  sh.querySelector('#rExp').onclick = async () => {
    const datos = await S.respaldo.exportar();
    const f = new Date().toISOString().slice(0,10);
    if(S.downloads){ try{ const ok = await S.downloads.save({ filename:`respaldo-rifas-${f}.json`, data: JSON.stringify(datos, null, 1) }); if(ok !== false) sh.querySelector('#rMsg').textContent = 'Respaldo guardado.'; return; }catch(e){} }
    copiar(JSON.stringify(datos));
  };
  sh.querySelector('#rImp').onchange = async ev => {
    const file = ev.target.files[0]; if(!file) return;
    try{
      const datos = JSON.parse(await file.text());
      if(!await confirmar(`¿Cargar el respaldo? Se agregan o reemplazan ${datos.docs ? datos.docs.length : 0} registros. Lo que no está en el respaldo se queda igual.`, 'Cargar')) return;
      const n = await S.respaldo.importar(datos);
      toast(`Respaldo cargado (${n} registros)`);
    }catch(e){ toast('Ese archivo no es un respaldo válido'); }
  };
}

// ---------- eventos ----------
document.addEventListener('click', async ev => {
  const t = ev.target.closest('button, [data-abrir]'); if(!t) return;
  const r = rifa();
  if(t.id==='bNueva' || t.id==='bNueva2') return formRifa();
  if(t.id==='bRespaldo') return ventanaRespaldo();
  if(t.id==='bTasas') return ventanaTasas();
  if(t.id==='bSync') return ventanaSync();
  if(t.id==='bImagen' || t.id==='bImagen2') return ventanaImagen(rifa());
  if(t.dataset.abrir) return abrirRifa(t.dataset.abrir);
  if(t.id==='bAtras') return salirRifa();
  if(t.id==='bEditar') return formRifa(r);
  if(t.dataset.tab){ S.tab = t.dataset.tab; S.multi=false; S.sel.clear(); return render(); }
  if(t.dataset.fil){ S.filtro = t.dataset.fil; return render(); }
  if(t.id==='bMulti'){ S.multi = !S.multi; S.sel.clear(); return render(); }
  if(t.id==='bMultiCancel'){ S.multi=false; S.sel.clear(); return render(); }
  if(t.id==='bMultiAsig') return formNumero([...S.sel].sort((a,b)=>a-b));
  if(t.dataset.n !== undefined && t.classList.contains('n')){
    const n = Number(t.dataset.n);
    if(S.multi){
      if(S.raw.has(n)) return toast('Ese número ya está ocupado');
      S.sel.has(n) ? S.sel.delete(n) : S.sel.add(n);
      t.classList.toggle('sel'); return renderMultibar();
    }
    return S.raw.has(n) ? detalleNumero(n) : formNumero([n]);
  }
  if(t.dataset.copiarmsg !== undefined){ const c = S._compVista[Number(t.dataset.copiarmsg)]; return copiar(msgComprador(r,c)); }
  if(t.dataset.abonarcomp !== undefined){
    const c = S._compVista[Number(t.dataset.abonarcomp)];
    return formAbono(r, c.nums.filter(d => d.debe > EPS), `${c.nombre} · debe ${money(c.debe,r)}`);
  }
  if(t.id==='bCopLibres') return copiar(textoLibres(r));
  if(t.id==='bCSV') return exportarCSV(r);
  if(t.dataset.vergan){
    const pid = t.dataset.vergan; const p = r.premios.find(p => p.id === pid);
    const v = document.querySelector(`[data-numgan="${pid}"]`).value.trim(); const n = parseInt(v, 10);
    const out = document.querySelector(`[data-resgan="${pid}"]`);
    if(isNaN(n) || n < r.inicio || n > r.inicio + r.cantidad - 1){ out.innerHTML = `<span class="debe">Ese número no existe en esta rifa.</span>`; return; }
    const d = num(n);
    let h;
    if(!d) h = `<div>El <b>${fmtNum(r,n)}</b> no fue vendido. Nadie gana con ese número.</div>`;
    else if(juega(p,d)) h = `<div><b>${fmtNum(r,n)}</b> es de <b>${esc(d.nombre)}</b> ${esc(d.telefono||'')} — tiene ${pctTxt(d.pct)} abonado. <span style="color:var(--pag);font-weight:600">¡Gana!</span></div>`;
    else h = `<div><b>${fmtNum(r,n)}</b> es de <b>${esc(d.nombre)}</b>, pero solo tiene ${pctTxt(d.pct)} abonado y este premio pide ${p.requisito}%. <span class="debe">No participa.</span></div>`;
    out.innerHTML = h + `<button class="btn ${d&&juega(p,d)?'pri':''}" style="margin-top:8px" data-guardargan="${esc(pid)}" data-num="${n}">Guardar resultado</button>`;
    return;
  }
  if(t.dataset.guardargan) return guardarGanador(r, t.dataset.guardargan, Number(t.dataset.num), 'loteria');
  if(t.dataset.azar){
    const p = r.premios.find(p => p.id === t.dataset.azar);
    const pool = numerosVendidos().filter(d => juega(p, d));
    if(!pool.length) return toast('Ningún número cumple el requisito de este premio todavía');
    const a = new Uint32Array(1); crypto.getRandomValues(a);
    const d = pool[a[0] % pool.length];
    if(!await confirmar(`${p.nombre}: salió el ${fmtNum(r,d.num)} de ${d.nombre}. ¿Guardar como ganador?`, 'Guardar')) return;
    return guardarGanador(r, p.id, d.num, 'aleatorio');
  }
  if(t.dataset.quitargan){
    if(!await confirmar('¿Borrar el resultado de este premio?', 'Borrar', true)) return;
    const premios = r.premios.map(p => p.id === t.dataset.quitargan ? { ...p, ganador:null } : p);
    try{ await S.db.doc(`rifas/${r.id}`).update({ premios, estado:'activa' }); }catch(e){ toast(errorTxt(e)); }
  }
});
document.addEventListener('input', ev => {
  const id = ev.target.id;
  if(id !== 'qNum' && id !== 'qComp') return;
  if(id==='qNum') S.q = ev.target.value; else S.qComp = ev.target.value;
  const pos = ev.target.selectionStart; render();
  const i = document.getElementById(id); i.focus(); try{ i.setSelectionRange(pos,pos) }catch(e){}
});

// ---------- arranque ----------
// db: base de datos; downloads: {save({filename,data})} o null; respaldo: {exportar, importar} o null
// sync: {estado, alCambiar, configurar, desactivar} o null
function iniciarApp(db, downloads, respaldo, sync){
  S.iniciado = true; S.db = db; S.downloads = downloads || null; S.respaldo = respaldo || null; S.sync = sync || null;
  if(S.sync) S.sync.alCambiar(() => renderTop());
  if(S.db){ S.dbListo = true; render(); iniciarDB(); } else render();
}
render();
