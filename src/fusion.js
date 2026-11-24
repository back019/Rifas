// Unir versiones en choque de un mismo registro.
// Cuando la PC y el teléfono cambian el mismo número sin conexión, al sincronizar quedan
// dos versiones. Aquí se unen sin perder nada:
//  - Si las dos versiones son del mismo comprador, se juntan todos los abonos.
//  - Si son de compradores distintos (número vendido dos veces), se guarda la otra venta
//    en "choques" para que el usuario decida.
// Son funciones puras (sin base de datos) para poder probarlas con Node.
(function (raiz) {
  const soloDigitos = t => String(t || '').replace(/\D/g, '');
  function telNorm(t) {
    let d = soloDigitos(t);
    if (!d) return '';
    if (d.startsWith('0')) d = '58' + d.slice(1);
    else if (d.length === 10 && d.startsWith('4')) d = '58' + d;
    return d;
  }
  const nombreNorm = n => String(n || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

  // Dos ventas son del mismo comprador si coincide el nombre o el teléfono.
  function mismoComprador(a, b) {
    const na = nombreNorm(a.nombre), nb = nombreNorm(b.nombre);
    if (na && na === nb) return true;
    const ta = telNorm(a.telefono), tb = telNorm(b.telefono);
    return !!ta && ta === tb;
  }

  function unirAbonos(listas, borrados) {
    const vistos = new Map();
    for (const l of listas) for (const a of (l || [])) if (a && a.id && !borrados.has(a.id) && !vistos.has(a.id)) vistos.set(a.id, a);
    return [...vistos.values()].sort((x, y) => String(x.fecha || '').localeCompare(String(y.fecha || '')) || String(x.id).localeCompare(String(y.id)));
  }

  const venta = v => ({ nombre: v.nombre || '', telefono: v.telefono || '', nota: v.nota || '', abonos: v.abonos || [], actualizado: v.actualizado || '' });

  // versiones[0] es la versión ganadora (la que muestra la base); el resto son las que chocaron.
  function fusionarNumero(versiones) {
    const vs = versiones.filter(Boolean);
    const ganadora = vs[0];
    const borrados = new Set();
    for (const v of vs) for (const id of (v.abonosBorrados || [])) borrados.add(id);

    const iguales = vs.filter(v => mismoComprador(v, ganadora));
    const distintas = vs.filter(v => !mismoComprador(v, ganadora));
    // Los datos (nombre, teléfono, nota) se toman de la versión más reciente del mismo comprador.
    const reciente = [...iguales].sort((a, b) => String(b.actualizado || '').localeCompare(String(a.actualizado || '')))[0] || ganadora;

    // Choques: los que ya había más las ventas a otros compradores, agrupadas por comprador.
    const choques = [];
    const candidatos = [];
    for (const v of vs) for (const c of (v.choques || [])) candidatos.push(c);
    for (const v of distintas) candidatos.push(venta(v));
    for (const c of candidatos) {
      if (mismoComprador(c, ganadora)) continue; // ya es el comprador actual
      const prev = choques.find(x => mismoComprador(x, c));
      if (prev) {
        prev.abonos = unirAbonos([prev.abonos, c.abonos], borrados);
        if (String(c.actualizado || '') > String(prev.actualizado || '')) Object.assign(prev, { nombre: c.nombre, telefono: c.telefono, nota: c.nota, actualizado: c.actualizado });
      } else choques.push({ ...venta(c), abonos: unirAbonos([c.abonos], borrados) });
    }
    // Choques que el usuario ya resolvió en algún equipo no vuelven a aparecer.
    const resueltos = new Set();
    for (const v of vs) for (const k of (v.choquesResueltos || [])) resueltos.add(k);
    const choquesFinal = choques.filter(c => !resueltos.has(claveVenta(c))).sort((a, b) => claveVenta(a).localeCompare(claveVenta(b)));

    // Si la versión más reciente no tiene teléfono, se conserva el de otra versión.
    const telefono = reciente.telefono || (iguales.find(v => v.telefono) || {}).telefono || '';
    const doc = { ...ganadora, nombre: reciente.nombre, telefono, nota: reciente.nota, actualizado: reciente.actualizado };
    doc.abonos = unirAbonos(iguales.map(v => v.abonos), borrados);
    if (borrados.size) doc.abonosBorrados = [...borrados].sort(); else delete doc.abonosBorrados;
    if (choquesFinal.length) doc.choques = choquesFinal; else delete doc.choques;
    if (resueltos.size) doc.choquesResueltos = [...resueltos].sort(); else delete doc.choquesResueltos;
    return doc;
  }

  // Identificador estable de una venta: comprador + sus abonos.
  function claveVenta(c) {
    return nombreNorm(c.nombre) + '|' + telNorm(c.telefono) + '|' + (c.abonos || []).map(a => a.id).sort().join(',');
  }

  // Rifa: se toma la ganadora, pero si otra versión tiene el resultado de un premio que la ganadora no tiene, se conserva.
  function fusionarRifa(versiones) {
    const vs = versiones.filter(Boolean);
    const doc = { ...vs[0] };
    if (Array.isArray(doc.premios)) doc.premios = doc.premios.map(p => {
      if (p.ganador) return p;
      for (const v of vs.slice(1)) {
        const o = (v.premios || []).find(x => x.id === p.id);
        if (o && o.ganador) return { ...p, ganador: o.ganador };
      }
      return p;
    });
    if (doc.premios && doc.premios.length) doc.estado = doc.premios.every(p => p.ganador) ? 'finalizada' : 'activa';
    // Costos: se juntan los de todas las versiones, menos los borrados.
    const borrados = new Set(); for (const v of vs) for (const id of (v.costosBorrados || [])) borrados.add(id);
    const costos = new Map(); for (const v of vs) for (const c of (v.costos || [])) if (c && c.id && !borrados.has(c.id) && !costos.has(c.id)) costos.set(c.id, c);
    if (costos.size || doc.costos) doc.costos = [...costos.values()].sort((x, y) => String(x.fecha || '').localeCompare(String(y.fecha || '')));
    if (borrados.size) doc.costosBorrados = [...borrados].sort();
    return doc;
  }

  // Compara el contenido sin los campos internos de la base.
  function profundo(d) {
    const limpiar = x => {
      if (Array.isArray(x)) return x.map(limpiar);
      if (x && typeof x === 'object') { const o = {}; for (const k of Object.keys(x).sort()) if (!['_id', '_rev', '_conflicts', '_revisions'].includes(k) && x[k] !== undefined) o[k] = limpiar(x[k]); return o; }
      return x;
    };
    return JSON.stringify(limpiar(d));
  }

  const esNumero = id => /^rifas\/[^/]+\/numeros\/[^/]+$/.test(id);
  const esRifa = id => /^rifas\/[^/]+$/.test(id);

  // Devuelve el documento unido para cualquier registro con choque.
  function fusionar(id, versiones) {
    if (esNumero(id)) return fusionarNumero(versiones);
    if (esRifa(id)) return fusionarRifa(versiones);
    return { ...versiones[0] };
  }

  const api = { fusionar, fusionarNumero, fusionarRifa, mismoComprador, claveVenta, igual: (a, b) => profundo(a) === profundo(b), esNumero };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.RifasFusion = api;
})(typeof self !== 'undefined' ? self : this);
