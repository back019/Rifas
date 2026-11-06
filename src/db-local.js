// Base de datos local con PouchDB.
// Imita la forma de uso de la app (collection / doc / onSnapshot / get / set / update / delete)
// para que el resto del código no cambie. Cada documento se guarda con su ruta como _id,
// por ejemplo "rifas/abc123" o "rifas/abc123/numeros/7".
// Más adelante se puede sincronizar con un servidor CouchDB con db.sync(url).
(function () {
  const NOMBRE_DB = 'rifas';
  let db = null;
  const oyentes = new Set();

  const limpiar = d => { const o = { ...d }; delete o._id; delete o._rev; return o; };
  const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const error = (code, e) => ({ code, message: (e && (e.message || e.reason)) || String(e) });
  const meta = { fromCache: false, hasPendingWrites: false };

  function snapDoc(id, d) {
    return { id: id.split('/').pop(), exists: !!d, data: () => (d ? limpiar(d) : undefined), metadata: meta };
  }

  async function leerColeccion(ruta, limite) {
    const pre = ruta + '/';
    const r = await db.allDocs({ include_docs: true, startkey: pre, endkey: pre + '￰' });
    let docs = r.rows.filter(x => !x.id.slice(pre.length).includes('/')).map(x => snapDoc(x.id, x.doc));
    if (limite) docs = docs.slice(0, limite);
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta };
  }

  function escuchar(coincide, ejecutar) {
    let t = null, activo = true;
    const o = { coincide, aviso: () => { clearTimeout(t); t = setTimeout(() => activo && ejecutar(), 40); } };
    oyentes.add(o);
    setTimeout(() => activo && ejecutar(), 0);
    return () => { activo = false; oyentes.delete(o); };
  }

  async function obtener(id) {
    try { return await db.get(id); } catch (e) { if (e.status === 404) return null; throw error('unavailable', e); }
  }
  async function guardar(id, datos) {
    for (let i = 0; i < 3; i++) {
      const prev = await obtener(id);
      try { await db.put({ ...datos, _id: id, ...(prev ? { _rev: prev._rev } : {}) }); return; }
      catch (e) { if (e.status !== 409) throw error('unavailable', e); }
    }
    throw error('unavailable', 'Conflicto al guardar, intenta de nuevo');
  }

  function docRef(ruta) {
    return {
      id: ruta.split('/').pop(), path: ruta,
      get: async () => snapDoc(ruta, await obtener(ruta)),
      set: async datos => guardar(ruta, datos),
      update: async datos => {
        const prev = await obtener(ruta);
        if (!prev) throw error('invalid_argument', 'El documento no existe');
        await guardar(ruta, { ...limpiar(prev), ...datos });
      },
      delete: async () => {
        const prev = await obtener(ruta);
        if (prev) { try { await db.remove(prev); } catch (e) { if (e.status !== 404) throw error('unavailable', e); } }
      },
      // En local solo hay un usuario, así que el "bloqueo" siempre se concede.
      acquire: async () => ({ acquired: true }),
      onSnapshot(sig, err) {
        return escuchar(id => id === ruta, async () => { try { sig(snapDoc(ruta, await obtener(ruta))); } catch (e) { err && err(e); } });
      },
      collection: sub => colRef(ruta + '/' + sub)
    };
  }

  function colRef(ruta, limite) {
    const pre = ruta + '/';
    return {
      path: ruta,
      doc: id => docRef(pre + (id || nuevoId())),
      limit: n => colRef(ruta, n),
      where() { return this; }, orderBy() { return this; },
      get: () => leerColeccion(ruta, limite),
      add: async datos => { const r = docRef(pre + nuevoId()); await r.set(datos); return r; },
      onSnapshot(sig, err) {
        return escuchar(id => id.startsWith(pre) && !id.slice(pre.length).includes('/'),
          async () => { try { sig(await leerColeccion(ruta, limite)); } catch (e) { err && err(e); } });
      }
    };
  }

  async function abrir() {
    if (db) return api;
    db = new PouchDB(NOMBRE_DB, { auto_compaction: true });
    await db.info();
    db.changes({ since: 'now', live: true }).on('change', c => {
      for (const o of oyentes) if (o.coincide(c.id)) o.aviso();
    });
    const cfg = await leerCfg();
    if (cfg && cfg.url) arrancar(cfg);
    return api;
  }

  async function exportar() {
    const r = await db.allDocs({ include_docs: true });
    return { app: 'rifas', version: 1, fecha: new Date().toISOString(), docs: r.rows.map(x => ({ _id: x.id, ...limpiar(x.doc) })) };
  }

  async function importar(respaldo) {
    if (!respaldo || respaldo.app !== 'rifas' || !Array.isArray(respaldo.docs)) throw new Error('Respaldo no válido');
    const ids = respaldo.docs.map(d => d._id).filter(id => typeof id === 'string' && (id.startsWith('rifas/') || id.startsWith('config/')));
    const act = await db.allDocs({ keys: ids });
    const revs = {}; act.rows.forEach(x => { if (x.value && !x.value.deleted) revs[x.id] = x.value.rev; });
    const docs = respaldo.docs.filter(d => ids.includes(d._id)).map(d => ({ ...d, ...(revs[d._id] ? { _rev: revs[d._id] } : {}) }));
    await db.bulkDocs(docs);
    return docs.length;
  }

  // ---------- sincronización con CouchDB / Cloudant ----------
  // La configuración se guarda en un documento _local (no se copia al servidor).
  let manejador = null;
  const est = { estado: 'apagado', detalle: '', ultimo: null, cfg: null };
  const oyentesSync = new Set();
  const avisar = () => oyentesSync.forEach(f => { try { f({ ...est }); } catch (e) {} });
  const poner = (estado, detalle = '') => { est.estado = estado; est.detalle = detalle; if (estado === 'al-dia') est.ultimo = new Date().toISOString(); avisar(); };

  async function leerCfg() { try { return (await db.get('_local/sync')).cfg || null; } catch (e) { return null; } }
  async function guardarCfg(cfg) {
    let rev; try { rev = (await db.get('_local/sync'))._rev; } catch (e) {}
    await db.put({ _id: '_local/sync', ...(rev ? { _rev: rev } : {}), cfg });
  }
  function remota(cfg) {
    const url = String(cfg.url).trim().replace(/\/+$/, '') + '/' + encodeURIComponent(cfg.base || 'rifas');
    return new PouchDB(url, cfg.usuario ? { auth: { username: cfg.usuario, password: cfg.clave } } : {});
  }
  function detener() { if (manejador) { manejador.cancel(); manejador = null; } }
  function arrancar(cfg) {
    detener();
    est.cfg = { url: cfg.url, base: cfg.base, usuario: cfg.usuario };
    poner('sincronizando');
    manejador = db.sync(remota(cfg), { live: true, retry: true })
      .on('change', () => { est.ultimo = new Date().toISOString(); avisar(); })
      .on('active', () => poner('sincronizando'))
      .on('paused', err => poner(err ? 'sin-conexion' : 'al-dia', err ? 'Sin conexión, se reintenta solo' : ''))
      .on('denied', err => poner('error', 'El servidor no dejó guardar: ' + ((err && (err.reason || err.message)) || '')))
      .on('error', err => poner('error', (err && (err.reason || err.message)) || 'Error de sincronización'));
  }
  const sync = {
    estado: () => ({ ...est }),
    alCambiar: f => { oyentesSync.add(f); return () => oyentesSync.delete(f); },
    // Prueba la conexión; si funciona guarda la configuración y empieza a sincronizar.
    async configurar(cfg) {
      const r = remota(cfg);
      try { await r.info(); }
      catch (e) {
        const st = e && e.status;
        if (st === 401 || st === 403) throw new Error('Usuario o clave incorrectos, o sin permiso sobre la base.');
        if (st === 404) throw new Error('No existe la base "' + (cfg.base || 'rifas') + '" en el servidor. Créala primero.');
        throw new Error('No se pudo conectar. Revisa la dirección, que la PC con CouchDB esté prendida y que Tailscale esté conectado en este equipo.');
      }
      await guardarCfg(cfg);
      arrancar(cfg);
    },
    async desactivar() { detener(); await guardarCfg(null); est.cfg = null; est.ultimo = null; poner('apagado'); }
  };

  const api = { doc: docRef, collection: p => colRef(p) };
  window.RifasDB = { abrir, exportar, importar, sync, pouch: () => db };
})();
