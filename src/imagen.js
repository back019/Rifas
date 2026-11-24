// ================= Imagen para estados =================
// Dibuja una imagen vertical (1080x1920) con el avance de la rifa para WhatsApp o Instagram.
// Usa funciones de app.js: rifa(), numerosVendidos(), premiosOrden(), money(), fmtNum(), rango(), fmtFecha(), modal(), toast().

const IMG_W = 1080, IMG_H = 1920;
const IMG_PREF = 'rifas.imagen';

function leerPrefImagen(){
  try{ return JSON.parse(localStorage.getItem(IMG_PREF)) || {}; }catch(e){ return {}; }
}
function guardarPrefImagen(p){
  try{ localStorage.setItem(IMG_PREF, JSON.stringify(p)); }catch(e){}
}

// Parte un texto en líneas que quepan en "ancho". Si pasa de maxLineas, corta con "…".
function partirTexto(ctx, texto, ancho, maxLineas){
  const palabras = String(texto || '').split(/\s+/).filter(Boolean);
  const lineas = []; let actual = '';
  for(const p of palabras){
    const prueba = actual ? actual + ' ' + p : p;
    if(ctx.measureText(prueba).width <= ancho || !actual) actual = prueba;
    else { lineas.push(actual); actual = p; }
  }
  if(actual) lineas.push(actual);
  if(lineas.length > maxLineas){
    const l = lineas.slice(0, maxLineas);
    let u = l[maxLineas-1];
    while(u.length > 1 && ctx.measureText(u + '…').width > ancho) u = u.slice(0, -1);
    l[maxLineas-1] = u + '…';
    return l;
  }
  return lineas;
}
function rectRedondo(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
}
const FUENTE = '"Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif';
const f = (peso, tam) => `${peso} ${tam}px ${FUENTE}`;

const TEMAS = {
  morado: { a:'#4f46e5', b:'#7c3aed', acento:'#fbbf24', texto:'#ffffff' },
  verde:  { a:'#047857', b:'#0f766e', acento:'#fde047', texto:'#ffffff' },
  rojo:   { a:'#b91c1c', b:'#be185d', acento:'#fde047', texto:'#ffffff' },
  negro:  { a:'#111827', b:'#1f2937', acento:'#f59e0b', texto:'#ffffff' },
  dorado: { a:'#0a0a0a', b:'#292524', acento:'#e5b53a', texto:'#ffffff', nombre:'Negro y dorado' }
};

// Dibuja la imagen en el canvas. op: { plantilla, tema, contarApartados, mostrar ('pct'|'cant'), contacto }
function dibujarImagen(canvas, r, op){
  if(op.plantilla === 'lanzamiento') return dibujarFlyer(canvas, r, op); // ver flyer.js
  canvas.width = IMG_W; canvas.height = IMG_H;
  const ctx = canvas.getContext('2d');
  const T = TEMAS[op.tema] || TEMAS.morado;
  const lista = numerosVendidos();
  const pagados = lista.filter(d => d.estado === 'pagado').length;
  const vendidos = op.contarApartados ? lista.length : pagados;
  const total = r.cantidad;
  const libres = total - lista.length;
  const pct = total ? Math.round(vendidos / total * 100) : 0;
  const premios = premiosOrden(r);
  const mayor = premioMayor(r);
  const otros = premios.filter(p => p !== mayor);

  // Fondo con degradado y círculos decorativos
  const g = ctx.createLinearGradient(0, 0, IMG_W, IMG_H);
  g.addColorStop(0, T.a); g.addColorStop(1, T.b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, IMG_W, IMG_H);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath(); ctx.arc(980, 160, 260, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(80, 1780, 320, 0, Math.PI*2); ctx.fill();

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = T.texto;

  // Encabezado
  ctx.font = f(700, 40); ctx.fillStyle = T.acento;
  ctx.fillText('🎟️  G R A N   R I F A', IMG_W/2, 150);
  ctx.fillStyle = T.texto; ctx.font = f(800, 92);
  let y = 270;
  for(const l of partirTexto(ctx, r.nombre, 940, 2)){ ctx.fillText(l, IMG_W/2, y); y += 104; }
  // Premios arriba: el mayor destacado con su fecha, lotería y condición, y justo debajo los demás.
  if(mayor){
    ctx.font = f(600, 50);
    for(const l of partirTexto(ctx, '🏆 ' + mayor.nombre, 940, 2)){ ctx.fillText(l, IMG_W/2, y + 10); y += 62; }
    ctx.globalAlpha = 0.88; ctx.font = f(500, 32);
    ctx.fillText(partirTexto(ctx, detallePremio(mayor), 940, 1)[0] || '', IMG_W/2, y + 2); y += 46;
    ctx.globalAlpha = 1;
  }
  for(const p of otros.slice(0, 3)){
    const mp = medirParrafos(ctx, `🥈 ${p.nombre} · ${detallePremio(p)}`, 940, 600, 36, 28, 2);
    y = pintarParrafos(ctx, mp, IMG_W/2, y + 14) - mp.salto + 14 + mp.salto * 0.3;
  }
  const yCuerpo = Math.max(y + 50, 520);

  if(op.plantilla === 'numeros') dibujarCuadricula(ctx, r, op, T, yCuerpo, 1540);
  else dibujarProgreso(ctx, T, yCuerpo, { pct, vendidos, total, libres, mostrar: op.mostrar });

  // Tarjeta inferior: precio y contacto (los premios ya salen arriba). El contacto se parte en
  // 2 líneas si es largo en vez de cortarse.
  const mc = medirParrafos(ctx, op.contacto, 900, 700, 42, 30, 2);
  const yT = 1560, hT = mc.alto ? 130 + mc.alto + 20 : 130;
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; rectRedondo(ctx, 60, yT, IMG_W-120, hT, 36); ctx.fill();
  ctx.fillStyle = T.texto; ctx.font = f(700, 54);
  ctx.fillText(`💵 ${money(r.precio, r)} por número`, IMG_W/2, yT + 80);
  if(mc.alto){ ctx.fillStyle = T.acento; pintarParrafos(ctx, mc, IMG_W/2, yT + 130 + mc.tam * 0.6); }
  return { pct, vendidos, total, libres, cortado: mc.cortado };
}

function dibujarProgreso(ctx, T, y0, d){
  // El anillo se achica si arriba hay varios premios, para que todo quepa sobre la tarjeta.
  const rad = Math.max(170, Math.min(280, (1530 - y0 - 295) / 2)), k = rad / 280;
  const cx = IMG_W/2, cy = y0 + 50 + rad, grosor = Math.round(60 * k);
  // Anillo
  ctx.lineCap = 'round'; ctx.lineWidth = grosor;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI*2); ctx.stroke();
  if(d.pct > 0){
    ctx.strokeStyle = T.acento;
    ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI/2, -Math.PI/2 + Math.PI*2*Math.min(1, d.pct/100)); ctx.stroke();
  }
  ctx.fillStyle = T.texto; ctx.textBaseline = 'middle';
  if(d.mostrar === 'cant'){
    ctx.font = f(800, Math.round(150*k)); ctx.fillText(String(d.vendidos), cx, cy - 30*k);
    ctx.font = f(600, Math.round(50*k)); ctx.fillText(`de ${d.total} vendidos`, cx, cy + 80*k);
  } else {
    ctx.font = f(800, Math.round(190*k)); ctx.fillText(d.pct + '%', cx, cy - 20*k);
    ctx.font = f(600, Math.round(54*k)); ctx.fillText('VENDIDO', cx, cy + 100*k);
  }
  ctx.textBaseline = 'alphabetic';
  // Texto debajo del anillo
  const yt = cy + rad + 95;
  ctx.font = f(600, 50); ctx.fillStyle = T.texto;
  ctx.fillText(`${d.vendidos} de ${d.total} números vendidos`, cx, yt);
  // Pastilla "quedan"
  const txt = d.libres > 0 ? `¡Quedan solo ${d.libres}! Aparta el tuyo` : '¡Todos los números vendidos!';
  ctx.font = f(800, 52);
  const w = Math.min(980, ctx.measureText(txt).width + 90);
  ctx.fillStyle = T.acento; rectRedondo(ctx, cx - w/2, yt + 40, w, 100, 50); ctx.fill();
  ctx.fillStyle = '#1f1300'; ctx.textBaseline = 'middle'; ctx.fillText(txt, cx, yt + 92); ctx.textBaseline = 'alphabetic';
}

function dibujarCuadricula(ctx, r, op, T, y0, yMax){
  const nums = rango(r);
  const n = nums.length;
  const area = { x: 70, y: y0 + 70, w: IMG_W - 140, h: yMax - y0 - 150 };
  ctx.font = f(700, 48); ctx.fillStyle = T.texto;
  const libres = nums.filter(x => !S.raw.has(x)).length;
  ctx.fillText(libres ? `Números disponibles: ${libres}` : '¡Todos los números vendidos!', IMG_W/2, y0 + 30);
  // Columnas que mejor aprovechan el área
  let cols = 10;
  if(n > 100) for(let c = 5; c <= 40; c++){
    const cel = area.w / c; const filas = Math.ceil(n / c);
    if(filas * cel <= area.h){ cols = c; break; }
    cols = c;
  }
  const cel = Math.min(area.w / cols, area.h / Math.ceil(n / cols));
  const gap = Math.max(2, cel * 0.1);
  const filas = Math.ceil(n / cols);
  const x0 = (IMG_W - cols * cel) / 2;
  const yG = area.y + (area.h - filas * cel) / 2;
  ctx.textBaseline = 'middle';
  nums.forEach((num, i) => {
    const cx = x0 + (i % cols) * cel, cy = yG + Math.floor(i / cols) * cel;
    const d = S.raw.get(num);
    const vendido = !!d && (op.contarApartados || info(r, d).estado === 'pagado');
    ctx.fillStyle = vendido ? 'rgba(255,255,255,0.12)' : '#ffffff';
    rectRedondo(ctx, cx + gap/2, cy + gap/2, cel - gap, cel - gap, Math.min(14, cel*0.18)); ctx.fill();
    ctx.font = f(800, Math.max(10, (cel - gap) * (fmtNum(r, num).length > 2 ? 0.36 : 0.44)));
    ctx.fillStyle = vendido ? 'rgba(255,255,255,0.35)' : T.a;
    ctx.fillText(fmtNum(r, num), cx + cel/2, cy + cel/2 + 1);
    if(vendido){
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = Math.max(2, cel*0.05);
      ctx.beginPath(); ctx.moveTo(cx + cel*0.25, cy + cel*0.75); ctx.lineTo(cx + cel*0.75, cy + cel*0.25); ctx.stroke();
    }
  });
  ctx.textBaseline = 'alphabetic';
}

// ---------- ventana con vista previa y botones ----------
// forzar: opciones que se imponen al abrir (por ejemplo { plantilla:'lanzamiento' } al crear una rifa).
function ventanaImagen(r, forzar){
  // Primero lo guardado en la rifa (se sincroniza entre equipos); si no hay, lo último usado en este equipo.
  // Solo cuenta lo que el usuario cambió a mano (manual: true); si no, se usa el diseño por defecto (negro y dorado).
  const local = leerPrefImagen();
  const elegido = (r.imagen && r.imagen.manual) ? r.imagen : (local.manual ? local : {});
  // Si todavía no se ha vendido nada, se propone el flyer de lanzamiento.
  const base = S.raw.size === 0 && !(r.imagen && r.imagen.manual) ? 'lanzamiento' : 'progreso';
  const pref = { plantilla:base, tema:'dorado', contarApartados:true, mostrar:'pct', contacto: local.contacto || '',
    tamano:'vertical', pagos: local.pagos || '', frase:'¡Aparta el tuyo!', extra:'', whatsapp: local.whatsapp || '', qr:false, otrasMonedas:true, ...elegido, ...(forzar || {}) };
  const nativo = window.rifasNativo && window.rifasNativo.guardarImagen;
  const sh = modal(`<h2>Imagen para estados</h2>
    <div class="img-ed">
      <div><div class="img-prev"><canvas id="cvImg"></canvas></div><div id="iAviso" class="banner alerta" style="margin-top:8px;font-size:13px" hidden></div></div>
      <form id="fImg" class="img-op">
        <label class="f"><span>Diseño</span><div class="seg">
          <label><input type="radio" name="plantilla" value="lanzamiento" ${pref.plantilla==='lanzamiento'?'checked':''}>Lanzamiento</label>
          <label><input type="radio" name="plantilla" value="progreso" ${pref.plantilla==='progreso'?'checked':''}>Progreso</label>
          <label><input type="radio" name="plantilla" value="numeros" ${pref.plantilla==='numeros'?'checked':''}>Números</label></div></label>
        <div data-solo="lanzamiento">
          <label class="f"><span>Tamaño</span><div class="seg">
            <label><input type="radio" name="tamano" value="vertical" ${pref.tamano!=='cuadrado'?'checked':''}>Vertical (estados)</label>
            <label><input type="radio" name="tamano" value="cuadrado" ${pref.tamano==='cuadrado'?'checked':''}>Cuadrado (publicación)</label></div></label>
          <label class="f"><span>Responsable (quién organiza)</span><textarea name="responsable" rows="1" class="crece" placeholder="Nombre y, si quieres, cédula o teléfono (Enter para otra línea)">${esc(r.responsable || '')}</textarea></label>
          <div class="f"><span class="muted" style="font-size:13px;display:block;margin-bottom:4px">Foto del premio</span>
            <span class="muted" style="font-size:12px;display:block;margin-bottom:6px">El producto, o billetes si es dinero. Sin foto, la app dibuja el premio.</span>
            <div class="row"><label class="btn sm">📷 <span id="iFotoTxt">${r.foto?'Cambiar foto':'Elegir foto'}</span><input type="file" id="iFoto" accept="image/*" hidden></label>
            <button type="button" class="btn sm danger" id="iQuitarFoto" ${r.foto?'':'hidden'}>Quitar</button><span class="muted" id="iFotoInfo" style="font-size:12px"></span></div></div>
          <label class="f"><span>Formas de pago</span><textarea name="pagos" rows="1" class="crece" placeholder="Pago móvil · Zelle · Binance · Efectivo (Enter para otra línea)">${esc(pref.pagos)}</textarea></label>
          <label class="f"><span>Frase (la franja dorada)</span><textarea name="frase" rows="1" class="crece" placeholder="¡Aparta el tuyo!">${esc(pref.frase)}</textarea></label>
          <label class="f"><span>Texto adicional / condiciones (opcional)</span><textarea name="extra" rows="2" class="crece" placeholder="Ej.: El premio se entrega el 1 de diciembre.\nSi el número no está pagado completo, no participa.">${esc(pref.extra)}</textarea></label>
          <label class="row" style="margin-bottom:8px"><input type="checkbox" name="otrasMonedas" ${pref.otrasMonedas?'checked':''}> Mostrar el precio en otras monedas (con las tasas)</label>
          <label class="row" style="margin-bottom:6px"><input type="checkbox" name="qr" ${pref.qr?'checked':''}> Agregar QR que abre WhatsApp</label>
          <label class="f"><span>WhatsApp para el QR</span><input type="tel" name="whatsapp" value="${esc(pref.whatsapp)}" placeholder="0414-1234567"></label>
        </div>
        <label class="f" data-solo="progreso"><span>Mostrar</span><select name="mostrar">
          <option value="pct" ${pref.mostrar!=='cant'?'selected':''}>Porcentaje (50%)</option>
          <option value="cant" ${pref.mostrar==='cant'?'selected':''}>Cantidad (50 de 100)</option></select></label>
        <label class="f"><span>Color</span><select name="tema">${Object.keys(TEMAS).map(k=>`<option value="${k}" ${pref.tema===k?'selected':''}>${TEMAS[k].nombre || (k[0].toUpperCase()+k.slice(1))}</option>`).join('')}</select></label>
        <label class="row" data-no="lanzamiento" style="margin-bottom:10px"><input type="checkbox" name="contarApartados" ${pref.contarApartados?'checked':''}> Contar los apartados como vendidos</label>
        <label class="f"><span>Texto de contacto (opcional)</span><textarea name="contacto" rows="1" class="crece" placeholder="Escríbeme al 0414-1234567">${esc(pref.contacto)}</textarea></label>
      </form>
    </div>
    <div class="acts">
      <button class="btn" data-x>Cerrar</button>
      <button class="btn" id="iTexto" data-solo="lanzamiento">📝 Texto para pegar</button>
      ${nativo ? '<button class="btn" id="iCopiar">Copiar</button><button class="btn pri" id="iGuardar">Guardar imagen</button>'
               : '<button class="btn" id="iDescargar">Descargar</button><button class="btn pri" id="iCompartir">Compartir</button>'}
    </div>`);
  sh.classList.add('ancho');
  const cv = sh.querySelector('#cvImg'); const form = sh.querySelector('#fImg');
  let blob = null, pend = null, pendGuardar = null;
  let guardado = JSON.stringify(r.imagen || null);
  const opciones = () => ({
    plantilla: form.plantilla.value, tema: form.tema.value, mostrar: form.mostrar.value,
    contarApartados: form.contarApartados.checked, contacto: form.contacto.value.trim(),
    tamano: form.tamano.value, pagos: form.pagos.value.trim(), frase: form.frase.value.trim(), extra: form.extra.value.trim(),
    whatsapp: form.whatsapp.value.trim(), qr: form.qr.checked, otrasMonedas: form.otrasMonedas.checked
  });
  const redibujar = (manual) => {
    const op = opciones();
    sh.querySelectorAll('[data-solo]').forEach(el => el.style.display = op.plantilla === el.dataset.solo ? '' : 'none');
    sh.querySelectorAll('[data-no]').forEach(el => el.style.display = op.plantilla === el.dataset.no ? 'none' : '');
    // La foto puede tardar en cargar: cuando termine se vuelve a dibujar.
    const res = dibujarImagen(cv, r, { ...op, alCargar: () => { if(cv.isConnected) redibujar(false); } }) || {};
    const aviso = sh.querySelector('#iAviso');
    aviso.hidden = !res.cortado;
    if(res.cortado) aviso.textContent = op.plantilla === 'lanzamiento' && op.tamano === 'cuadrado'
      ? '⚠️ El texto no cabe completo en cuadrado (se cortó con “…”). Acórtalo o usa Vertical.'
      : '⚠️ Hay texto que no cabe completo (se cortó con “…”). Acórtalo un poco.';
    blob = null; clearTimeout(pend);
    // Se prepara el archivo de una vez para que "Compartir" funcione al primer toque en el iPhone.
    pend = setTimeout(() => cv.toBlob(b => { blob = b; }, 'image/png'), 50);
    if(manual !== true) return; // al abrir la ventana no se guarda nada
    op.manual = true; guardarPrefImagen(op);
    // Guardar el diseño en la rifa (una sola escritura cuando dejas de cambiar cosas).
    clearTimeout(pendGuardar);
    pendGuardar = setTimeout(async () => {
      const j = JSON.stringify(op);
      if(j === guardado) return;
      try{ await S.db.doc(`rifas/${r.id}`).update({ imagen: op }); guardado = j; }catch(e){}
    }, 600);
  };
  // El responsable se guarda en la rifa (sale también en el comprobante) y se recuerda para la próxima rifa.
  let pendResp = null;
  form.responsable.addEventListener('input', () => {
    r.responsable = form.responsable.value.trim();
    clearTimeout(pendResp);
    pendResp = setTimeout(async () => {
      try{ await S.db.doc(`rifas/${r.id}`).update({ responsable: r.responsable }); recordarResponsable(r.responsable); }catch(e){}
    }, 600);
  });
  form.addEventListener('input', () => redibujar(true)); form.addEventListener('change', () => redibujar(true));
  redibujar(false);

  // Foto del premio: se achica (~150 KB) y se guarda en la rifa para que salga igual en todos los equipos.
  const inFoto = sh.querySelector('#iFoto'), info = sh.querySelector('#iFotoInfo');
  inFoto.onchange = async () => {
    const a = inFoto.files[0]; if(!a) return;
    info.textContent = 'Preparando la foto…';
    try{
      const dato = await achicarFoto(a);
      await S.db.doc(`rifas/${r.id}`).update({ foto: dato });
      r.foto = dato; info.textContent = `Lista (${Math.round(bytesDataURL(dato)/1024)} KB)`;
      sh.querySelector('#iFotoTxt').textContent = 'Cambiar foto'; sh.querySelector('#iQuitarFoto').hidden = false;
      redibujar(false);
    }catch(e){ info.textContent = ''; toast('No se pudo usar esa foto'); }
    inFoto.value = '';
  };
  sh.querySelector('#iQuitarFoto').onclick = async () => {
    try{ await S.db.doc(`rifas/${r.id}`).update({ foto: null }); }catch(e){ return toast(errorTxt(e)); }
    r.foto = null; info.textContent = ''; sh.querySelector('#iFotoTxt').textContent = 'Elegir foto'; sh.querySelector('#iQuitarFoto').hidden = true;
    redibujar(false);
  };
  sh.querySelector('#iTexto').onclick = () => ventanaAnuncio(r, opciones());
  activarCrecer(sh);

  const nombreArchivo = () => `${form.plantilla.value === 'lanzamiento' ? 'flyer' : 'estado'}-${r.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}.png`;
  const conBlob = async () => blob || await new Promise(res => cv.toBlob(res, 'image/png'));

  const bG = sh.querySelector('#iGuardar');
  if(bG) bG.onclick = async () => {
    const b = await conBlob();
    try{ const ok = await window.rifasNativo.guardarImagen(nombreArchivo(), new Uint8Array(await b.arrayBuffer())); if(ok) toast('Imagen guardada'); }
    catch(e){ toast('No se pudo guardar la imagen'); }
  };
  const bC = sh.querySelector('#iCopiar');
  if(bC) bC.onclick = async () => {
    const b = await conBlob();
    try{ await window.rifasNativo.copiarImagen(new Uint8Array(await b.arrayBuffer())); toast('Imagen copiada. Pégala en WhatsApp Web con Ctrl+V'); }
    catch(e){ toast('No se pudo copiar la imagen'); }
  };
  const bS = sh.querySelector('#iCompartir');
  if(bS) bS.onclick = async () => {
    if(!blob){ toast('Preparando la imagen, toca otra vez'); return; }
    const file = new File([blob], nombreArchivo(), { type:'image/png' });
    if(navigator.canShare && navigator.canShare({ files:[file] })){
      try{ await navigator.share({ files:[file], title: r.nombre }); }
      catch(e){ if(e && e.name !== 'AbortError') toast('No se pudo compartir'); }
    } else descargarBlob(blob, nombreArchivo());
  };
  const bD = sh.querySelector('#iDescargar');
  if(bD) bD.onclick = async () => descargarBlob(await conBlob(), nombreArchivo());
}
function descargarBlob(b, nombre){
  const url = URL.createObjectURL(b); const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
