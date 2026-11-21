// ================= Cobranza y comprobantes =================
// - "Cobrar a todos": lista de los que deben con su mensaje de WhatsApp listo, y marca a quién ya se le escribió.
// - Comprobante: imagen tipo recibo para mandarle al comprador cuando paga.
// Usa las funciones de app.js (rifa, compradores, money, fmtNum, etc.).

// ---------- cobrar a todos ----------
function leerCobros(rid){ try{ return JSON.parse(localStorage.getItem('cobros:' + rid) || '{}'); }catch(e){ return {}; } }
function marcarCobro(rid, clave){
  const m = leerCobros(rid); m[clave] = nowISO();
  try{ localStorage.setItem('cobros:' + rid, JSON.stringify(m)); }catch(e){}
}
const claveComp = c => telWa(c.telefono) || String(c.nombre).trim().toLowerCase();

function msgCobro(r, c){
  const debeN = c.nums.filter(d => d.debe > EPS);
  let m = `Hola ${c.nombre} 👋 Te escribo por la rifa "${r.nombre}".\n`;
  m += `Tus números: ${c.nums.map(d => fmtNum(r,d.num) + (d.estado==='pagado' ? ' ✅' : ` (${Math.floor(d.pct)}%)`)).join(', ')}.\n`;
  m += `Te falta por pagar: ${money(c.debe,r)}` + (debeN.length < c.nums.length ? ` (de ${debeN.map(d=>fmtNum(r,d.num)).join(', ')})` : '') + '.';
  const prox = proximoPremio(r);
  if(prox){
    const noJuegan = c.nums.filter(d => !juega(prox, d));
    m += `\n\nPróximo sorteo: ${prox.nombre}${prox.fecha ? ' el ' + fmtFecha(prox.fecha) : ''}${prox.loteria ? ' (' + prox.loteria + ')' : ''}.`;
    if(!noJuegan.length) m += ' Ya estás participando con todos tus números ✅';
    else {
      const falta = noJuegan.reduce((s,d) => s + Math.max(0, r.precio*prox.requisito/100 - d.abonado), 0);
      m += ` Para participar ${prox.requisito >= 100 ? 'el número debe estar pagado completo' : `necesitas tener el ${prox.requisito}% abonado`}: te faltan ${money(falta,r)}` +
        (noJuegan.length < c.nums.length ? ` para ${noJuegan.map(d=>fmtNum(r,d.num)).join(', ')}` : '') + '.';
    }
  }
  return m + `\n\n¡Gracias! 🍀`;
}

function ventanaCobrar(r, filtro){
  filtro = filtro || 'todos';
  const prox = proximoPremio(r);
  let lista = compradores(r).filter(c => c.debe > EPS);
  const noJuegan = c => prox && c.nums.some(d => !juega(prox, d));
  const nNo = lista.filter(noJuegan).length;
  if(filtro === 'nojuegan') lista = lista.filter(noJuegan);
  const env = leerCobros(r.id);
  const total = lista.reduce((s,c) => s + c.debe, 0);
  const fil = [['todos', `Todos los que deben`]];
  if(prox) fil.push(['nojuegan', `No juegan ${prox.nombre} (${nNo})`]);
  const sh = modal(`<h2>Cobrar a todos</h2>
    <p class="muted" style="margin-top:0">${lista.length} persona(s) · deben ${money(total,r)} en total. Toca WhatsApp en cada una; el mensaje ya va escrito y queda marcada como enviada.</p>
    <div class="chips" style="margin-bottom:10px">${fil.map(([k,v]) => `<button class="chip ${filtro===k?'on':''}" data-cfil="${k}">${esc(v)}</button>`).join('')}</div>
    <div class="comp">${lista.map((c,i) => {
      const wa = telWa(c.telefono); const e = env[claveComp(c)];
      return `<div class="card cobro ${e?'enviado':''}" data-ci="${i}">
        <div class="row"><b class="grow">${esc(c.nombre)}</b><span class="debe">${money(c.debe,r)}</span></div>
        <div class="muted" style="font-size:13px">${esc(c.telefono||'Sin teléfono')} · ${c.nums.map(d=>fmtNum(r,d.num)).join(', ')}${e?` · <span class="ok-txt">✓ escrito ${esc(fmtFechaHora(e))}</span>`:''}</div>
        <div class="row" style="margin-top:8px">
          ${wa ? `<a class="btn sm ${e?'':'ok'}" data-cwa="${i}" href="https://wa.me/${wa}?text=${encodeURIComponent(msgCobro(r,c))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          <button class="btn sm" data-ccop="${i}">Copiar mensaje</button>
          <button class="btn sm" data-ccomp="${i}">🧾 Comprobante</button>
        </div></div>`; }).join('') || '<p class="muted">Nadie debe en esta rifa. 🎉</p>'}</div>
    <div class="acts"><button class="btn" id="cLista">Copiar lista de deudores</button><button class="btn" data-x>Cerrar</button></div>`);
  sh.querySelectorAll('[data-cfil]').forEach(b => b.onclick = () => ventanaCobrar(r, b.dataset.cfil));
  const marcar = i => {
    marcarCobro(r.id, claveComp(lista[i]));
    const card = sh.querySelector(`[data-ci="${i}"]`); if(card) card.classList.add('enviado');
  };
  sh.querySelectorAll('[data-cwa]').forEach(a => a.addEventListener('click', () => marcar(Number(a.dataset.cwa))));
  sh.querySelectorAll('[data-ccop]').forEach(b => b.onclick = () => { const i = Number(b.dataset.ccop); copiar(msgCobro(r, lista[i])); marcar(i); });
  sh.querySelectorAll('[data-ccomp]').forEach(b => b.onclick = () => ventanaComprobante(r, claveComp(lista[Number(b.dataset.ccomp)])));
  sh.querySelector('#cLista').onclick = () => copiar(`Deben en "${r.nombre}" (${money(total,r)}):\n` +
    lista.map(c => `• ${c.nombre}${c.telefono?' ('+c.telefono+')':''}: ${money(c.debe,r)} · ${c.nums.map(d=>fmtNum(r,d.num)).join(', ')}`).join('\n'));
}

// ---------- comprobante ----------
function buscarComprador(r, clave){ return compradores(r).find(c => claveComp(c) === clave) || null; }

function dibujarComprobante(cv, r, c){
  const W = 1080, P = 70, ctx = cv.getContext('2d');
  const abonos = c.nums.flatMap(d => d.abonos.map(a => ({ ...a, num:d.num }))).sort((a,b) => String(b.fecha||'').localeCompare(String(a.fecha||'')));
  // Abonos repartidos entre varios números se muestran juntos.
  const grupos = [];
  for(const a of abonos){
    const g = grupos.find(g => g.fecha === a.fecha && g.moneda === a.moneda && g.metodo === a.metodo && g.referencia === a.referencia);
    if(g){ g.monto += Number(a.monto)||0; g.nums.push(a.num); } else grupos.push({ ...a, monto:Number(a.monto)||0, nums:[a.num] });
  }
  const verAb = grupos.slice(0, 8);
  const pend = premiosOrden(r).filter(p => !p.ganador);
  const H = 470 + c.nums.length*58 + 120 + (verAb.length ? 80 + verAb.length*54 : 0) + (pend.length ? 80 + pend.length*54 : 0) + 140;
  cv.width = W; cv.height = H;
  const T = { bg:'#ffffff', tx:'#1b1d22', mu:'#6b7280', li:'#e5e7eb', pri:'#4f46e5', ok:'#16a34a', no:'#dc2626', ap:'#b45309' };
  ctx.fillStyle = T.bg; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = T.pri; ctx.fillRect(0,0,W,190);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  ctx.font = '600 34px system-ui, "Segoe UI", sans-serif'; ctx.fillText('COMPROBANTE DE PAGO', P, 78);
  ctx.font = '800 54px system-ui, "Segoe UI", sans-serif';
  const tit = partirTexto(ctx, r.nombre, W - 2*P, 1)[0] || r.nombre; ctx.fillText(tit, P, 150);
  let y = 260;
  const linea = () => { ctx.fillStyle = T.li; ctx.fillRect(P, y, W-2*P, 2); y += 40; };
  const izq = (t, f, col) => { ctx.font = f; ctx.fillStyle = col || T.tx; ctx.textAlign = 'left'; ctx.fillText(t, P, y); };
  const der = (t, f, col) => { ctx.font = f; ctx.fillStyle = col || T.tx; ctx.textAlign = 'right'; ctx.fillText(t, W-P, y); ctx.textAlign = 'left'; };
  izq(c.nombre, '700 44px system-ui, "Segoe UI", sans-serif'); y += 46;
  izq([c.telefono, 'Emitido ' + fmtFechaHora(nowISO())].filter(Boolean).join(' · '), '400 28px system-ui, "Segoe UI", sans-serif', T.mu); y += 50;
  linea();
  izq('Número', '600 26px system-ui, sans-serif', T.mu); der('Abonado', '600 26px system-ui, sans-serif', T.mu); y += 50;
  for(const d of c.nums){
    izq(fmtNum(r,d.num), '800 40px system-ui, "Segoe UI", sans-serif', T.pri);
    ctx.font = '600 28px system-ui, sans-serif'; ctx.fillStyle = d.estado==='pagado' ? T.ok : T.ap; ctx.fillText(d.estado==='pagado' ? 'PAGADO' : Math.floor(d.pct) + '%', P + 150, y);
    der(`${money(Math.min(d.abonado,r.precio),r)} de ${money(r.precio,r)}`, '400 30px system-ui, sans-serif');
    y += 58;
  }
  y -= 10; linea();
  izq('Total', '400 32px system-ui, sans-serif', T.mu); der(money(c.total,r), '600 32px system-ui, sans-serif'); y += 46;
  izq('Pagado', '400 32px system-ui, sans-serif', T.mu); der(money(c.pagado,r), '700 32px system-ui, sans-serif', T.ok); y += 46;
  izq('Pendiente', '400 32px system-ui, sans-serif', T.mu); der(c.debe > EPS ? money(c.debe,r) : 'Nada, ¡al día!', '800 36px system-ui, sans-serif', c.debe > EPS ? T.no : T.ok); y += 36;
  if(verAb.length){
    y += 30; linea();
    izq('Pagos recibidos', '700 30px system-ui, sans-serif'); y += 50;
    for(const a of verAb){
      izq(`${fmtFechaHora(a.fecha)} · ${a.metodo||''}${a.referencia?' ref '+a.referencia:''}`, '400 26px system-ui, sans-serif', T.mu);
      der(fmtM(a.monto, a.moneda), '600 28px system-ui, sans-serif'); y += 54;
    }
    y -= 14;
  }
  if(pend.length){
    y += 30; linea();
    izq('Sorteos', '700 30px system-ui, sans-serif'); y += 50;
    for(const p of pend){
      const j = c.nums.filter(d => juega(p,d)).length;
      izq(`${p.nombre}${p.fecha?' · '+fmtFecha(p.fecha):''}`, '400 28px system-ui, sans-serif');
      der(j === c.nums.length ? 'Participa ✓' : (j ? `Juegan ${j} de ${c.nums.length}` : `Necesita ${p.requisito}%`), '600 28px system-ui, sans-serif', j === c.nums.length ? T.ok : T.ap);
      y += 54;
    }
  }
  ctx.textAlign = 'center'; ctx.font = '600 32px system-ui, sans-serif'; ctx.fillStyle = T.pri;
  ctx.fillText('¡Gracias y suerte! 🍀', W/2, H - 60); ctx.textAlign = 'left';
}

function ventanaComprobante(r, clave){
  const c = buscarComprador(r, clave);
  if(!c) return toast('No se encontró al comprador');
  const nativo = window.rifasNativo && window.rifasNativo.guardarImagen;
  const wa = telWa(c.telefono);
  const sh = modal(`<h2>Comprobante · ${esc(c.nombre)}</h2>
    <div class="img-prev"><canvas id="cvComp"></canvas></div>
    <div class="acts">
      ${wa ? `<a class="btn" href="https://wa.me/${wa}?text=${encodeURIComponent(msgComprador(r,c))}" target="_blank" rel="noopener">Enviar texto por WhatsApp</a>` : ''}
      ${nativo ? '<button class="btn" id="kCopiar">Copiar imagen</button><button class="btn pri" id="kGuardar">Guardar imagen</button>'
               : '<button class="btn" id="kDescargar">Descargar</button><button class="btn pri" id="kCompartir">Compartir</button>'}
      <button class="btn" data-x>Cerrar</button>
    </div>
    ${nativo && wa ? '<p class="muted" style="font-size:13px">Para mandar la imagen: "Copiar imagen", abre el chat en WhatsApp y pega con Ctrl+V.</p>' : ''}`);
  const cv = sh.querySelector('#cvComp');
  dibujarComprobante(cv, r, c);
  let blob = null; cv.toBlob(b => { blob = b; }, 'image/png');
  const nombre = `comprobante-${String(c.nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}.png`;
  const conBlob = async () => blob || await new Promise(res => cv.toBlob(res, 'image/png'));
  const q = s => sh.querySelector(s);
  if(q('#kGuardar')) q('#kGuardar').onclick = async () => {
    try{ const ok = await window.rifasNativo.guardarImagen(nombre, new Uint8Array(await (await conBlob()).arrayBuffer())); if(ok) toast('Comprobante guardado'); }catch(e){ toast('No se pudo guardar'); }
  };
  if(q('#kCopiar')) q('#kCopiar').onclick = async () => {
    try{ await window.rifasNativo.copiarImagen(new Uint8Array(await (await conBlob()).arrayBuffer())); toast('Copiado. Pégalo en WhatsApp con Ctrl+V'); }catch(e){ toast('No se pudo copiar'); }
  };
  if(q('#kCompartir')) q('#kCompartir').onclick = async () => {
    if(!blob) return toast('Preparando la imagen, toca otra vez');
    const file = new File([blob], nombre, { type:'image/png' });
    if(navigator.canShare && navigator.canShare({ files:[file] })){
      try{ await navigator.share({ files:[file], title:'Comprobante' }); }catch(e){ if(e && e.name !== 'AbortError') toast('No se pudo compartir'); }
    } else descargarBlob(blob, nombre);
  };
  if(q('#kDescargar')) q('#kDescargar').onclick = async () => descargarBlob(await conBlob(), nombre);
}

// Después de vender o abonar: ofrece mandar el comprobante en ese momento.
function ofrecerComprobante(r, n, msg){
  const d = num(n); if(!d) { cerrarModal(); return toast(msg); }
  const clave = claveComp(d);
  const sh = modal(`<h2>✅ ${esc(msg)}</h2><p class="muted">¿Quieres mandarle el comprobante a ${esc(d.nombre)}?</p>
    <div class="acts"><button class="btn" data-x>Ahora no</button><button class="btn pri" id="oComp">🧾 Ver comprobante</button></div>`);
  sh.querySelector('#oComp').onclick = () => ventanaComprobante(r, clave);
}
