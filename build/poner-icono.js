// Después de empaquetar: pone el ícono y los datos del programa en Rifas.exe (sin necesitar Wine).
const fs = require('fs');
const path = require('path');
module.exports = async function (ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const { NtExecutable, NtExecutableResource, Resource, Data } = ResEdit.default || ResEdit;
  const exe = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.exe`);
  const ejecutable = NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = NtExecutableResource.from(ejecutable);
  const ico = Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  const grupos = Resource.IconGroupEntry.fromEntries(res.entries);
  const idGrupo = grupos.length ? grupos[0].id : 1, idioma = grupos.length ? grupos[0].lang : 1033;
  Resource.IconGroupEntry.replaceIconsForResource(res.entries, idGrupo, idioma, ico.icons.map(i => i.data));
  const versiones = Resource.VersionInfo.fromEntries(res.entries);
  const v = versiones[0];
  if (v) {
    const ver = ctx.packager.appInfo.version.split('.').map(Number);
    v.setFileVersion(ver[0], ver[1], ver[2], 0, idioma);
    v.setProductVersion(ver[0], ver[1], ver[2], 0, idioma);
    v.setStringValues({ lang: idioma, codepage: 1200 }, {
      FileDescription: 'Rifas — Control', ProductName: 'Rifas', CompanyName: 'Yixon Belandria',
      LegalCopyright: 'Yixon Belandria', OriginalFilename: 'Rifas.exe', InternalName: 'Rifas'
    });
    v.outputToResourceEntries(res.entries);
  }
  res.outputResource(ejecutable);
  fs.writeFileSync(exe, Buffer.from(ejecutable.generate()));
  console.log('  • ícono y datos puestos en', path.basename(exe));
};
