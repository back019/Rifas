// Proceso principal de Electron: crea la ventana y maneja guardar archivos y abrir enlaces.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, clipboard, nativeImage, net } = require('electron');
const path = require('path');
const fs = require('fs/promises');

function crearVentana() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 380, minHeight: 600,
    title: 'Rifas — Control',
    icon: path.join(__dirname, 'src', 'iconos', 'icono-512.png'),
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

// Respaldo automático: un archivo por día en Documentos\Rifas - respaldos; se guardan los últimos 14 días.
const RESPALDOS_DIAS = 14;
const carpetaRespaldos = () => path.join(app.getPath('documents'), 'Rifas - respaldos');
ipcMain.handle('respaldo-auto', async (ev, contenido) => {
  const dir = carpetaRespaldos();
  await fs.mkdir(dir, { recursive: true });
  const hoy = new Date();
  const f = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const archivo = path.join(dir, `respaldo-rifas-${f}.json`);
  // Se escribe primero a un archivo temporal para no dejar un respaldo a medias si se apaga la PC.
  await fs.writeFile(archivo + '.tmp', String(contenido), 'utf8');
  await fs.rename(archivo + '.tmp', archivo);
  const viejos = (await fs.readdir(dir)).filter(n => /^respaldo-rifas-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse().slice(RESPALDOS_DIAS);
  for (const n of viejos) await fs.unlink(path.join(dir, n)).catch(() => {});
  return { archivo, fecha: new Date().toISOString() };
});
ipcMain.handle('abrir-respaldos', async () => {
  await fs.mkdir(carpetaRespaldos(), { recursive: true });
  return shell.openPath(carpetaRespaldos());
});

// Aviso de versión nueva: compara la versión instalada con version.json publicado en GitHub Pages.
const URL_VERSION = 'https://back019.github.io/Rifas/version.json';
function compararVersiones(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0), pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1; }
  return 0;
}
ipcMain.handle('buscar-actualizacion', async () => {
  const actual = app.getVersion();
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await net.fetch(URL_VERSION + '?t=' + Date.now(), { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!r.ok) return { actual, hay: false };
    const v = await r.json();
    const descarga = /^https:\/\//.test(v.descarga || '') ? v.descarga : 'https://github.com/back019/Rifas/releases/latest';
    return { actual, hay: compararVersiones(v.version, actual) > 0, version: String(v.version || ''), notas: Array.isArray(v.notas) ? v.notas.map(String) : [], descarga };
  } catch (e) { return { actual, hay: false }; }
});

// Copiar la imagen al portapapeles (para pegarla en WhatsApp Web con Ctrl+V).
ipcMain.handle('copiar-imagen', async (ev, bytes) => {
  clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(bytes)));
  return true;
});

// Siempre la misma carpeta de datos (la que usaba iniciar.bat), así el programa instalado ve las mismas rifas.
// (RIFAS_DATOS permite usar otra carpeta para probar sin tocar las rifas reales.)
app.setPath('userData', process.env.RIFAS_DATOS || path.join(app.getPath('appData'), 'app-rifas'));
// Una sola ventana: si ya está abierta, se trae al frente.
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  crearVentana();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) crearVentana(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
