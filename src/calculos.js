// ================= Cálculos de la app =================
// Funciones puras (sin pantalla ni base de datos): abonos, porcentajes, quién participa,
// estadísticas, reparto de abonos y ganancia. Se cargan antes que app.js y se prueban con Node
// (ver pruebas/).
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const EPS = 0.005;

function telWa(t){
  let d = String(t||'').replace(/\D/g,'');
  if(!d) return '';
  if(d.startsWith('0')) d = '58' + d.slice(1);
  else if(d.length === 10 && d.startsWith('4')) d = '58' + d;
  return d;
}

function normRifa(r){
  const o = { ...r };
  o.cantidad = Number(o.cantidad)||100; o.inicio = Number(o.inicio)||0; o.precio = Number(o.precio)||0; o.moneda = o.moneda || '$';
  if(!Array.isArray(o.premios)){
    o.premios = [{ id:'p1', nombre: o.premio || 'Premio mayor', requisito:100, fecha:o.fecha||'', loteria:o.loteria||'', ganador: o.ganador ? { ...o.ganador, juega:true } : null }];
  }
  o.premios = o.premios.map(p => ({ ...p, requisito: Number(p.requisito)||0 }));
  o.costos = Array.isArray(o.costos) ? o.costos : [];
  return o;
}
function totalCostos(r){ return (r.costos||[]).reduce((s,c) => s + (Number(c.equiv)||0), 0); }
// Ganancia: lo cobrado (o lo que se cobraría vendiendo todo) menos premios y gastos.
function ganancia(r, s){
  const costos = totalCostos(r);
  return { costos, actual: s.cobrado - costos, potencial: s.potencial - costos, equilibrio: r.precio > 0 && costos > EPS ? Math.ceil((costos - EPS) / r.precio) : 0 };
}
function premiosOrden(r){
  return [...r.premios].sort((a,b) => (a.fecha||'9999').localeCompare(b.fecha||'9999') || a.requisito - b.requisito);
}
// El premio principal: el que se llama "mayor"; si ninguno, el que pide más % para jugar y,
// a igual %, el de fecha más tardía (un premio sin fecha no le gana a uno con fecha).
function premioMayor(r){
  const ps = (r && r.premios) || [];
  if(!ps.length) return null;
  const porNombre = ps.filter(p => /\bmayor\b/i.test(String(p.nombre || '')));
  const cand = porNombre.length ? porNombre : ps;
  return cand.reduce((m, p) => {
    if(!m) return p;
    const rq = (Number(p.requisito)||0) - (Number(m.requisito)||0);
    if(rq) return rq > 0 ? p : m;
    return String(p.fecha || '') > String(m.fecha || '') ? p : m;
  }, null);
}
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
function juega(p, inf){ return !!inf && inf.pct + 1e-9 >= p.requisito; }
function tieneChoque(d){ return !!d && Array.isArray(d.choques) && d.choques.length > 0; }

function calcStats(r, lista){
  let pag=0, apa=0, cobrado=0;
  for(const d of lista){ if(d.estado==='pagado') pag++; else apa++; cobrado += Math.min(d.abonado, r.precio); }
  const vendidos = pag + apa;
  return { total:r.cantidad, pag, apa, libres:r.cantidad-vendidos, cobrado, porCobrar: vendidos*r.precio - cobrado, potencial: r.cantidad*r.precio };
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

// Agrupa los números vendidos por comprador (mismo teléfono, o mismo nombre si no tiene).
function agruparCompradores(r, lista){
  const map = new Map();
  for(const d of lista){
    const key = telWa(d.telefono) || String(d.nombre).trim().toLowerCase();
    if(!map.has(key)) map.set(key, { nombre:d.nombre, telefono:d.telefono, nums:[] });
    map.get(key).nums.push(d);
  }
  return [...map.values()].map(c => {
    const pagado = c.nums.reduce((s,d)=>s+Math.min(d.abonado, r.precio),0);
    return { ...c, total: c.nums.length*r.precio, pagado, debe: c.nums.length*r.precio - pagado };
  }).sort((a,b)=> b.debe - a.debe || String(a.nombre).localeCompare(String(b.nombre)));
}

if(typeof module === 'object' && module.exports) module.exports = { uid, EPS, telWa, normRifa, totalCostos, ganancia, premiosOrden, premioMayor, proximoPremio, info, juega, tieneChoque, calcStats, repartir, agruparCompradores };
