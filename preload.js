// Puente seguro entre la página y Electron: solo expone lo necesario.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rifasNativo', {
  guardarArchivo: (nombre, contenido) => ipcRenderer.invoke('guardar-archivo', nombre, contenido)
});
