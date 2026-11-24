// ================= Flyer de lanzamiento =================
// Tercer diseño de "Imagen para estados": anuncia la rifa antes de empezar a vender.
// Lleva la foto del premio (achicada y guardada en la rifa para que se sincronice), los premios
// con fecha, lotería y % para jugar, el precio en varias monedas, el rango de números, las formas
// de pago, el contacto y un QR opcional que abre WhatsApp. Tamaños: vertical 1080x1920 o cuadrado 1080x1080.
// Usa funciones de imagen.js (f, TEMAS, partirTexto, rectRedondo) y de app.js (money, fmtM, fmtNum, etc.).

const FOTO_MAX_BYTES = 150 * 1024;

// ---------- foto del premio ----------
// Achica la foto a JPEG de ~150 KB como máximo y la devuelve como data URL.
async function achicarFoto(archivo){
  const url = URL.createObjectURL(archivo);
  try{
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo leer la imagen')); i.src = url; });
    let lado = 1080, calidad = 0.85, dato = '';
    for(let intento = 0; intento < 12; intento++){
      const esc = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.naturalWidth * esc)); cv.height = Math.max(1, Math.round(img.naturalHeight * esc));
      const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height);
      dato = cv.toDataURL('image/jpeg', calidad);
      if(bytesDataURL(dato) <= FOTO_MAX_BYTES) break;
      if(calidad > 0.6) calidad -= 0.1; else lado = Math.round(lado * 0.85);
    }
    return dato;
  } finally { URL.revokeObjectURL(url); }
}
const bytesDataURL = d => Math.round((d.length - d.indexOf(',') - 1) * 3 / 4);

const cacheFotos = new Map();
// Devuelve la imagen ya cargada, o null (y avisa con alCargar cuando termine de cargar).
function fotoCargada(dato, alCargar){
  if(!dato) return null;
  let e = cacheFotos.get(dato);
  if(!e){
    e = { img: new Image(), listo: false, esperando: [] };
    e.img.onload = () => { e.listo = true; e.esperando.splice(0).forEach(fn => fn()); };
    e.img.src = dato;
    if(cacheFotos.size > 6) cacheFotos.delete(cacheFotos.keys().next().value);
    cacheFotos.set(dato, e);
  }
  if(e.listo) return e.img;
  if(alCargar) e.esperando.push(alCargar);
  return null;
}

// ---------- datos que muestra el flyer ----------
function preciosOtrasMonedas(r){
  const out = [];
  for(const m of MONEDAS){
    if(m === r.moneda) continue;
    if(m === 'USDT' && (r.moneda === '$' || r.moneda === 'USDT')) continue; // mismo valor que el dólar
    if(m === '$' && r.moneda === 'USDT') continue;
    if(!S.tasas[m] && m !== '$') continue;
    const t = tasaEntre(m, r.moneda);
    if(t) out.push(fmtM(r.precio * t, m));
  }
  return out;
}
const rangoTxt = r => `Números del ${fmtNum(r, r.inicio)} al ${fmtNum(r, r.inicio + r.cantidad - 1)}`;
const condicionTxt = p => p.requisito >= 100 ? 'número pagado completo' : `juegas con ${p.requisito}% abonado`;
const detallePremio = p => [p.fecha ? fmtFecha(p.fecha) : 'Fecha por anunciar', p.loteria, condicionTxt(p)].filter(Boolean).join(' · ');
function urlWhatsFlyer(r, op){
  const tel = telWa(op.whatsapp);
  return tel ? `https://wa.me/${tel}?text=${encodeURIComponent(`Hola, quiero apartar un número de la rifa "${r.nombre}"`)}` : '';
}

// Texto listo para pegar junto al flyer (WhatsApp, Instagram, grupos).
function textoFlyer(r, op){
  const may = premioMayor(r);
  const ps = may ? [may, ...premiosOrden(r).filter(p => p !== may)] : premiosOrden(r);
  let t = `🎟️ ¡GRAN RIFA! ${r.nombre}\n\n🏆 ${ps.length > 1 ? 'Premios' : 'Premio'}:\n`;
  t += ps.map(p => `• ${p.nombre}${p.fecha ? ' — ' + fmtFecha(p.fecha) : ''}${p.loteria ? ' (' + p.loteria + ')' : ''} — ${condicionTxt(p)}`).join('\n');
  const otras = op.otrasMonedas ? preciosOtrasMonedas(r) : [];
  t += `\n\n💵 Precio: ${money(r.precio, r)} por número${otras.length ? ' (' + otras.join(' · ') + ')' : ''}`;
  t += `\n🔢 ${rangoTxt(r)}`;
  // Los campos de varias líneas se pegan tal cual los escribiste, cada línea en su renglón.
  const bloque = (et, v) => { v = String(v || '').trim(); if(!v) return ''; return v.includes('\n') ? `\n${et}\n${v}` : `\n${et} ${v}`; };
  t += bloque('👤 Responsable:', r.responsable);
  t += bloque('💳 Formas de pago:', op.pagos);
  t += bloque('📲 Contacto:', op.contacto);
  // En el texto va el enlace corto (wa.me/número); el QR sí lleva el mensaje ya escrito.
  const tel = telWa(op.whatsapp);
  if(tel) t += `\n👉 Aparta aquí: https://wa.me/${tel}`;
  if(String(op.extra || '').trim()) t += `\n\n${String(op.extra).trim()}`;
  return t + `\n\n${String(op.frase || '¡Aparta el tuyo!').trim()} 🍀`;
}

// Ventana para ordenar y editar el anuncio antes de copiarlo. La versión editada se guarda en la rifa.
function ventanaAnuncio(r, op){
  const auto = textoFlyer(r, op);
  const sh = modal(`<h2>📝 Texto para pegar</h2>
    <p class="muted" style="margin-top:0;font-size:13px">Ordénalo y cámbialo a tu gusto (Enter para nueva línea). Se guarda en esta rifa.</p>
    <textarea id="aTexto" class="crece" style="min-height:300px">${esc(r.anuncio || auto)}</textarea>
    <div class="muted" id="aEstado" style="font-size:12px;margin-top:4px">${r.anuncio ? 'Texto editado por ti.' : 'Texto automático con los datos de la rifa.'}</div>
    <div class="acts"><button class="btn" id="aVolver">← Volver al flyer</button><button class="btn" id="aAuto">Volver al texto automático</button><button class="btn pri" id="aCopiar">Copiar</button></div>`);
  const ta = sh.querySelector('#aTexto'), est = sh.querySelector('#aEstado');
  activarCrecer(sh);
  let pend = null;
  const guardar = valor => { clearTimeout(pend); pend = setTimeout(async () => { try{ await S.db.doc(`rifas/${r.id}`).update({ anuncio: valor }); }catch(e){} }, 500); };
  ta.addEventListener('input', () => { r.anuncio = ta.value; est.textContent = 'Texto editado por ti (guardado).'; guardar(ta.value); });
  sh.querySelector('#aAuto').onclick = () => { ta.value = auto; r.anuncio = null; est.textContent = 'Texto automático con los datos de la rifa.'; guardar(null); crecer(ta); };
  sh.querySelector('#aCopiar').onclick = () => copiar(ta.value);
  sh.querySelector('#aVolver').onclick = () => { clearTimeout(pend); if(r.anuncio !== undefined) S.db.doc(`rifas/${r.id}`).update({ anuncio: r.anuncio || null }).catch(()=>{}); ventanaImagen(r); };
}
// Los cuadros de texto crecen con lo que escribes.
function crecer(ta){ ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }
function activarCrecer(cont){ cont.querySelectorAll('textarea.crece').forEach(ta => { crecer(ta); ta.addEventListener('input', () => crecer(ta)); }); }

// ---------- dibujo ----------
function dibujarQR(ctx, texto, x, y, lado){
  if(typeof qrcode !== 'function' || !texto) return false;
  const q = qrcode(0, 'M'); q.addData(texto); q.make();
  const n = q.getModuleCount(), borde = 2, cel = lado / (n + borde * 2);
  ctx.fillStyle = '#ffffff'; rectRedondo(ctx, x, y, lado, lado, 16); ctx.fill();
  ctx.fillStyle = '#111111';
  for(let fy = 0; fy < n; fy++) for(let fx = 0; fx < n; fx++)
    if(q.isDark(fy, fx)) ctx.fillRect(Math.floor(x + (fx + borde) * cel), Math.floor(y + (fy + borde) * cel), Math.ceil(cel), Math.ceil(cel));
  return true;
}
// Dibuja la foto recortada para llenar el rectángulo (como "cover"), con esquinas redondeadas.
function dibujarFotoCover(ctx, img, x, y, w, h, rad){
  ctx.save(); rectRedondo(ctx, x, y, w, h, rad); ctx.clip();
  const esc = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * esc, ih = img.naturalHeight * esc;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}
// Sin foto: si el premio mayor es dinero se dibuja el monto en billetes; si no, un trofeo.
function marcoSinFoto(ctx, T, x, y, w, h, rad, premio){
  const dinero = premio && montoEnTexto(premio.nombre);
  if(dinero) return dibujarDinero(ctx, T, x, y, w, h, rad, dinero);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; rectRedondo(ctx, x, y, w, h, rad); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = f(400, Math.min(w, h) * 0.45); ctx.fillText('🏆', x + w/2, y + h/2);
  ctx.textBaseline = 'alphabetic';
}
function dibujarDinero(ctx, T, x, y, w, h, rad, d){
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; rectRedondo(ctx, x, y, w, h, rad); ctx.fill();
  rectRedondo(ctx, x, y, w, h, rad); ctx.clip();
  const cx = x + w/2, cy = y + h/2;
  const bw = Math.min(w * 0.78, h * 1.6), bh = bw * 0.46;
  // Fajo: billetes de atrás, girados
  const billete = (ang, dx, dy, alfa) => {
    ctx.save(); ctx.translate(cx + dx, cy + dy); ctx.rotate(ang * Math.PI / 180); ctx.globalAlpha = alfa;
    const g = ctx.createLinearGradient(-bw/2, -bh/2, bw/2, bh/2); g.addColorStop(0, T.acento); g.addColorStop(1, '#a16207');
    ctx.fillStyle = g; rectRedondo(ctx, -bw/2, -bh/2, bw, bh, bh * 0.08); ctx.fill();
    ctx.strokeStyle = 'rgba(31,19,0,0.45)'; ctx.lineWidth = Math.max(2, bh * 0.02);
    rectRedondo(ctx, -bw/2 + bh*0.07, -bh/2 + bh*0.07, bw - bh*0.14, bh - bh*0.14, bh * 0.05); ctx.stroke();
    ctx.beginPath(); ctx.arc(-bw/2 + bh*0.42, 0, bh*0.24, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(bw/2 - bh*0.42, 0, bh*0.24, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  };
  billete(-9, -bw*0.04, bh*0.10, 0.55);
  billete(6, bw*0.04, bh*0.06, 0.75);
  billete(0, 0, 0, 1);
  // Monto grande sobre el billete de adelante
  ctx.fillStyle = '#1f1300'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let tam = bh * 0.42; ctx.font = f(900, tam);
  while(tam > 12 && ctx.measureText(d.monto).width > bw * 0.62){ tam -= 2; ctx.font = f(900, tam); }
  ctx.fillText(d.monto, cx, cy - bh * 0.06);
  ctx.font = f(800, Math.max(14, bh * 0.15));
  ctx.fillText(d.moneda ? d.moneda : 'EN EFECTIVO', cx, cy + bh * 0.27);
  // Etiqueta arriba
  ctx.fillStyle = T.texto; ctx.font = f(800, Math.max(16, h * 0.07));
  ctx.fillText('💰 PREMIO EN EFECTIVO', cx, y + h * 0.11);
  ctx.restore(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
}

// ---------- textos de varias líneas ----------
// Respeta los saltos de línea que escribe el usuario: cada línea en su renglón y, si es larga, se parte.
// Si no cabe en maxLineas, achica la letra hasta "min"; si aun así no cabe, corta con "…".
// prefijo: se pone delante de la primera línea (por ejemplo "💳 ").
function medirParrafos(ctx, texto, ancho, peso, tam, min, maxLineas, prefijo){
  const parrafos = String(texto || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if(!parrafos.length) return { lineas: [], tam, peso, alto: 0, salto: 0, cortado: false };
  if(maxLineas < 1) return { lineas: [], tam, peso, alto: 0, salto: 0, cortado: true };
  if(prefijo) parrafos[0] = prefijo + parrafos[0];
  for(let t = tam; ; t -= 2){
    ctx.font = f(peso, t);
    let lineas = parrafos.flatMap(p => partirTexto(ctx, p, ancho, 99));
    if(lineas.length <= maxLineas || t - 2 < min){
      const cortado = lineas.length > maxLineas;
      if(cortado){
        lineas = lineas.slice(0, maxLineas);
        let u = lineas[maxLineas - 1];
        while(u.length > 1 && ctx.measureText(u + '…').width > ancho) u = u.slice(0, -1);
        lineas[maxLineas - 1] = u + '…';
      }
      const salto = Math.round(t * 1.3);
      return { lineas, tam: t, peso, salto, alto: lineas.length * salto, cortado };
    }
  }
}
// Dibuja lo medido; y es la línea base del primer renglón. Devuelve la y que sigue.
function pintarParrafos(ctx, m, x, y){
  ctx.font = f(m.peso, m.tam);
  m.lineas.forEach((l, i) => ctx.fillText(l, x, y + i * m.salto));
  return y + m.alto;
}
// Franja dorada con la frase (una o dos líneas).
function medirPastilla(ctx, texto, tam, maxW, maxLineas){ return medirParrafos(ctx, texto, maxW - 70, 800, tam, Math.round(tam * 0.65), maxLineas); }
const altoPastilla = m => m.alto + m.tam * 0.9;
function pintarPastilla(ctx, T, m, cx, y, maxW){
  ctx.font = f(m.peso, m.tam);
  const w = Math.min(maxW, Math.max(0, ...m.lineas.map(l => ctx.measureText(l).width)) + 90);
  const alto = altoPastilla(m);
  ctx.fillStyle = T.acento; rectRedondo(ctx, cx - w/2, y, w, alto, Math.min(alto/2, 50)); ctx.fill();
  ctx.fillStyle = '#1f1300'; ctx.textAlign = 'center';
  pintarParrafos(ctx, m, cx, y + m.tam * 1.4);
  return alto;
}

function dibujarFlyer(canvas, r, op){
  const cuadrado = op.tamano === 'cuadrado';
  const W = 1080, H = cuadrado ? 1080 : 1920;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const T = TEMAS[op.tema] || TEMAS.dorado;
  const ps = premiosOrden(r);
  const mayor = premioMayor(r);
  // Los demás premios van en la lista; el principal ya sale destacado arriba con sus datos.
  const otros = ps.filter(p => p !== mayor);
  const img = fotoCargada(r.foto, op.alCargar);
  const otras = op.otrasMonedas ? preciosOtrasMonedas(r) : [];
  const wa = op.qr ? urlWhatsFlyer(r, op) : '';

  // Fondo
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, T.a); g.addColorStop(1, T.b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath(); ctx.arc(W - 80, 120, cuadrado ? 180 : 260, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(60, H - 120, cuadrado ? 200 : 320, 0, Math.PI*2); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  if(cuadrado) return flyerCuadrado(ctx, r, op, T, { W, H, otros, mayor, img, otras, wa });

  // ----- vertical 1080x1920 -----
  const resp = String(r.responsable || '').trim(), conQR = !!wa;
  const anchoTxt = conQR ? W - 120 - 80 - 230 : W - 180;
  // Se mide todo con unos topes de líneas; si no cabe ni achicando la foto, se bajan los topes poco a poco.
  const topes = { lista: 3, extra: 4, pagos: 3, resp: 2, contacto: 2, frase: 2 };
  const recortes = [['extra', 2], ['lista', 2], ['pagos', 2], ['extra', 1], ['lista', 1], ['resp', 1], ['contacto', 1], ['frase', 1], ['pagos', 1], ['lista', 0], ['extra', 0]];
  ctx.font = f(800, 84); const lNombre = partirTexto(ctx, r.nombre, 960, 2);
  ctx.font = f(800, 62); const lMayor = mayor ? partirTexto(ctx, '🏆 ' + mayor.nombre, 960, 2) : [];
  const fy = 210 + lNombre.length * 92 - 30, hDet = mayor ? 50 : 0, PASO = 92;
  const medir = () => {
    const lista = otros.slice(0, topes.lista);
    const hL = lista.length ? 34 + lista.length * PASO : 0;
    const fr = medirPastilla(ctx, op.frase || '¡Aparta el tuyo!', 52, 960, topes.frase);
    const k = escala;
    const ex = medirParrafos(ctx, op.extra, 940, 500, Math.round(34*k), Math.round(28*k), topes.extra);
    const mr = medirParrafos(ctx, resp, anchoTxt, 800, Math.round(36*k), Math.round(30*k), topes.resp, '👤 Organiza: ');
    const mp = medirParrafos(ctx, op.pagos, anchoTxt, 700, Math.round(36*k), Math.round(30*k), topes.pagos, '💳 ');
    const mc = medirParrafos(ctx, op.contacto, anchoTxt, 700, Math.round(40*k), Math.round(32*k), topes.contacto);
    const hayCard = !!(resp || op.pagos || op.contacto || conQR);
    const hTxt = 40 + mr.alto + (mr.alto ? 10 : 0) + mp.alto + (mp.alto ? 10 : 0) + mc.alto + 20;
    const hT = hayCard ? Math.max(conQR ? 260 : 0, hTxt) : 0;
    const resto = 80 + lMayor.length * 70 + hDet - 10 + hL + (hL ? 90 : 50) + 56 + 70 + 40 + altoPastilla(fr) + (ex.alto ? 30 + ex.alto : 0) + 40;
    const yT = H - 50 - hT;
    return { lista, hL, fr, ex, mr, mp, mc, hayCard, hT, yT, fh: Math.min(620, yT - fy - resto) };
  };
  // Si no cabe: primero se achica la foto (hasta 170), luego la letra de los textos (85%) y solo al final se recortan líneas.
  let escala = 1, m = medir();
  if(m.fh < 170){ escala = 0.85; m = medir(); }
  for(const [k, v] of recortes){ if(m.fh >= 170) break; if(topes[k] > v){ topes[k] = v; m = medir(); } }
  const fh = Math.max(150, m.fh);

  ctx.fillStyle = T.acento; ctx.font = f(700, 40); ctx.fillText('🎟️  G R A N   R I F A', W/2, 110);
  ctx.fillStyle = T.texto; ctx.font = f(800, 84);
  let y = 210;
  for(const l of lNombre){ ctx.fillText(l, W/2, y); y += 92; }
  if(img) dibujarFotoCover(ctx, img, 60, fy, W - 120, fh, 40); else marcoSinFoto(ctx, T, 60, fy, W - 120, fh, 40, mayor);
  y = fy + fh + 80;
  // Premio mayor
  ctx.fillStyle = T.texto; ctx.font = f(800, 62);
  for(const l of lMayor){ ctx.fillText(l, W/2, y); y += 70; }
  if(mayor){
    ctx.globalAlpha = 0.9; ctx.font = f(500, 34);
    ctx.fillText(partirTexto(ctx, detallePremio(mayor), 960, 1)[0] || '', W/2, y - 14); ctx.globalAlpha = 1;
    y += hDet;
  }
  // Lista de los otros premios
  const yL = y - 10;
  if(m.hL){ ctx.fillStyle = 'rgba(255,255,255,0.12)'; rectRedondo(ctx, 60, yL, W - 120, m.hL, 28); ctx.fill(); }
  m.lista.forEach((p, i) => {
    const y1 = yL + 58 + i * PASO;
    ctx.fillStyle = T.texto; ctx.font = f(700, 36);
    ctx.fillText(partirTexto(ctx, `📅 ${p.nombre} · ${p.fecha ? fmtFecha(p.fecha) : 'Fecha por anunciar'}`, W - 180, 1)[0], W/2, y1);
    ctx.globalAlpha = 0.85; ctx.font = f(500, 30);
    ctx.fillText(partirTexto(ctx, [p.loteria, condicionTxt(p)].filter(Boolean).join(' · '), W - 180, 1)[0], W/2, y1 + 38);
    ctx.globalAlpha = 1;
  });
  y = m.hL ? yL + m.hL + 90 : y + 40;
  // Precio, rango, frase y texto adicional
  ctx.fillStyle = T.acento; ctx.font = f(800, 96); ctx.fillText(`${money(r.precio, r)}`, W/2, y);
  ctx.fillStyle = T.texto; ctx.font = f(600, 40); y += 56; ctx.fillText(otras.length ? `por número · ${otras.join(' · ')}` : 'por número', W/2, y);
  y += 70; ctx.font = f(600, 42); ctx.fillText(rangoTxt(r), W/2, y);
  y += 40; y += pintarPastilla(ctx, T, m.fr, W/2, y, 960);
  if(m.ex.alto){ ctx.fillStyle = T.texto; ctx.globalAlpha = 0.92; pintarParrafos(ctx, m.ex, W/2, y + 30 + m.ex.tam); ctx.globalAlpha = 1; }
  // Tarjeta inferior: responsable, formas de pago, contacto y QR
  if(m.hayCard){ ctx.fillStyle = 'rgba(255,255,255,0.14)'; rectRedondo(ctx, 60, m.yT, W - 120, m.hT, 36); ctx.fill(); }
  const xTxt = conQR ? 100 : W/2;
  ctx.textAlign = conQR ? 'left' : 'center';
  let yy = m.yT + 40;
  if(m.mr.alto){ ctx.fillStyle = T.texto; yy = pintarParrafos(ctx, m.mr, xTxt, yy + m.mr.tam) - m.mr.tam + 10; }
  if(m.mp.alto){ ctx.fillStyle = T.texto; yy = pintarParrafos(ctx, m.mp, xTxt, yy + m.mp.tam) - m.mp.tam + 10; }
  if(m.mc.alto){ ctx.fillStyle = T.acento; pintarParrafos(ctx, m.mc, xTxt, yy + m.mc.tam); }
  if(conQR){
    dibujarQR(ctx, wa, W - 60 - 30 - 200, m.yT + 25, 200);
    ctx.textAlign = 'center'; ctx.fillStyle = T.texto; ctx.font = f(600, 22); ctx.fillText('Escanea y escríbeme', W - 60 - 30 - 100, m.yT + 250);
  }
  ctx.textAlign = 'center';
  return { fh, topes, cortado: [m.fr, m.ex, m.mr, m.mp, m.mc].some(x => x.cortado) || otros.length > m.lista.length };
}

function flyerCuadrado(ctx, r, op, T, d){
  const { W, H, otros, mayor, img, otras, wa } = d;
  ctx.fillStyle = T.acento; ctx.font = f(700, 30); ctx.fillText('🎟️  G R A N   R I F A', W/2, 70);
  ctx.fillStyle = T.texto; ctx.font = f(800, 62);
  ctx.fillText(partirTexto(ctx, r.nombre, 980, 1)[0] || r.nombre, W/2, 145);
  // Foto a la izquierda
  const fx = 50, fy = 185, fl = 470;
  if(img) dibujarFotoCover(ctx, img, fx, fy, fl, fl, 32); else marcoSinFoto(ctx, T, fx, fy, fl, fl, 32, mayor);
  // Columna derecha: premio, premios, precio
  const xc = fx + fl + 40, wc = W - xc - 50, xm = xc + wc/2;
  let y = fy + 50;
  if(mayor){
    ctx.fillStyle = T.texto; ctx.font = f(800, 44); for(const l of partirTexto(ctx, '🏆 ' + mayor.nombre, wc, 2)){ ctx.fillText(l, xm, y); y += 52; }
    ctx.font = f(500, 26); for(const l of partirTexto(ctx, detallePremio(mayor), wc, 2)){ ctx.fillText(l, xm, y); y += 34; }
  }
  ctx.font = f(500, 26); y += 10;
  for(const p of otros.slice(0, 2)){
    const det = [p.nombre, p.fecha ? fmtFecha(p.fecha) : '', p.loteria, condicionTxt(p)].filter(Boolean).join(' · ');
    for(const l of partirTexto(ctx, '📅 ' + det, wc, 2)){ ctx.fillText(l, xm, y); y += 34; }
    y += 6;
  }
  y = Math.max(y + 40, fy + 330);
  ctx.fillStyle = T.acento; ctx.font = f(800, 72); ctx.fillText(money(r.precio, r), xm, Math.min(y, fy + fl - 50));
  ctx.fillStyle = T.texto; ctx.font = f(600, 26);
  const yp = Math.min(y, fy + fl - 50) + 40;
  for(const [i, l] of partirTexto(ctx, otras.length ? 'por número · ' + otras.join(' · ') : 'por número', wc, 2).entries()) ctx.fillText(l, xm, yp + i * 32);
  // Franja inferior: rango, frase, texto adicional y abajo responsable / pagos / contacto (+ QR)
  const yF = fy + fl + 30, conQR = !!wa, anchoTxt = conQR ? W - 100 - 200 : W - 100;
  const resp = String(r.responsable || '').trim();
  const topes = { frase: 2, extra: 3, resp: 2, pagos: 3, contacto: 3 };
  const recortes = [['extra', 2], ['pagos', 2], ['extra', 1], ['pagos', 1], ['resp', 1], ['frase', 1], ['contacto', 2], ['extra', 0]];
  const medir = () => {
    const k = escala;
    const fr = medirPastilla(ctx, op.frase || '¡Aparta el tuyo!', Math.round(42*k), 900, topes.frase);
    const ex = medirParrafos(ctx, op.extra, 960, 500, Math.round(26*k), 20, topes.extra);
    const mr = medirParrafos(ctx, resp, anchoTxt, 800, Math.round(28*k), 20, topes.resp, '👤 Organiza: ');
    const mp = medirParrafos(ctx, op.pagos, anchoTxt, 700, Math.round(30*k), 20, topes.pagos, '💳 ');
    const mc = medirParrafos(ctx, op.contacto, anchoTxt, 700, Math.round(32*k), 22, topes.contacto);
    const fin = yF + 65 + altoPastilla(fr) + (ex.alto ? 14 + ex.alto : 0) + 24 + mr.alto + mp.alto + mc.alto;
    return { fr, ex, mr, mp, mc, sobra: fin - (H - 25) };
  };
  let escala = 1, m = medir();
  if(m.sobra > 0){ escala = 0.85; m = medir(); }
  for(const [k, v] of recortes){ if(m.sobra <= 0) break; if(topes[k] > v){ topes[k] = v; m = medir(); } }
  ctx.font = f(600, 34); ctx.fillStyle = T.texto; ctx.fillText(rangoTxt(r), W/2, yF + 40);
  let yy = yF + 65 + pintarPastilla(ctx, T, m.fr, W/2, yF + 65, 900);
  if(m.ex.alto){ ctx.fillStyle = T.texto; ctx.globalAlpha = 0.92; yy = pintarParrafos(ctx, m.ex, W/2, yy + 14 + m.ex.tam) - m.ex.tam; ctx.globalAlpha = 1; }
  yy += 24;
  ctx.textAlign = conQR ? 'left' : 'center'; const xT = conQR ? 60 : W/2;
  if(m.mr.alto){ ctx.fillStyle = T.texto; yy = pintarParrafos(ctx, m.mr, xT, yy + m.mr.tam) - m.mr.tam; }
  if(m.mp.alto){ ctx.fillStyle = T.texto; yy = pintarParrafos(ctx, m.mp, xT, yy + m.mp.tam) - m.mp.tam; }
  if(m.mc.alto){ ctx.fillStyle = T.acento; pintarParrafos(ctx, m.mc, xT, yy + m.mc.tam); }
  if(conQR) dibujarQR(ctx, wa, W - 50 - 160, H - 50 - 160 + 10, 160);
  ctx.textAlign = 'center';
  return { topes, sobra: m.sobra, cortado: [m.fr, m.ex, m.mr, m.mp, m.mc].some(x => x.cortado) || m.sobra > 0 };
}
