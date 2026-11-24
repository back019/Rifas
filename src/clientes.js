// ================= Libreta de clientes =================
// Junta a los compradores de todas las rifas (por teléfono, o por nombre si no tiene teléfono)
// para ver quién compra siempre y quién quedó debiendo de rifas anteriores.
// No guarda nada aparte: se calcula con los números de cada rifa.

// S.numsPorRifa[rifaId] = lista de números vendidos (con info calculada); la llena cargarStatsLista().
function todosLosClientes(){
  const map = new Map();
  for(const r of S.rifas){
    const lista = r.id === S.rifaId ? numerosVendidos() : (S.numsPorRifa[r.id] || []);
    for(const d of lista){
      const key = telWa(d.telefono) || String(d.nombre).trim().toLowerCase();
      if(!map.has(key)) map.set(key, { clave:key, nombre:d.nombre, telefono:d.telefono||'', ultima:'', rifas:new Map() });
      const c = map.get(key);
      const f = String(d.actualizado || d.fecha || '');
      if(f >= c.ultima){ c.ultima = f; c.nombre = d.nombre; if(d.telefono) c.telefono = d.telefono; }
      if(!c.rifas.has(r.id)) c.rifas.set(r.id, { r, nums:[] });
      c.rifas.get(r.id).nums.push(d);
    }
  }
  return [...map.values()].map(c => {
    const rifas = [...c.rifas.values()].map(x => {
      const total = x.nums.length * x.r.precio;
      const pagado = x.nums.reduce((s,d) => s + Math.min(d.abonado, x.r.precio), 0);
      return { ...x, total, pagado, debe: Math.max(0, total - pagado) };
    }).sort((a,b) => String(b.r.creada||'').localeCompare(String(a.r.creada||'')));
    // Los montos se suman por moneda de referencia (una rifa puede ser en $ y otra en Bs).
    const porMoneda = {};
    for(const x of rifas){ const m = x.r.moneda || '$'; porMoneda[m] = porMoneda[m] || { total:0, pagado:0, debe:0 }; porMoneda[m].total += x.total; porMoneda[m].pagado += x.pagado; porMoneda[m].debe += x.debe; }
    const nNums = rifas.reduce((s,x) => s + x.nums.length, 0);
    const debeAlgo = rifas.some(x => x.debe > EPS);
    return { ...c, rifas, porMoneda, nNums, debeAlgo };
  });
}
const sumaMonedas = (pm, k) => Object.entries(pm).filter(([,v]) => v[k] > EPS).map(([m,v]) => fmtM(v[k], m)).join(' + ') || fmtM(0, Object.keys(pm)[0] || '$');

function vistaClientes(){
  if(!S.statsListas) return '<p class="muted">Cargando clientes…</p>';
  const q = S.qCli.trim().toLowerCase();
  let lista = todosLosClientes();
  const nDeben = lista.filter(c => c.debeAlgo).length;
  if(S.filtroCli === 'deben') lista = lista.filter(c => c.debeAlgo);
  if(S.filtroCli === 'fieles') lista = lista.filter(c => c.rifas.length > 1);
  if(q) lista = lista.filter(c => String(c.nombre).toLowerCase().includes(q) || String(c.telefono).includes(q));
  const orden = S.filtroCli === 'deben' ? (a,b) => (b.debeAlgo - a.debeAlgo) || b.nNums - a.nNums
    : (a,b) => b.rifas.length - a.rifas.length || b.nNums - a.nNums || String(a.nombre).localeCompare(String(b.nombre));
  lista.sort(orden);
  S._cliVista = lista;
  const fil = [['todos','Todos'],['deben',`Deben (${nDeben})`],['fieles','Compraron en 2 o más rifas']];
  let h = `<div class="row" style="margin-bottom:10px"><div class="chips grow">${fil.map(([k,v]) => `<button class="chip ${S.filtroCli===k?'on':''}" data-filcli="${k}">${v}</button>`).join('')}</div></div>
    <input type="search" id="qCli" placeholder="Buscar cliente…" value="${esc(S.qCli)}">`;
  if(!lista.length) return h + `<p class="muted" style="margin-top:16px">${S.rifas.length ? 'No hay clientes que coincidan.' : 'Todavía no hay clientes: aparecen cuando vendes números.'}</p>`;
  h += `<div class="comp" style="margin-top:12px">` + lista.map((c,i) => `<div class="card cli" data-cli="${i}">
    <div class="row"><h4 class="grow">${esc(c.nombre)}</h4>${c.debeAlgo ? `<span class="debe">Debe ${sumaMonedas(c.porMoneda,'debe')}</span>` : '<span class="tag fin">Al día</span>'}</div>
    <div class="muted">${esc(c.telefono || 'Sin teléfono')} · ${c.rifas.length} rifa(s) · ${c.nNums} número(s) · comprado ${sumaMonedas(c.porMoneda,'total')}</div>
    <div class="muted" style="font-size:13px">${c.rifas.slice(0,4).map(x => esc(x.r.nombre)).join(' · ')}${c.rifas.length > 4 ? ' …' : ''}</div>
  </div>`).join('') + `</div>`;
  return h;
}

function msgCliente(c){
  const deben = c.rifas.filter(x => x.debe > EPS);
  let m = `Hola ${c.nombre} 👋`;
  if(!deben.length) return m + ` ¡Gracias por participar en nuestras rifas! 🍀`;
  m += ` Te escribo por lo pendiente de las rifas:\n`;
  m += deben.map(x => `• ${x.r.nombre}: números ${x.nums.map(d => fmtNum(x.r,d.num)).join(', ')} · pendiente ${money(x.debe,x.r)}`).join('\n');
  return m + `\n\nTotal pendiente: ${sumaMonedas(c.porMoneda,'debe')}. ¡Gracias! 🍀`;
}

function ventanaCliente(c){
  const wa = telWa(c.telefono);
  const sh = modal(`<h2>${esc(c.nombre)}</h2>
    <div class="muted">${esc(c.telefono || 'Sin teléfono')} · cliente desde ${esc(fmtFecha(c.rifas.flatMap(x => x.nums.map(d => d.fecha||'')).filter(Boolean).sort()[0] || '') || '—')}</div>
    <div class="stats" style="margin-top:12px">
      <div class="stat"><small>Rifas</small><b>${c.rifas.length}</b></div>
      <div class="stat"><small>Números</small><b>${c.nNums}</b></div>
      <div class="stat"><small>Pagado</small><b style="font-size:17px">${sumaMonedas(c.porMoneda,'pagado')}</b></div>
      <div class="stat"><small>Debe</small><b style="font-size:17px" class="${c.debeAlgo?'debe':''}">${c.debeAlgo ? sumaMonedas(c.porMoneda,'debe') : 'Nada'}</b></div>
    </div>
    <h3 style="margin:14px 0 4px;font-size:15px">Por rifa</h3>
    <table class="det">${c.rifas.map(x => `<tr><td>${esc(x.r.nombre)}${x.r.estado==='finalizada'?' <small class="muted">(finalizada)</small>':''}<br><small class="muted">${x.nums.map(d => fmtNum(x.r,d.num) + (d.estado==='pagado'?' ✓':' '+Math.floor(d.pct)+'%')).join(', ')}</small></td>
      <td>${x.debe > EPS ? `<span class="debe">Debe ${money(x.debe,x.r)}</span>` : '<span class="ok-txt">Pagado</span>'}<br><small class="muted">de ${money(x.total,x.r)}</small>
      <button class="btn sm" data-irrifa="${esc(x.r.id)}" style="float:right">Abrir</button></td></tr>`).join('')}</table>
    <div class="acts">
      ${wa ? `<a class="btn ${c.debeAlgo?'ok':''}" href="https://wa.me/${wa}?text=${encodeURIComponent(msgCliente(c))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      <button class="btn" id="cliCop">Copiar mensaje</button><button class="btn" data-x>Cerrar</button></div>`);
  sh.querySelector('#cliCop').onclick = () => copiar(msgCliente(c));
  sh.querySelectorAll('[data-irrifa]').forEach(b => b.onclick = () => { cerrarModal(); S.vista = 'rifas'; abrirRifa(b.dataset.irrifa); S.tab = 'compradores'; S.qComp = c.telefono || c.nombre; render(); });
}

// Para autocompletar al vender: clientes de todas las rifas (nombre → teléfono).
function clientesParaSugerir(){
  return todosLosClientes().sort((a,b) => String(b.ultima).localeCompare(String(a.ultima))).map(c => ({ nombre:c.nombre, telefono:c.telefono }));
}
