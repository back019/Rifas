// Después de crear el instalador: escribe dist\Novedades X.Y.Z.txt con las novedades de src/version.json,
// para que el programa instalado las muestre en la ventana de actualización.
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const version = require(path.join(raiz, 'package.json')).version;
const v = JSON.parse(fs.readFileSync(path.join(raiz, 'src', 'version.json'), 'utf8'));
if (v.version !== version) {
  console.log(`  • ojo: src/version.json dice ${v.version} y package.json ${version}; súbelos juntos para que las novedades salgan bien.`);
}
const notas = v.version === version && Array.isArray(v.notas) ? v.notas : [];
const texto = notas.length ? notas.map(n => '• ' + n).join('\r\n') : '';
const archivo = path.join(raiz, 'dist', `Novedades ${version}.txt`);
if (texto) { fs.writeFileSync(archivo, '﻿' + texto + '\r\n', 'utf8'); console.log('  • novedades escritas en', path.relative(raiz, archivo)); }
