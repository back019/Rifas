// Proceso principal de Electron: crea la ventana y maneja guardar archivos y abrir enlaces.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs/promises');

function crearVentana() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 380, minHeight: 600,
    title: 'Rifas — Control',
    backgroundColor: '#f4f5f7',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Los enlaces (WhatsApp, etc.) se abren en el navegador normal, no dentro de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); }
  });
}

// Guardar un archivo (CSV o respaldo) con la ventana de "Guardar como".
ipcMain.handle('guardar-archivo', async (ev, nombre, contenido) => {
  const win = BrowserWindow.fromWebContents(ev.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), String(nombre).replace(/[\\/:*?"<>|]/g, '-'))
  });
  if (canceled || !filePath) return false;
  await fs.writeFile(filePath, String(contenido), 'utf8');
  return true;
});

// Guardar la imagen para estados (PNG).
ipcMain.handle('guardar-imagen', async (ev, nombre, bytes) => {
  const win = BrowserWindow.fromWebContents(ev.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('pictures'), String(nombre).replace(/[\\/:*?"<>|]/g, '-')),
    filters: [{ name: 'Imagen PNG', extensions: ['png'] }]
  });
  if (canceled || !filePath) return false;
  await fs.writeFile(filePath, Buffer.from(bytes));
  return true;
});

// Copiar la imagen al portapapeles (para pegarla en WhatsApp Web con Ctrl+V).
ipcMain.handle('copiar-imagen', async (ev, bytes) => {
  clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(bytes)));
  return true;
});

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  crearVentana();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) crearVentana(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
