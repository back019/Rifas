// Puente seguro entre la página y Electron: solo expone lo necesario.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rifasNativo', {
  guardarArchivo: (nombre, contenido) => ipcRenderer.invoke('guardar-archivo', nombre, contenido),
  guardarImagen: (nombre, bytes) => ipcRenderer.invoke('guardar-imagen', nombre, bytes),
  copiarImagen: (bytes) => ipcRenderer.invoke('copiar-imagen', bytes)
});
