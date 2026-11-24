// Arranque de la versión local (Electron, o PWA en el teléfono): abre PouchDB y le pasa la base a la app.
(async () => {
  try {
    const db = await RifasDB.abrir();
    const descargas = window.rifasNativo
      ? { save: o => window.rifasNativo.guardarArchivo(o.filename, o.data) }
      : { save: async o => descargarEnNavegador(o.filename, o.data) };
    iniciarApp(db, descargas, { exportar: RifasDB.exportar, importar: RifasDB.importar, auto: respaldoAutomatico() }, RifasDB.sync);
  } catch (e) {
    console.error(e);
    S.aviso = 'No se pudo abrir la base de datos local: ' + (e.message || e);
    iniciarApp(null);
  }
  // En la PC: busca una versión nueva del programa al abrir y cada 3 horas (ver revisarActualizacion en app.js).
  if (window.rifasNativo && window.rifasNativo.buscarActualizacion) {
    setTimeout(() => revisarActualizacion(false), 3000);
    setInterval(() => revisarActualizacion(false), 3 * 3600 * 1000);
  }
  // En el teléfono (servida por https) se registra el service worker para que abra sin internet.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const habiaControl = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
      // Busca actualizaciones al abrir y cada vez que la app vuelve a primer plano.
      const buscar = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar(); });
      buscar();
    }).catch(e => console.warn('Service worker:', e));
    // Cuando se instala una versión nueva, recarga una vez para usarla.
    let recargado = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!habiaControl || recargado) return;
      recargado = true;
      if (!document.querySelector('#modal:not([hidden])')) location.reload();
      else toast('Hay una versión nueva. Cierra y abre la app para usarla.');
    });
  }
})();

// Respaldo automático (solo en la PC): al abrir y cada 30 minutos, si hubo cambios, guarda
// el respaldo del día en Documentos\Rifas - respaldos (main.js deja los últimos 14 días).
function respaldoAutomatico() {
  const nat = window.rifasNativo;
  if (!nat || !nat.respaldoAuto) return null;
  const leer = () => { try { return JSON.parse(localStorage.getItem('respaldoAuto') || 'null'); } catch (e) { return null; } };
  let ultimo = leer(), cambios = true, enCurso = null;
  RifasDB.pouch().changes({ since: 'now', live: true }).on('change', () => { cambios = true; });
  async function hacer() {
    if (!cambios) return ultimo;
    if (enCurso) return enCurso;
    cambios = false;
    enCurso = (async () => {
      try {
        ultimo = await nat.respaldoAuto(JSON.stringify(await RifasDB.exportar()));
        try { localStorage.setItem('respaldoAuto', JSON.stringify(ultimo)); } catch (e) {}
      } catch (e) { cambios = true; console.warn('Respaldo automático:', e); throw e; }
      finally { enCurso = null; }
      return ultimo;
    })();
    return enCurso;
  }
  setTimeout(() => hacer().catch(() => {}), 15000);
  setInterval(() => hacer().catch(() => {}), 30 * 60 * 1000);
  return { ultimo: () => ultimo, ahora: () => { cambios = true; return hacer(); }, abrirCarpeta: () => nat.abrirRespaldos() };
}

// Descarga normal del navegador (en iPhone abre la hoja para guardar o compartir el archivo).
function descargarEnNavegador(nombre, contenido) {
  const tipo = nombre.endsWith('.csv') ? 'text/csv' : 'application/json';
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo + ';charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
