// Después de crear un instalador: borra de dist los instaladores, .blockmap y "Novedades" de versiones
// anteriores, para no acumular archivos de ~120 MB. Deja solo la versión actual (dist sigue siendo
// la carpeta donde el programa instalado busca actualizaciones).
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const actual = require(path.join(raiz, 'package.json')).version;
const dist = path.join(raiz, 'dist');
const patron = /^(?:Instalar-Rifas-(\d+\.\d+\.\d+)\.exe(?:\.blockmap)?|Novedades (\d+\.\d+\.\d+)\.txt)$/i;
let borrados = 0, bytes = 0;
for (const f of fs.existsSync(dist) ? fs.readdirSync(dist) : []) {
  const m = f.match(patron);
  if (!m || (m[1] || m[2]) === actual) continue;
  const ruta = path.join(dist, f);
  try { bytes += fs.statSync(ruta).size; fs.unlinkSync(ruta); borrados++; } catch (e) { console.log('  • no se pudo borrar', f, '-', e.message); }
}
if (borrados) console.log(`  • borradas ${borrados} versiones viejas de dist (${Math.round(bytes / 1048576)} MB liberados)`);
