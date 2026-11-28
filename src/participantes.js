// ================= Lista de participantes =================
// Cuarto diseño de "Imagen para estados": publica quién tiene cada número, para dar transparencia.
// Privacidad: nunca muestra teléfonos ni montos; el nombre puede ir completo o "Nombre + inicial".
// Si no caben en una imagen se parte en páginas (1/2, 2/2…).
// Usa funciones de imagen.js / flyer.js (f, TEMAS, partirTexto, rectRedondo) y de app.js / calculos.js.

const POR_PAGINA = { vertical: 50, cuadrado: 24 };

// Lista ordenada por número. filtro: '' = todos los vendidos; id de un premio = solo los que juegan ese premio.
function participantes(r, op){
  let lista = numerosVendidos();
  const p = op.filtroPremio ? r.premios.find(x => x.id === op.filtroPremio) : null;
  if(p) lista = lista.filter(d => juega(p, d));
  return { premio: p, lista: lista.map(d => ({ num: d.num, nombre: nombreCorto(d.nombre, op.formatoNombre), estado: d.estado })) };
}
function paginasParticipantes(r, op){
  const { premio, lista } = participantes(r, op);
  return { premio, total: lista.length, paginas: paginar(lista, POR_PAGINA[op.tamano === 'cuadrado' ? 'cuadrado' : 'vertical']) };
}
const fechaCorta = () => new Date().toLocaleString('es-VE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
const marcaEstado = e => e === 'pagado' ? '✅' : '⏳';
function tituloLista(r, premio, total){ return `📋 Participantes (${total})`; }
// Si la lista es solo de los que juegan un premio, se aclara en una segunda línea.
const lineaPremio = p => `Juegan: ${p.nombre} · ${detallePremio(p)}`;

function dibujarParticipantes(canvas, r, op){
  const cuadrado = op.tamano === 'cuadrado';
  const W = 1080, H = cuadrado ? 1080 : 1920;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const T = TEMAS[op.tema] || TEMAS.dorado;
  const { premio, total, paginas } = paginasParticipantes(r, op);
  const pag = Math.min(Math.max(0, op.pagina || 0), paginas.length - 1);
  const lista = paginas[pag];

  // Fondo
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, T.a); g.addColorStop(1, T.b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath(); ctx.arc(W - 80, 120, cuadrado ? 180 : 260, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(60, H - 120, cuadrado ? 200 : 320, 0, Math.PI*2); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  // Encabezado
  let y = cuadrado ? 64 : 110;
  ctx.fillStyle = T.acento; ctx.font = f(700, cuadrado ? 28 : 40); ctx.fillText('🎟️  G R A N   R I F A', W/2, y);
  ctx.fillStyle = T.texto; ctx.font = f(800, cuadrado ? 54 : 80);
  y += cuadrado ? 66 : 100;
  for(const l of partirTexto(ctx, r.nombre, W - 120, cuadrado ? 1 : 2)){ ctx.fillText(l, W/2, y); y += cuadrado ? 0 : 88; }
  if(cuadrado) y += 56; else y += 4;
  ctx.font = f(700, cuadrado ? 34 : 46);
  ctx.fillText(partirTexto(ctx, tituloLista(r, premio, total), W - 120, 1)[0], W/2, y);
  if(premio){
    y += cuadrado ? 36 : 48; ctx.globalAlpha = 0.85; ctx.font = f(500, cuadrado ? 24 : 32);
    ctx.fillText(partirTexto(ctx, lineaPremio(premio), W - 120, 1)[0], W/2, y); ctx.globalAlpha = 1;
  }

  // Pie: leyenda, fecha, responsable y página
  const resp = String(r.responsable || '').trim().split(/\r?\n/)[0];
  const lineasPie = [
    op.conEstado ? '✅ pagado   ⏳ abonando' : '',
    'Actualizado: ' + fechaCorta() + (paginas.length > 1 ? `   ·   Página ${pag + 1}/${paginas.length}` : ''),
    resp ? '👤 Responsable: ' + resp : ''
  ].filter(Boolean);
  const paso = cuadrado ? 34 : 46, tamPie = cuadrado ? 24 : 32;
  const hPie = 30 + lineasPie.length * paso;
  const yPie = H - (cuadrado ? 30 : 50) - hPie;
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; rectRedondo(ctx, 50, yPie, W - 100, hPie, 26); ctx.fill();
  ctx.fillStyle = T.texto; ctx.font = f(600, tamPie);
  lineasPie.forEach((l, i) => ctx.fillText(partirTexto(ctx, l, W - 160, 1)[0], W/2, yPie + 20 + tamPie + i * paso));

  // Lista en columnas
  const top = y + (cuadrado ? 30 : 46), abajo = yPie - (cuadrado ? 20 : 30);
  if(!lista.length){
    ctx.font = f(600, cuadrado ? 34 : 44); ctx.fillText(premio ? 'Todavía nadie juega este premio.' : 'Todavía no hay números vendidos.', W/2, (top + abajo) / 2);
    return { paginas: paginas.length, pagina: pag, total };
  }
  const cols = lista.length > (cuadrado ? 8 : 13) ? 2 : 1;
  const filas = Math.ceil(lista.length / cols);
  const alto = Math.min(cuadrado ? 64 : 80, (abajo - top) / Math.max(filas, 1));
  const margen = 50, gap = 24, anchoCol = (W - margen*2 - gap*(cols - 1)) / cols;
  const tam = Math.max(16, Math.min(cuadrado ? 30 : 40, alto * 0.56));
  const ancho = Math.max(2, String(r.inicio + r.cantidad - 1).length);
  lista.forEach((p, i) => {
    const c = Math.floor(i / filas), fila = i % filas;
    const x = margen + c * (anchoCol + gap), yy = top + fila * alto;
    ctx.fillStyle = 'rgba(255,255,255,' + (fila % 2 ? '0.05' : '0.10') + ')';
    rectRedondo(ctx, x, yy + 2, anchoCol, alto - 4, 12); ctx.fill();
    // Número en una pastilla del color del tema
    const wNum = tam * 2.1;
    ctx.fillStyle = T.acento; rectRedondo(ctx, x + 8, yy + 6, wNum, alto - 12, 10); ctx.fill();
    ctx.fillStyle = '#1f1300'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = f(800, tam);
    ctx.fillText(String(p.num).padStart(ancho, '0'), x + 8 + wNum/2, yy + alto/2 + 1);
    // Nombre (y estado)
    ctx.textAlign = 'left'; ctx.fillStyle = T.texto; ctx.font = f(600, tam);
    const est = op.conEstado ? ' ' + marcaEstado(p.estado) : '';
    const libre = anchoCol - wNum - 34 - (est ? tam * 1.4 : 0);
    ctx.fillText(partirTexto(ctx, p.nombre, libre, 1)[0] || '', x + wNum + 22, yy + alto/2 + 1);
    if(est){ ctx.textAlign = 'right'; ctx.fillText(marcaEstado(p.estado), x + anchoCol - 12, yy + alto/2 + 1); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  });
  return { paginas: paginas.length, pagina: pag, total };
}

// La misma lista en texto para pegar en WhatsApp (todas las páginas juntas).
function textoParticipantes(r, op){
  const { premio, lista } = participantes(r, op);
  const ancho = Math.max(2, String(r.inicio + r.cantidad - 1).length);
  let t = `🎟️ ${r.nombre}\n${tituloLista(r, premio, lista.length)}\n`;
  if(premio) t += `${lineaPremio(premio)}\n`;
  t += '\n' + (lista.length ? lista.map(p => `${String(p.num).padStart(ancho, '0')} - ${p.nombre}${op.conEstado ? ' ' + marcaEstado(p.estado) : ''}`).join('\n') : 'Todavía no hay participantes.');
  if(op.conEstado && lista.length) t += '\n\n✅ pagado · ⏳ abonando';
  t += `\n\nActualizado: ${fechaCorta()}`;
  const resp = String(r.responsable || '').trim();
  if(resp) t += `\n👤 Responsable: ${resp.replace(/\r?\n/g, ' · ')}`;
  return t;
}
