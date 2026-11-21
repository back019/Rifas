# App de Rifas (escritorio)

App para llevar el control de rifas. Por ahora es para la computadora; está pensada para pasarla después al teléfono.

## Instalarla como programa (recomendado)
Ejecuta `Instalar-Rifas-1.1.0.exe`. Crea el acceso directo "Rifas" en el escritorio y en el menú Inicio. Usa la misma carpeta de datos que `iniciar.bat`, así que ves las mismas rifas.
Para crear un instalador nuevo después de cambios: doble clic en `crear-instalador.bat` (queda en la carpeta `dist`).

## Cómo abrirla (modo desarrollo)
1. Necesitas Node.js (versión LTS) instalado: https://nodejs.org
2. Haz doble clic en `iniciar.bat`.
   - La primera vez instala Electron (tarda unos minutos y necesita internet).
   - Las siguientes veces abre directo.

También se puede abrir desde una terminal en esta carpeta con `npm install` (solo la primera vez) y luego `npm start`.

## Dónde se guardan los datos
En la misma computadora, dentro de la base PouchDB de la app (carpeta de datos de Electron en AppData). No necesita internet para funcionar.
- **Respaldo automático (PC):** el programa guarda solo una copia al abrir y cada 30 minutos si hubo cambios, en `Documentos\Rifas - respaldos` (un archivo por día, se guardan los últimos 14 días). En la ventana "Respaldo" se ve el último y está el botón para abrir la carpeta.
- **Respaldo a mano:** botón "Respaldo" → "Guardar respaldo". Conviene copiar de vez en cuando un archivo a otro lado (USB, Drive). En el teléfono sin sincronizar, la app recuerda guardar uno cada semana.
- Para recuperar: "Respaldo" → "Cargar respaldo" y elige el archivo .json.

## Cómo funciona
- Cada rifa tiene un precio en una moneda de referencia (por ejemplo $10).
- Los abonos se registran en la moneda en que pague la persona ($, Bs, COP, €, USDT). La app los convierte con la tasa (botón "Tasas") y guarda la tasa usada en cada abono.
- Cada rifa tiene varios premios, cada uno con su fecha, lotería y el % mínimo abonado para participar (por ejemplo especial 1 con 50%, especial 2 con 80% y premio mayor con 100%).
- Al cargar el número que salió, la app dice si ese número participa o no según lo que tiene abonado.
- **Cobrar a todos** (pestaña Compradores): lista de los que deben con el mensaje de WhatsApp ya escrito (lo pendiente y lo que les falta para el próximo sorteo). Marca a quién ya le escribiste.
- **Comprobante:** imagen tipo recibo con los números, lo pagado, lo pendiente y los sorteos. Se ofrece al registrar un abono, y está en el detalle de cada número y de cada comprador.
- **Clientes** (botón 👥): junta a los compradores de todas las rifas para ver quién compra siempre y quién quedó debiendo. Al vender, el nombre se autocompleta con clientes anteriores y trae su teléfono.
- **Costos y ganancia** (pestaña Resumen): anota lo que costaron los premios y otros gastos para ver la ganancia real y cuántos números pagados hacen falta para cubrir los costos.
- **Historial** (botón 🕘): todo lo que se cambió, con fecha y equipo. Liberar un número, borrar un abono, cambiar datos, eliminar una rifa, borrar un resultado o un costo se puede **deshacer** desde ahí. Se guardan los últimos 180 días.

## Archivos
- `main.js`: crea la ventana de Electron, guarda archivos, hace el respaldo automático, revisa si hay versión nueva y abre los enlaces de WhatsApp en el navegador.
- `preload.js`: puente seguro entre la página y Electron.
- `src/index.html`, `src/styles.css`, `src/app.js`: la interfaz y la lógica de la app.
- `src/calculos.js`: los cálculos (abonos, %, quién participa, estadísticas, reparto de abonos, ganancia). Sin pantalla, para poder probarlos.
- `src/fusion.js`: une las versiones cuando la PC y el teléfono cambiaron lo mismo sin conexión.
- `src/cobranza.js`: "Cobrar a todos" y el comprobante.
- `src/clientes.js`: la libreta de clientes.
- `src/imagen.js`: genera la imagen para estados (progreso o números libres).
- `src/inicio-local.js`: arranca la app con la base local, el respaldo automático, el aviso de versión nueva y el service worker del teléfono.
- `src/version.json`: la versión publicada y sus novedades (el programa de la PC lo lee para avisar que hay una nueva).
- `src/manifest.webmanifest`, `src/sw.js`, `src/iconos/`: lo necesario para instalarla como app y que abra sin internet.
- `publicar.bat` y `config-github/pages.yml`: suben el proyecto a GitHub y publican `src/` en GitHub Pages (el .bat copia `pages.yml` a `.github/workflows/`).
- `src/db-local.js`: la base de datos local (PouchDB). Cada registro usa su ruta como id, por ejemplo `rifas/abc123/numeros/7`. El historial va en `historial/...`.
- `src/vendor/pouchdb.min.js`: librería PouchDB 9.
- `pruebas/` y `probar.bat`: pruebas automáticas de los cálculos.

## Pruebas automáticas
Doble clic en `probar.bat` (o `npm run pruebas` en una terminal). Revisa los cálculos de abonos, porcentajes, quién participa en cada premio, el reparto de un abono entre varios números, la ganancia y la unión de datos al sincronizar. Córrelas antes de crear un instalador nuevo: si alguna falla, dice cuál.

## Actualización automática del programa
El programa se actualiza solo, sin desinstalar ni perder datos:
- El instalador anota la carpeta desde donde lo ejecutaste (archivo `carpeta-instalador.txt` junto a `Rifas.exe`). Si instalas desde `dist`, esa es la carpeta.
- Al abrir y cada 3 horas, el programa busca ahí un `Instalar-Rifas-X.Y.Z.exe` más nuevo. Si lo encuentra, muestra una ventana (no obligatoria) con las novedades de `Novedades X.Y.Z.txt`, con "Actualizar ahora" y "Más tarde". "Más tarde" no vuelve a preguntar hasta que reinicies el programa, pero queda un aviso arriba.
- "Actualizar ahora" cierra el programa, instala la versión nueva en silencio y lo vuelve a abrir en unos segundos.
- También está el botón "Buscar actualización" en la ventana Respaldo.
- Si no hay nada en la carpeta (por ejemplo en otra PC), revisa `version.json` en GitHub Pages y solo avisa con un enlace para bajar el instalador.
- Si mueves o borras la carpeta del instalador, ejecuta una vez a mano un instalador desde la carpeta nueva.
- El instalador no está firmado: si el antivirus lo frena, agrega una excepción para la carpeta del instalador y para `%LOCALAPPDATA%\Programs\Rifas`.

## Publicar una versión nueva del programa
1. Sube el número de versión en `package.json` y en `src/version.json` (el mismo número, por ejemplo 1.2.0) y escribe las novedades en `src/version.json`.
2. Doble clic en `probar.bat` y luego en `crear-instalador.bat`. Deja en `dist` el instalador `Instalar-Rifas-X.Y.Z.exe` y `Novedades X.Y.Z.txt` (sale de `src/version.json`).
3. Listo para esta PC: la próxima vez que abras el programa (o con "Buscar actualización") aparece la ventana para actualizar.
4. Para otras PCs (opcional): en GitHub, repositorio Rifas → Releases → "Draft a new release", ponle el número de versión y sube el `.exe`. Al subir los cambios a main (`publicar.bat`) se publica `version.json` y esas PCs ven el aviso con el enlace. El teléfono se actualiza solo.

## Teléfono (iPhone o Android)
La carpeta `src/` también es una app web instalable (PWA). Se publica gratis en GitHub Pages con `publicar.bat` y en el teléfono se agrega a la pantalla de inicio. Los pasos completos están en `GUIA-IPHONE.md`.

## Sincronizar computadora y teléfono
El botón de la nube conecta la app a un servidor CouchDB. La opción gratis y sin tarjeta es CouchDB en esta PC más Tailscale: ver `GUIA-SINCRONIZAR.md` y la carpeta `servidor/` (configurar-couchdb.bat y activar-tailscale.bat). La sincronización va en los dos sentidos y aguanta estar sin internet. La configuración se guarda en el documento `_local/sync`, que no se copia al servidor.

Si la PC y el teléfono cambian lo mismo mientras no hay conexión, al sincronizar la app une los cambios sola: si es el mismo comprador junta todos los abonos; si el mismo número se vendió a dos personas distintas, lo marca en rojo ("Vendidos dos veces") para que decidas a quién se queda o pases a uno a otro número libre.
