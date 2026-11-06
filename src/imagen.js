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
  negro:  { a:'#111827', b:'#1f2937', acento:'#f59e0b', texto:'#ffffff' }
};

// Dibuja la imagen en el canvas. op: { plantilla, tema, contarApartados, mostrar ('pct'|'cant'), contacto }
function dibujarImagen(canvas, r, op){
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
  const mayor = premios[premios.length - 1];
  const prox = premios.find(p => !p.ganador);

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
  if(mayor){
    ctx.font = f(600, 50);
    for(const l of partirTexto(ctx, '🏆 ' + mayor.nombre, 940, 2)){ ctx.fillText(l, IMG_W/2, y + 10); y += 62; }
  }
  const yCuerpo = Math.max(y + 60, 520);

  if(op.plantilla === 'numeros') dibujarCuadricula(ctx, r, op, T, yCuerpo, 1500);
  else dibujarProgreso(ctx, T, yCuerpo, { pct, vendidos, total, libres, mostrar: op.mostrar });

  // Tarjeta inferior: precio, próximo sorteo y contacto
  const yT = 1530, hT = 300;
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; rectRedondo(ctx, 60, yT, IMG_W-120, hT, 36); ctx.fill();
  ctx.fillStyle = T.texto; ctx.font = f(700, 54);
  ctx.fillText(`💵 ${money(r.precio, r)} por número`, IMG_W/2, yT + 80);
  ctx.font = f(500, 38);
  if(prox){
    const det = `${prox.fecha ? fmtFecha(prox.fecha) : 'Fecha por anunciar'}${prox.requisito < 100 ? ` · juegas con ${prox.requisito}% abonado` : ''}`;
    for(const [i, l] of partirTexto(ctx, `📅 ${prox.nombre}: ${det}`, 900, 2).entries()) ctx.fillText(l, IMG_W/2, yT + 150 + i*48);
  }
  if(op.contacto){
    ctx.font = f(700, 42); ctx.fillStyle = T.acento;
    ctx.fillText(partirTexto(ctx, op.contacto, 900, 1)[0], IMG_W/2, yT + hT - 30);
  }
  return { pct, vendidos, total, libres };
}

function dibujarProgreso(ctx, T, y0, d){
  const cx = IMG_W/2, cy = y0 + 330, rad = 280, grosor = 60;
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
    ctx.font = f(800, 150); ctx.fillText(String(d.vendidos), cx, cy - 30);
    ctx.font = f(600, 50); ctx.fillText(`de ${d.total} vendidos`, cx, cy + 80);
  } else {
    ctx.font = f(800, 190); ctx.fillText(d.pct + '%', cx, cy - 20);
    ctx.font = f(600, 54); ctx.fillText('VENDIDO', cx, cy + 100);
  }
  ctx.textBaseline = 'alphabetic';
  // Texto debajo del anillo
  const yt = cy + rad + 105;
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
function ventanaImagen(r){
  const pref = { plantilla:'progreso', tema:'morado', contarApartados:true, mostrar:'pct', contacto:'', ...leerPrefImagen() };
  const nativo = window.rifasNativo && window.rifasNativo.guardarImagen;
  const sh = modal(`<h2>Imagen para estados</h2>
    <div class="img-ed">
      <div class="img-prev"><canvas id="cvImg"></canvas></div>
      <form id="fImg" class="img-op">
        <label class="f"><span>Diseño</span><div class="seg">
          <label><input type="radio" name="plantilla" value="progreso" ${pref.plantilla!=='numeros'?'checked':''}>Progreso</label>
          <label><input type="radio" name="plantilla" value="numeros" ${pref.plantilla==='numeros'?'checked':''}>Números</label></div></label>
        <label class="f" data-solo="progreso"><span>Mostrar</span><select name="mostrar">
          <option value="pct" ${pref.mostrar!=='cant'?'selected':''}>Porcentaje (50%)</option>
          <option value="cant" ${pref.mostrar==='cant'?'selected':''}>Cantidad (50 de 100)</option></select></label>
        <label class="f"><span>Color</span><select name="tema">${Object.keys(TEMAS).map(k=>`<option value="${k}" ${pref.tema===k?'selected':''}>${k[0].toUpperCase()+k.slice(1)}</option>`).join('')}</select></label>
        <label class="row" style="margin-bottom:10px"><input type="checkbox" name="contarApartados" ${pref.contarApartados?'checked':''}> Contar los apartados como vendidos</label>
        <label class="f"><span>Texto de contacto (opcional)</span><input type="text" name="contacto" value="${esc(pref.contacto)}" placeholder="Escríbeme al 0414-1234567"></label>
      </form>
    </div>
    <div class="acts">
      <button class="btn" data-x>Cerrar</button>
      ${nativo ? '<button class="btn" id="iCopiar">Copiar</button><button class="btn pri" id="iGuardar">Guardar imagen</button>'
               : '<button class="btn" id="iDescargar">Descargar</button><button class="btn pri" id="iCompartir">Compartir</button>'}
    </div>`);
  sh.classList.add('ancho');
  const cv = sh.querySelector('#cvImg'); const form = sh.querySelector('#fImg');
  let blob = null, pend = null;
  const opciones = () => ({
    plantilla: form.plantilla.value, tema: form.tema.value, mostrar: form.mostrar.value,
    contarApartados: form.contarApartados.checked, contacto: form.contacto.value.trim()
  });
  const redibujar = () => {
    const op = opciones(); guardarPrefImagen(op);
    sh.querySelector('[data-solo="progreso"]').style.display = op.plantilla === 'progreso' ? '' : 'none';
    dibujarImagen(cv, r, op);
    blob = null; clearTimeout(pend);
    // Se prepara el archivo de una vez para que "Compartir" funcione al primer toque en el iPhone.
    pend = setTimeout(() => cv.toBlob(b => { blob = b; }, 'image/png'), 50);
  };
  form.addEventListener('input', redibujar); form.addEventListener('change', redibujar);
  redibujar();

  const nombreArchivo = () => `estado-${r.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}.png`;
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
