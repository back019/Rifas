# Guía: sincronizar la PC y el iPhone (gratis, sin tarjeta)

El servidor de la base de datos (CouchDB) queda en tu PC. Tailscale crea una red privada entre tu PC y tu iPhone y le da a la PC una dirección https. Así el iPhone se sincroniza desde cualquier lugar, en tu WiFi o con datos móviles, siempre que la PC esté prendida.

Si la PC está apagada, el iPhone sigue funcionando normal y se pone al día cuando la prendas.

## Paso 1. Instalar CouchDB en la PC

1. Entra a https://couchdb.apache.org y dale a Download. Baja el instalador de Windows (archivo .msi).
2. Instálalo:
   - Carpeta de instalación sin espacios, por ejemplo C:\CouchDB
   - Deja marcado instalarlo como servicio, para que arranque solo con Windows.
   - Cuando pida usuario y clave de administrador, pon por ejemplo usuario admin y una clave que no se te olvide. Anótala.
3. Si Windows pide reiniciar, reinicia.
4. Para comprobar, abre http://127.0.0.1:5984/_utils en el navegador. Debe salir la página de CouchDB (Fauxton).

Nota: en algunos Windows el instalador pide tener .NET Framework 3.5. Si sale ese aviso, acepta instalarlo.

## Paso 2. Configurar CouchDB para la app

1. En la carpeta servidor haz doble clic en configurar-couchdb.bat
2. Escribe el usuario y la clave del paso 1.
3. Debe decir "Listo. CouchDB esta configurado." El script crea la base rifas y activa CORS. Si lo corres otra vez no daña nada.

## Paso 3. Instalar Tailscale en la PC y en el iPhone

1. En la PC: baja Tailscale desde https://tailscale.com/download/windows, instálalo e inicia sesión. Puedes entrar con tu cuenta de Google o de GitHub.
2. En el iPhone: instala Tailscale desde la App Store e inicia sesión con la misma cuenta. Acepta agregar la configuración de VPN.
3. En el iPhone deja Tailscale conectado (el interruptor en verde). Puedes dejarlo siempre encendido.

## Paso 4. Darle una dirección https a la PC

1. En la carpeta servidor haz doble clic en activar-tailscale.bat
2. Si se abre una página de Tailscale pidiendo activar HTTPS o Serve, acepta. Luego vuelve a abrir activar-tailscale.bat
3. Al final sale una dirección como https://tu-pc.tailxxxx.ts.net. Esa es la dirección del servidor.
4. Para comprobar, abre esa dirección en Safari en el iPhone, con Tailscale conectado. Debe salir un texto que empieza con {"couchdb":"Welcome"...

Esto se hace una sola vez. Queda activo aunque reinicies la PC.

## Paso 5. Conectar la app

Primero en la PC, que es donde ya tienes datos, y después en el iPhone:

1. Abre la app y toca el botón de la nube.
2. Dirección del servidor: la del paso 4 (https://tu-pc.tailxxxx.ts.net)
3. Nombre de la base: rifas
4. Usuario y Clave: los de CouchDB del paso 1.
5. Dale Conectar. Cuando el puntico se ponga verde, está al día.

Colores del puntico:
- Verde: al día.
- Azul: sincronizando.
- Amarillo: sin conexión, se reintenta solo. Revisa que la PC esté prendida y Tailscale conectado.
- Rojo: error. Toca la nube para ver el detalle.

## Si algo falla

- "No se pudo conectar": revisa que la PC esté prendida, que Tailscale esté conectado en los dos equipos y que la dirección empiece con https://
- "Usuario o clave incorrectos": son los de CouchDB, no los de Tailscale.
- Para ver o revisar los datos del servidor en la PC: http://127.0.0.1:5984/_utils
- Haz un respaldo de vez en cuando con el botón Respaldo.

## Seguridad

- CouchDB solo escucha dentro de tu PC. Afuera solo se llega por Tailscale, y en Tailscale solo están tus equipos.
- No uses "tailscale funnel": eso sí lo pondría en internet público.
