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
  if(op.pagos) t += `\n💳 Formas de pago: ${op.pagos}`;
  if(op.contacto) t += `\n📲 ${op.contacto}`;
  const wa = urlWhatsFlyer(r, op);
  if(wa) t += `\n👉 Aparta aquí: ${wa}`;
  return t + `\n\n${op.frase || '¡Aparta el tuyo!'} 🍀`;
}

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
function marcoSinFoto(ctx, T, x, y, w, h, rad){
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; rectRedondo(ctx, x, y, w, h, rad); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = f(400, Math.min(w, h) * 0.45); ctx.fillText('🏆', x + w/2, y + h/2);
  ctx.textBaseline = 'alphabetic';
}
function pastilla(ctx, T, texto, cx, y, alto, tam, maxW){
  ctx.font = f(800, tam);
  const w = Math.min(maxW, ctx.measureText(texto).width + alto);
  ctx.fillStyle = T.acento; rectRedondo(ctx, cx - w/2, y, w, alto, alto/2); ctx.fill();
  ctx.fillStyle = '#1f1300'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(partirTexto(ctx, texto, w - 40, 1)[0] || texto, cx, y + alto/2 + 2);
  ctx.textBaseline = 'alphabetic';
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
  ctx.fillStyle = T.acento; ctx.font = f(700, 40); ctx.fillText('🎟️  G R A N   R I F A', W/2, 110);
  ctx.fillStyle = T.texto; ctx.font = f(800, 84);
  let y = 210;
  const lNombre = partirTexto(ctx, r.nombre, 960, 2);
  for(const l of lNombre){ ctx.fillText(l, W/2, y); y += 92; }
  ctx.font = f(800, 62);
  const lMayor = mayor ? partirTexto(ctx, '🏆 ' + mayor.nombre, 960, 2) : [];
  const hDet = mayor ? 50 : 0;
  // Los otros premios, cada uno en dos líneas: nombre y fecha / lotería y condición (hasta 3).
  const lista = otros.slice(0, 3);
  const PASO = 92, hL = lista.length ? 34 + lista.length * PASO : 0;
  // La foto se achica si hace falta para que todo quepa sobre la tarjeta inferior.
  const fy = y - 30;
  const resto = 80 + lMayor.length * 70 + hDet - 10 + hL + (hL ? 90 : 50) + 56 + 70 + 40 + 100 + 30;
  const fh = Math.max(240, Math.min(620, (H - 300) - fy - resto));
  if(img) dibujarFotoCover(ctx, img, 60, fy, W - 120, fh, 40); else marcoSinFoto(ctx, T, 60, fy, W - 120, fh, 40);
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
  if(hL){ ctx.fillStyle = 'rgba(255,255,255,0.12)'; rectRedondo(ctx, 60, yL, W - 120, hL, 28); ctx.fill(); }
  lista.forEach((p, i) => {
    const y1 = yL + 58 + i * PASO;
    ctx.fillStyle = T.texto; ctx.font = f(700, 36);
    ctx.fillText(partirTexto(ctx, `📅 ${p.nombre} · ${p.fecha ? fmtFecha(p.fecha) : 'Fecha por anunciar'}`, W - 180, 1)[0], W/2, y1);
    ctx.globalAlpha = 0.85; ctx.font = f(500, 30);
    ctx.fillText(partirTexto(ctx, [p.loteria, condicionTxt(p)].filter(Boolean).join(' · '), W - 180, 1)[0], W/2, y1 + 38);
    ctx.globalAlpha = 1;
  });
  y = hL ? yL + hL + 90 : y + 40;
  // Precio
  ctx.fillStyle = T.acento; ctx.font = f(800, 96); ctx.fillText(`${money(r.precio, r)}`, W/2, y);
  ctx.fillStyle = T.texto; ctx.font = f(600, 40); y += 56; ctx.fillText(otras.length ? `por número · ${otras.join(' · ')}` : 'por número', W/2, y);
  y += 70; ctx.font = f(600, 42); ctx.fillText(rangoTxt(r), W/2, y);
  y += 40; pastilla(ctx, T, op.frase || '¡Aparta el tuyo!', W/2, y, 100, 52, 960);
  // Tarjeta inferior: formas de pago, contacto y QR
  const yT = H - 300, hT = 250, conQR = !!wa;
  // La tarjeta solo se dibuja si hay algo que poner (formas de pago, contacto o QR).
  if(op.pagos || op.contacto || conQR){ ctx.fillStyle = 'rgba(255,255,255,0.14)'; rectRedondo(ctx, 60, yT, W - 120, hT, 36); ctx.fill(); }
  const xTxt = conQR ? 100 : W/2, anchoTxt = conQR ? W - 120 - 80 - 230 : W - 180;
  ctx.textAlign = conQR ? 'left' : 'center'; ctx.fillStyle = T.texto;
  let yy = yT + 70;
  if(op.pagos){ ctx.font = f(700, 36); for(const l of partirTexto(ctx, '💳 ' + op.pagos, anchoTxt, 2)){ ctx.fillText(l, xTxt, yy); yy += 46; } yy += 10; }
  if(op.contacto){ ctx.font = f(700, 40); ctx.fillStyle = T.acento; for(const l of partirTexto(ctx, op.contacto, anchoTxt, 2)){ ctx.fillText(l, xTxt, yy); yy += 50; } }
  if(conQR){
    dibujarQR(ctx, wa, W - 60 - 30 - 200, yT + 25, 200);
    ctx.textAlign = 'center'; ctx.fillStyle = T.texto; ctx.font = f(600, 22); ctx.fillText('Escanea y escríbeme', W - 60 - 30 - 100, yT + hT - 4);
  }
  ctx.textAlign = 'center';
  return {};
}

function flyerCuadrado(ctx, r, op, T, d){
  const { W, H, otros, mayor, img, otras, wa } = d;
  ctx.fillStyle = T.acento; ctx.font = f(700, 30); ctx.fillText('🎟️  G R A N   R I F A', W/2, 70);
  ctx.fillStyle = T.texto; ctx.font = f(800, 62);
  ctx.fillText(partirTexto(ctx, r.nombre, 980, 1)[0] || r.nombre, W/2, 145);
  // Foto a la izquierda
  const fx = 50, fy = 185, fl = 470;
  if(img) dibujarFotoCover(ctx, img, fx, fy, fl, fl, 32); else marcoSinFoto(ctx, T, fx, fy, fl, fl, 32);
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
  // Franja inferior
  const yF = fy + fl + 30;
  ctx.font = f(600, 34); ctx.fillStyle = T.texto; ctx.fillText(rangoTxt(r), W/2, yF + 40);
  pastilla(ctx, T, op.frase || '¡Aparta el tuyo!', W/2, yF + 65, 80, 42, 900);
  const yB = yF + 170, conQR = !!wa, anchoTxt = conQR ? W - 100 - 200 : W - 100;
  ctx.textAlign = conQR ? 'left' : 'center'; const xT = conQR ? 60 : W/2;
  let yy = yB + 10;
  if(op.pagos){ ctx.font = f(700, 30); ctx.fillStyle = T.texto; ctx.fillText(partirTexto(ctx, '💳 ' + op.pagos, anchoTxt, 1)[0], xT, yy); yy += 44; }
  if(op.contacto){ ctx.font = f(700, 32); ctx.fillStyle = T.acento; ctx.fillText(partirTexto(ctx, op.contacto, anchoTxt, 1)[0], xT, yy); }
  if(conQR) dibujarQR(ctx, wa, W - 50 - 160, H - 50 - 160 + 10, 160);
  ctx.textAlign = 'center';
  return {};
}
