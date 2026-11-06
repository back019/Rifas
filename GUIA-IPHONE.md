# Guía: usar la app de rifas en el iPhone (gratis)

La app se publica como página web instalable (PWA) en GitHub Pages. En el iPhone se agrega a la pantalla de inicio y funciona como una app, incluso sin internet. Para que el iPhone y la computadora tengan los mismos datos se usa un servidor CouchDB gratis en IBM Cloudant.

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
6. La app queda en https://tu-usuario.github.io/rifas/

Cada vez que cambies algo, vuelve a abrir publicar.bat y la página se actualiza sola.

## Paso 2. Instalarla en el iPhone

1. Abre la dirección https://tu-usuario.github.io/rifas/ en Safari. Tiene que ser Safari.
2. Toca el botón Compartir (el cuadrito con la flecha hacia arriba).
3. Toca "Agregar a pantalla de inicio" y luego "Agregar".
4. Ábrela desde el ícono nuevo. A partir de ahí abre aunque no tengas internet.

Sin el paso 3 la app ya funciona en el iPhone, pero con datos separados de la computadora. Haz respaldos de vez en cuando.

## Paso 3. Crear la base gratis en IBM Cloudant (para sincronizar)

Los nombres de los botones pueden cambiar un poco, pero los pasos son estos:

1. Crea una cuenta en https://cloud.ibm.com/registration. Puede que pidan una tarjeta para verificar; el plan Lite no cobra.
2. En el catálogo busca "Cloudant" y crea una instancia:
   - Plan: Lite (gratis, 1 GB).
   - Método de autenticación: "IAM and legacy credentials". Esto es importante para que funcionen usuario y clave.
3. Abre la instancia y entra a "Service credentials". Crea una credencial nueva ("New credential") y ábrela. Ahí salen:
   - host o url: algo como xxxx-bluemix.cloudantnosqldb.appdomain.cloud
   - username
   - password
4. Entra al Dashboard de Cloudant ("Launch Dashboard"):
   - Crea una base de datos llamada rifas (tipo "Non-partitioned").
   - En Account, luego CORS, activa CORS y escoge "All domains ( * )". Sin esto el navegador del iPhone no puede conectarse.

## Paso 4. Conectar la computadora y el iPhone

En los dos equipos:

1. Abre la app y toca el botón de la nube.
2. Llena los campos:
   - Dirección del servidor: https:// más el host del paso 3 (por ejemplo https://xxxx-bluemix.cloudantnosqldb.appdomain.cloud)
   - Nombre de la base: rifas
   - Usuario y Clave: los del paso 3
3. Dale Conectar. El puntico de la nube se pone verde cuando está al día:
   - Azul: sincronizando.
   - Amarillo: sin internet. Se reintenta solo.
   - Rojo: error. Toca la nube para ver el detalle.

Conecta primero la computadora, que es donde ya tienes datos, y luego el iPhone. Así el iPhone baja todo.

## Cosas a tener en cuenta

- Sin internet puedes seguir vendiendo y abonando. Cuando vuelva la conexión se pasan los cambios.
- Si cambias el mismo número en los dos equipos sin internet al mismo tiempo, se queda uno de los dos cambios. Mejor evita editar lo mismo en los dos lados sin conexión.
- La clave de Cloudant queda guardada en cada equipo. No le prestes el teléfono desbloqueado a cualquiera con la app abierta.
- Sigue haciendo un respaldo de vez en cuando (botón Respaldo) por si acaso.
