// Puente seguro entre la página y Electron: solo expone lo necesario.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rifasNativo', {
  guardarArchivo: (nombre, contenido) => ipcRenderer.invoke('guardar-archivo', nombre, contenido),
  guardarImagen: (nombre, bytes) => ipcRenderer.invoke('guardar-imagen', nombre, bytes),
  guardarImagenes: (lista) => ipcRenderer.invoke('guardar-imagenes', lista),
  copiarImagen: (bytes) => ipcRenderer.invoke('copiar-imagen', bytes),
  respaldoAuto: (contenido) => ipcRenderer.invoke('respaldo-auto', contenido),
  abrirRespaldos: () => ipcRenderer.invoke('abrir-respaldos'),
  buscarActualizacion: () => ipcRenderer.invoke('buscar-actualizacion'),
  instalarActualizacion: () => ipcRenderer.invoke('instalar-actualizacion')
});
