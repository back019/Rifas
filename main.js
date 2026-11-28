// Proceso principal de Electron: crea la ventana y maneja guardar archivos y abrir enlaces.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, clipboard, nativeImage, net, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const { spawn } = require('child_process');

// Barra de título integrada: sin la barra gris de Windows; los botones de minimizar, maximizar y cerrar
// se dibujan sobre el encabezado de la app, con sus mismos colores (claro u oscuro según Windows).
const ALTO_BARRA = 59; // el encabezado mide 60: así se ve su línea inferior también bajo los botones
const coloresBarra = () => nativeTheme.shouldUseDarkColors
  ? { color: '#111318', symbolColor: '#e8eaef', height: ALTO_BARRA }
  : { color: '#f4f5f7', symbolColor: '#1b1d22', height: ALTO_BARRA };
nativeTheme.on('updated', () => {
  for (const w of BrowserWindow.getAllWindows()) { try { w.setTitleBarOverlay(coloresBarra()); w.setBackgroundColor(coloresBarra().color); } catch (e) {} }
});

function crearVentana() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 380, minHeight: 600,
    title: 'Rifas',
    icon: path.join(__dirname, 'src', 'iconos', 'icono-512.png'),
    backgroundColor: coloresBarra().color,
    titleBarStyle: 'hidden',
    titleBarOverlay: coloresBarra(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  // El nombre de la ventana (barra de tareas) queda solo "Rifas".
  win.on('page-title-updated', e => e.preventDefault());

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
// Actualización desde carpeta local: el instalador guarda en carpeta-instalador.txt (junto a Rifas.exe)
// la carpeta desde donde se ejecutó. Ahí se busca un Instalar-Rifas-X.Y.Z.exe más nuevo.
function carpetaInstalador() {
  if (!app.isPackaged) return path.join(__dirname, 'dist');
  try {
    const b = fsSync.readFileSync(path.join(path.dirname(process.execPath), 'carpeta-instalador.txt'));
    const t = (b[0] === 0xFF && b[1] === 0xFE) ? b.slice(2).toString('utf16le') : b.toString('utf8'); // NSIS lo escribe en UTF-16LE con BOM
    return t.replace(/^﻿/, '').replace(/\0/g, '').trim() || null;
  } catch (e) { return null; }
}
function buscarLocal() {
  const dir = carpetaInstalador();
  if (!dir) return null;
  let archivos; try { archivos = fsSync.readdirSync(dir); } catch (e) { return null; }
  let mejor = null;
  for (const f of archivos) {
    const m = f.match(/^Instalar-Rifas-(\d+\.\d+\.\d+)\.exe$/i);
    if (m && compararVersiones(m[1], app.getVersion()) > 0 && (!mejor || compararVersiones(m[1], mejor.version) > 0))
      mejor = { version: m[1], archivo: path.join(dir, f) };
  }
  if (mejor) { try { mejor.novedades = fsSync.readFileSync(path.join(dir, `Novedades ${mejor.version}.txt`), 'utf8').replace(/^﻿/, ''); } catch (e) { mejor.novedades = ''; } }
  return mejor;
}
// Respaldo: si no hay nada en la carpeta local, version.json en GitHub Pages (para otras PCs).
async function buscarWeb(actual) {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await net.fetch(URL_VERSION + '?t=' + Date.now(), { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!r.ok) return null;
    const v = await r.json();
    if (compararVersiones(v.version, actual) <= 0) return null;
    const descarga = /^https:\/\//.test(v.descarga || '') ? v.descarga : 'https://github.com/back019/Rifas/releases/latest';
    return { version: String(v.version || ''), notas: Array.isArray(v.notas) ? v.notas.map(String) : [], descarga };
  } catch (e) { return null; }
}
ipcMain.handle('buscar-actualizacion', async () => {
  const actual = app.getVersion();
  const local = buscarLocal();
  if (local) return { actual, hay: true, origen: 'local', version: local.version, novedades: local.novedades };
  const web = await buscarWeb(actual);
  if (web) return { actual, hay: true, origen: 'web', ...web };
  return { actual, hay: false };
});
// Ejecuta el instalador nuevo en silencio y cierra el programa; el instalador lo vuelve a abrir.
// Por seguridad nunca se ejecuta una ruta enviada por la página: se vuelve a buscar aquí.
ipcMain.handle('instalar-actualizacion', () => {
  const u = buscarLocal();
  if (!u) return false;
  return new Promise(resolve => {
    let hijo;
    try { hijo = spawn(u.archivo, ['/S', '--force-run', '--updated'], { detached: true, stdio: 'ignore' }); }
    catch (e) { return resolve(false); }
    hijo.once('error', () => resolve(false));
    hijo.once('spawn', () => { hijo.unref(); resolve(true); setTimeout(() => app.quit(), 400); });
  });
});

// Guardar varias imágenes (por ejemplo todas las páginas de participantes) en la carpeta que elijas.
ipcMain.handle('guardar-imagenes', async (ev, lista) => {
  const win = BrowserWindow.fromWebContents(ev.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Elige la carpeta donde guardar las imágenes', defaultPath: app.getPath('pictures'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (canceled || !filePaths || !filePaths[0]) return 0;
  let n = 0;
  for (const it of (Array.isArray(lista) ? lista : [])) {
    await fs.writeFile(path.join(filePaths[0], String(it.nombre).replace(/[\\/:*?"<>|]/g, '-')), Buffer.from(it.bytes)); n++;
  }
  return n;
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
