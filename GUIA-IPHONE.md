# Guía: usar la app de rifas en el iPhone (gratis)

La app se publica como página web instalable (PWA) en GitHub Pages: https://back019.github.io/Rifas/ . En el iPhone se agrega a la pantalla de inicio y funciona como una app, incluso sin internet. Para que el iPhone y la computadora tengan los mismos datos se usa un servidor CouchDB en tu PC (ver GUIA-SINCRONIZAR.md).

## Paso 1. Subir la app a GitHub (una sola vez)

1. Entra a github.com y crea un repositorio nuevo:
   - Nombre: rifas (o el que quieras).
   - Público. GitHub Pages gratis necesita repositorio público. Solo se ve el código; tus datos no están ahí.
   - No marques "Add a README". Tiene que quedar vacío.
2. Copia la dirección del repositorio, por ejemplo https://github.com/tu-usuario/rifas.git
3. En esta carpeta haz doble clic en publicar.bat y pega la dirección cuando te la pida.
   - Si no tienes Git, el archivo te avisa. Se instala desde https://git-scm.com/download/win
   - La primera vez se abre una ventana para iniciar sesión en GitHub.
4. En GitHub entra a tu repositorio, luego Settings, luego Pages. En "Build and deployment", en "Source", escoge "GitHub Actions".
5. Ve a la pestaña Actions y espera a que "Publicar en GitHub Pages" salga en verde (1 o 2 minutos). Si falló porque Pages aún no estaba activado, dale "Re-run jobs".
6. La app queda en https://back019.github.io/Rifas/

Cada vez que cambies algo, vuelve a abrir publicar.bat y la página se actualiza sola.

## Paso 2. Instalarla en el iPhone

1. Abre la dirección https://back019.github.io/Rifas/ en Safari. Tiene que ser Safari.
2. Toca el botón Compartir (el cuadrito con la flecha hacia arriba).
3. Toca "Agregar a pantalla de inicio" y luego "Agregar".
4. Ábrela desde el ícono nuevo. A partir de ahí abre aunque no tengas internet.

Sin el paso 3 la app ya funciona en el iPhone, pero con datos separados de la computadora. Haz respaldos de vez en cuando.

## Paso 3. Sincronizar con la PC

Sigue la guía GUIA-SINCRONIZAR.md. El servidor queda en tu PC con CouchDB y Tailscale, gratis y sin tarjeta.

(Si algún día tienes una tarjeta internacional, también sirve IBM Cloudant: plan Lite, autenticación "IAM and legacy credentials", base rifas y CORS para todos los dominios. En la app solo cambia la dirección, el usuario y la clave.)

## Cosas a tener en cuenta

- Sin internet puedes seguir vendiendo y abonando. Cuando vuelva la conexión se pasan los cambios.
- Si cambias el mismo número en los dos equipos sin internet al mismo tiempo, se queda uno de los dos cambios. Mejor evita editar lo mismo en los dos lados sin conexión.
- La clave del servidor queda guardada en cada equipo. No le prestes el teléfono desbloqueado a cualquiera con la app abierta.
- Sigue haciendo un respaldo de vez en cuando (botón Respaldo) por si acaso.
