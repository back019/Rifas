# App de Rifas (escritorio)

App para llevar el control de rifas. Por ahora es para la computadora; está pensada para pasarla después al teléfono.

## Cómo abrirla
1. Necesitas Node.js (versión LTS) instalado: https://nodejs.org
2. Haz doble clic en `iniciar.bat`.
   - La primera vez instala Electron (tarda unos minutos y necesita internet).
   - Las siguientes veces abre directo.

También se puede abrir desde una terminal en esta carpeta con `npm install` (solo la primera vez) y luego `npm start`.

## Dónde se guardan los datos
En la misma computadora, dentro de la base PouchDB de la app (carpeta de datos de Electron en AppData). No necesita internet para funcionar.
Para tener una copia usa el botón "Respaldo" y guarda el archivo .json en otro lado (USB, Drive).

## Cómo funciona
- Cada rifa tiene un precio en una moneda de referencia (por ejemplo $10).
- Los abonos se registran en la moneda en que pague la persona ($, Bs, COP, €, USDT). La app los convierte con la tasa (botón "Tasas") y guarda la tasa usada en cada abono.
- Cada rifa tiene varios premios, cada uno con su fecha, lotería y el % mínimo abonado para participar (por ejemplo especial 1 con 50%, especial 2 con 80% y premio mayor con 100%).
- Al cargar el número que salió, la app dice si ese número participa o no según lo que tiene abonado.

## Archivos
- `main.js`: crea la ventana de Electron, guarda archivos y abre los enlaces de WhatsApp en el navegador.
- `preload.js`: puente seguro entre la página y Electron.
- `src/index.html`, `src/styles.css`, `src/app.js`: la interfaz y la lógica de la app.
- `src/inicio-local.js`: arranca la app con la base local y registra el service worker en el teléfono.
- `src/manifest.webmanifest`, `src/sw.js`, `src/iconos/`: lo necesario para instalarla como app y que abra sin internet.
- `publicar.bat` y `config-github/pages.yml`: suben el proyecto a GitHub y publican `src/` en GitHub Pages (el .bat copia `pages.yml` a `.github/workflows/`).
- `src/db-local.js`: la base de datos local (PouchDB). Cada registro usa su ruta como id, por ejemplo `rifas/abc123/numeros/7`.
- `src/vendor/pouchdb.min.js`: librería PouchDB 9.

## Teléfono (iPhone o Android)
La carpeta `src/` también es una app web instalable (PWA). Se publica gratis en GitHub Pages con `publicar.bat` y en el teléfono se agrega a la pantalla de inicio. Los pasos completos están en `GUIA-IPHONE.md`.

## Sincronizar computadora y teléfono
El botón de la nube conecta la app a un servidor CouchDB. La opción gratis y sin tarjeta es CouchDB en esta PC más Tailscale: ver `GUIA-SINCRONIZAR.md` y la carpeta `servidor/` (configurar-couchdb.bat y activar-tailscale.bat). La sincronización va en los dos sentidos y aguanta estar sin internet. La configuración se guarda en el documento `_local/sync`, que no se copia al servidor.
