// Arranque de la versión local (Electron, o PWA en el teléfono): abre PouchDB y le pasa la base a la app.
(async () => {
  try {
    const db = await RifasDB.abrir();
    const descargas = window.rifasNativo
      ? { save: o => window.rifasNativo.guardarArchivo(o.filename, o.data) }
      : { save: async o => descargarEnNavegador(o.filename, o.data) };
    iniciarApp(db, descargas, { exportar: RifasDB.exportar, importar: RifasDB.importar }, RifasDB.sync);
  } catch (e) {
    console.error(e);
    S.aviso = 'No se pudo abrir la base de datos local: ' + (e.message || e);
    iniciarApp(null);
  }
  // En el teléfono (servida por https) se registra el service worker para que abra sin internet.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker:', e));
  }
})();

// Descarga normal del navegador (en iPhone abre la hoja para guardar o compartir el archivo).
function descargarEnNavegador(nombre, contenido) {
  const tipo = nombre.endsWith('.csv') ? 'text/csv' : 'application/json';
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo + ';charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
