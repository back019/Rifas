// Pruebas de la unión de versiones cuando la PC y el teléfono cambiaron lo mismo sin conexión.
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/fusion.js');

const ab = (id, equiv, fecha = '2026-11-20T10:00:00Z') => ({ id, monto: equiv, moneda: '$', tasa: 1, equiv, fecha });
const v = (extra) => ({ num: 8, nombre: 'Ana', telefono: '04141111111', nota: '', abonos: [], actualizado: '2026-11-20T10:00:00Z', ...extra });

test('mismo comprador: se juntan los abonos de los dos equipos sin repetir', () => {
  const pc = v({ abonos: [ab('a1', 4), ab('a2', 3, '2026-11-21T10:00:00Z')] });
  const tel = v({ abonos: [ab('a1', 4), ab('b1', 2, '2026-11-21T11:00:00Z')], actualizado: '2026-11-21T11:00:00Z' });
  const d = F.fusionarNumero([pc, tel]);
  assert.deepEqual(d.abonos.map(a => a.id), ['a1', 'a2', 'b1']);
  assert.equal(d.choques, undefined);
});

test('mismo comprador aunque cambie cómo se escribió el nombre o falte el teléfono', () => {
  assert.equal(F.mismoComprador({ nombre: 'José Pérez' }, { nombre: ' jose  perez' }), true);
  assert.equal(F.mismoComprador({ nombre: 'Ana', telefono: '0414-111-1111' }, { nombre: 'Ana María', telefono: '584141111111' }), true);
  assert.equal(F.mismoComprador({ nombre: 'Ana' }, { nombre: 'Luis' }), false);
});

test('se conservan los datos más recientes y el teléfono si la versión nueva no lo tiene', () => {
  const pc = v({ nota: 'vieja' });
  const tel = v({ nombre: 'ana', telefono: '', nota: 'nueva', actualizado: '2026-11-22T00:00:00Z' });
  const d = F.fusionarNumero([pc, tel]);
  assert.equal(d.nota, 'nueva');
  assert.equal(d.telefono, '04141111111');
});

test('un abono borrado en un equipo no vuelve desde el otro', () => {
  const pc = v({ abonos: [ab('a1', 4)], abonosBorrados: ['a2'] });
  const tel = v({ abonos: [ab('a1', 4), ab('a2', 3)] });
  const d = F.fusionarNumero([pc, tel]);
  assert.deepEqual(d.abonos.map(a => a.id), ['a1']);
  assert.deepEqual(d.abonosBorrados, ['a2']);
});

test('vendido a dos personas: la otra venta queda en choques con sus abonos', () => {
  const pc = v({ abonos: [ab('a3', 10)] });
  const tel = v({ nombre: 'Luis', telefono: '04241234567', abonos: [ab('b2', 5)] });
  const d = F.fusionarNumero([pc, tel]);
  assert.equal(d.nombre, 'Ana');
  assert.deepEqual(d.abonos.map(a => a.id), ['a3']);
  assert.equal(d.choques.length, 1);
  assert.equal(d.choques[0].nombre, 'Luis');
  assert.deepEqual(d.choques[0].abonos.map(a => a.id), ['b2']);
});

test('un choque ya resuelto no vuelve a aparecer', () => {
  const luis = { nombre: 'Luis', telefono: '04241234567', abonos: [ab('b2', 5)] };
  const pc = v({ choquesResueltos: [F.claveVenta(luis)] });
  const tel = v({ ...luis });
  const d = F.fusionarNumero([pc, tel]);
  assert.equal(d.choques, undefined);
});

test('unir dos veces da lo mismo (los equipos no se quedan peleando)', () => {
  const pc = v({ abonos: [ab('a1', 4)] });
  const tel = v({ nombre: 'Luis', telefono: '0424', abonos: [ab('b1', 2)] });
  const una = F.fusionarNumero([pc, tel]);
  const otra = F.fusionarNumero([una, { ...una }]);
  assert.equal(F.igual(una, otra), true);
  // El mismo resultado en el otro orden de llegada (con la misma versión ganadora).
  assert.equal(F.igual(F.fusionarNumero([pc, tel]), F.fusionarNumero([pc, { ...tel }])), true);
});

test('igual ignora los campos internos de la base y el orden de las claves', () => {
  assert.equal(F.igual({ a: 1, b: [1, 2], _rev: '1-x' }, { b: [1, 2], a: 1, _rev: '2-y', _id: 'z' }), true);
  assert.equal(F.igual({ a: 1 }, { a: 2 }), false);
});

test('rifa: se conserva el resultado de un premio guardado en el otro equipo', () => {
  const pc = { nombre: 'R', premios: [{ id: 'p1', ganador: null }, { id: 'p2', ganador: null }] };
  const tel = { nombre: 'R', premios: [{ id: 'p1', ganador: { numero: 7 } }, { id: 'p2', ganador: null }] };
  const d = F.fusionarRifa([pc, tel]);
  assert.equal(d.premios[0].ganador.numero, 7);
  assert.equal(d.estado, 'activa');
});

test('rifa: se juntan los costos de los dos equipos, menos los borrados', () => {
  const pc = { nombre: 'R', premios: [], costos: [{ id: 'c1', equiv: 5 }, { id: 'c2', equiv: 3 }], costosBorrados: ['c3'] };
  const tel = { nombre: 'R', premios: [], costos: [{ id: 'c1', equiv: 5 }, { id: 'c3', equiv: 9 }, { id: 'c4', equiv: 1 }] };
  const d = F.fusionarRifa([pc, tel]);
  assert.deepEqual(d.costos.map(c => c.id).sort(), ['c1', 'c2', 'c4']);
});

test('fusionar elige la regla según el tipo de registro', () => {
  assert.equal(F.esNumero('rifas/abc/numeros/7'), true);
  assert.equal(F.esNumero('rifas/abc'), false);
  const tasas = F.fusionar('config/tasas', [{ tasas: { Bs: 40 } }, { tasas: { Bs: 41 } }]);
  assert.equal(tasas.tasas.Bs, 40, 'otros registros: gana la versión elegida por la base');
});
