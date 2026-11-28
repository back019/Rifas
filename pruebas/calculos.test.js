// Pruebas de los cálculos (abonos, %, quién participa, estadísticas, reparto, ganancia).
// Se corren con: npm run pruebas   (o doble clic en probar.bat)
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/calculos.js');

const rifaBase = (extra = {}) => C.normRifa({
  nombre: 'Prueba', precio: 10, moneda: '$', cantidad: 100, inicio: 0,
  premios: [
    { id: 'p1', nombre: 'Especial', requisito: 50, fecha: '2026-12-01' },
    { id: 'p2', nombre: 'Mayor', requisito: 100, fecha: '2026-12-20' }
  ], ...extra
});
const ab = (id, equiv, extra = {}) => ({ id, monto: equiv, moneda: '$', tasa: 1, equiv, metodo: 'Efectivo', fecha: '2026-11-20T10:00:00Z', ...extra });
const numero = (num, abonos, extra = {}) => ({ num, nombre: 'Ana', telefono: '04141111111', abonos, ...extra });

test('info: suma los abonos y calcula % y lo que debe', () => {
  const r = rifaBase();
  const d = C.info(r, numero(7, [ab('a', 3), ab('b', 2.5)]));
  assert.equal(d.abonado, 5.5);
  assert.ok(Math.abs(d.pct - 55) < 1e-9);
  assert.equal(d.debe, 4.5);
  assert.equal(d.estado, 'apartado');
});

test('info: pagado completo aunque falte medio céntimo por redondeo', () => {
  const r = rifaBase();
  const d = C.info(r, numero(1, [ab('a', 9.996)]));
  assert.equal(d.estado, 'pagado');
});

test('info: el % no pasa de 100 si abonó de más', () => {
  const d = C.info(rifaBase(), numero(1, [ab('a', 15)]));
  assert.equal(d.pct, 100);
  assert.equal(d.debe, 0);
});

test('info: abono en Bs convertido con la tasa guardada', () => {
  const r = rifaBase();
  const d = C.info(r, numero(1, [{ id: 'x', monto: 200, moneda: 'Bs', tasa: 40, equiv: 5 }]));
  assert.equal(d.pct, 50);
});

test('info: datos de la versión anterior (sin lista de abonos)', () => {
  const r = rifaBase();
  assert.equal(C.info(r, { num: 3, nombre: 'Viejo', estado: 'pagado' }).estado, 'pagado');
  assert.equal(C.info(r, { num: 4, nombre: 'Viejo', abonado: 4 }).abonado, 4);
  assert.equal(C.info(r, null), null);
});

test('juega: participa solo con el % mínimo del premio', () => {
  const r = rifaBase();
  const [esp, mayor] = C.premiosOrden(r);
  const mitad = C.info(r, numero(1, [ab('a', 5)]));
  const poco = C.info(r, numero(2, [ab('a', 4.99)]));
  const todo = C.info(r, numero(3, [ab('a', 10)]));
  assert.equal(C.juega(esp, mitad), true);
  assert.equal(C.juega(esp, poco), false);
  assert.equal(C.juega(mayor, mitad), false);
  assert.equal(C.juega(mayor, todo), true);
  assert.equal(C.juega(esp, null), false, 'un número libre no participa');
});

test('premiosOrden y proximoPremio: por fecha, saltando los ya sorteados', () => {
  const r = rifaBase();
  assert.deepEqual(C.premiosOrden(r).map(p => p.id), ['p1', 'p2']);
  assert.equal(C.proximoPremio(r).id, 'p1');
  r.premios[0].ganador = { numero: 5 };
  assert.equal(C.proximoPremio(r).id, 'p2');
  r.premios[1].ganador = { numero: 9 };
  assert.equal(C.proximoPremio(r), null);
  assert.equal(C.premioMayor(r).id, 'p2');
});

test('normRifa: rifa vieja con un solo premio', () => {
  const r = C.normRifa({ nombre: 'Vieja', precio: '5', cantidad: '100', premio: 'Moto', ganador: { numero: 3 } });
  assert.equal(r.precio, 5);
  assert.equal(r.premios.length, 1);
  assert.equal(r.premios[0].nombre, 'Moto');
  assert.equal(r.premios[0].requisito, 100);
  assert.equal(r.premios[0].ganador.juega, true);
  assert.deepEqual(r.costos, []);
});

test('calcStats: pagados, apartados, libres, cobrado y por cobrar', () => {
  const r = rifaBase();
  const lista = [numero(1, [ab('a', 10)]), numero(2, [ab('a', 4)]), numero(3, [ab('a', 12)])].map(d => C.info(r, d));
  const s = C.calcStats(r, lista);
  assert.equal(s.pag, 2);
  assert.equal(s.apa, 1);
  assert.equal(s.libres, 97);
  assert.equal(s.cobrado, 24, 'lo abonado de más no cuenta como cobrado');
  assert.equal(s.porCobrar, 6);
  assert.equal(s.potencial, 1000);
});

test('repartir: completa primero los números más adelantados', () => {
  const r = rifaBase();
  const nums = [C.info(r, numero(1, [ab('a', 2)])), C.info(r, numero(2, [ab('b', 7)])), C.info(r, numero(3, []))];
  const res = C.repartir(r, nums, ab('nuevo', 12));
  const porNum = Object.fromEntries(res.partes.map(p => [p.d.num, p.abono.equiv]));
  assert.deepEqual(porNum, { 2: 3, 1: 8, 3: 1 });
  assert.equal(res.sobra, 0);
  const ids = res.partes.map(p => p.abono.id);
  assert.equal(new Set(ids).size, ids.length, 'cada parte tiene su propio id');
});

test('repartir: el monto en otra moneda se reparte en proporción', () => {
  const r = rifaBase();
  const nums = [C.info(r, numero(1, [])), C.info(r, numero(2, []))];
  const res = C.repartir(r, nums, { id: 'x', monto: 600, moneda: 'Bs', tasa: 40, equiv: 15 });
  assert.equal(res.partes[0].abono.monto, 400);
  assert.equal(res.partes[1].abono.monto, 200);
  assert.equal(res.partes[1].abono.moneda, 'Bs');
});

test('repartir: avisa lo que sobra si ya estaba todo pagado', () => {
  const r = rifaBase();
  const res = C.repartir(r, [C.info(r, numero(1, [ab('a', 9)]))], ab('n', 5));
  assert.equal(res.partes.length, 1);
  assert.equal(res.partes[0].abono.equiv, 1);
  assert.equal(res.sobra, 4);
});

test('agruparCompradores: junta por teléfono y ordena por lo que deben', () => {
  const r = rifaBase();
  const lista = [
    numero(1, [ab('a', 10)], { nombre: 'Ana', telefono: '0414-111.11.11' }),
    numero(2, [ab('b', 2)], { nombre: 'Ana M.', telefono: '584141111111' }),
    numero(3, [], { nombre: 'Luis', telefono: '' }),
    numero(4, [ab('c', 10)], { nombre: 'luis ', telefono: '' })
  ].map(d => C.info(r, d));
  const cs = C.agruparCompradores(r, lista);
  assert.equal(cs.length, 2);
  assert.equal(cs[0].nombre, 'Luis');
  assert.equal(cs[0].debe, 10);
  assert.equal(cs[1].nums.length, 2);
  assert.equal(cs[1].pagado, 12);
  assert.equal(cs[1].debe, 8);
});

test('telWa: números de Venezuela a formato de WhatsApp', () => {
  assert.equal(C.telWa('0414-123.45.67'), '584141234567');
  assert.equal(C.telWa('4141234567'), '584141234567');
  assert.equal(C.telWa('+57 300 1234567'), '573001234567');
  assert.equal(C.telWa(''), '');
});

test('ganancia: cobrado menos costos y números para cubrir costos', () => {
  const r = rifaBase({ costos: [{ id: 'c1', concepto: 'Premio', equiv: 25 }, { id: 'c2', concepto: 'Publicidad', equiv: 5 }] });
  const g = C.ganancia(r, { cobrado: 20, potencial: 1000 });
  assert.equal(g.costos, 30);
  assert.equal(g.actual, -10);
  assert.equal(g.potencial, 970);
  assert.equal(g.equilibrio, 3);
  assert.equal(C.ganancia(rifaBase(), { cobrado: 0, potencial: 1000 }).equilibrio, 0);
});

test('premioMayor: un segundo premio sin fecha no le gana al premio mayor (caso real del flyer)', () => {
  const r = C.normRifa({ nombre: 'Arranque navideño', precio: 20000, moneda: 'COP', premios: [
    { id: 'a', nombre: '🥈 Segundo premio: 200.000 COP', requisito: 50, fecha: '' },
    { id: 'b', nombre: 'Premio mayor: 1.000.000 COP', requisito: 100, fecha: '2026-11-30' }
  ] });
  assert.equal(C.premioMayor(r).id, 'b');
});

test('premioMayor sin la palabra "mayor": gana el que pide más %, y a igual % el de fecha más tardía', () => {
  const base = { nombre: 'R', precio: 10 };
  assert.equal(C.premioMayor(C.normRifa({ ...base, premios: [
    { id: 'moto', nombre: 'Moto', requisito: 100, fecha: '2026-12-20' },
    { id: 'tel', nombre: 'Teléfono', requisito: 50, fecha: '' }
  ] })).id, 'moto');
  assert.equal(C.premioMayor(C.normRifa({ ...base, premios: [
    { id: 'sinFecha', nombre: 'Efectivo', requisito: 100, fecha: '' },
    { id: 'conFecha', nombre: 'Moto', requisito: 100, fecha: '2026-12-20' }
  ] })).id, 'conFecha');
  assert.equal(C.premioMayor(C.normRifa({ ...base, premios: [] })), null);
});

test('montoEnTexto: reconoce premios en dinero para dibujarlos en el flyer', () => {
  assert.deepEqual(C.montoEnTexto('Premio mayor: 1.000.000 COP'), { monto: '1.000.000', moneda: 'COP' });
  assert.deepEqual(C.montoEnTexto('🥈 Segundo premio: 200.000 COP'), { monto: '200.000', moneda: 'COP' });
  assert.deepEqual(C.montoEnTexto('Especial $100'), { monto: '100', moneda: '$' });
  assert.deepEqual(C.montoEnTexto('500 Bs'), { monto: '500', moneda: 'Bs' });
  assert.deepEqual(C.montoEnTexto('200 mil pesos'), { monto: '200.000', moneda: 'COP' });
  assert.deepEqual(C.montoEnTexto('1500000 en efectivo'), { monto: '1.500.000', moneda: '' });
});

test('montoEnTexto: un producto con números no es dinero', () => {
  assert.equal(C.montoEnTexto('Moto Bera BR 200'), null);
  assert.equal(C.montoEnTexto('iPhone 15 Pro 2025'), null);
  assert.equal(C.montoEnTexto('Premio mayor'), null);
  assert.equal(C.montoEnTexto(''), null);
});

test('nombreCorto: nombre + inicial del apellido para publicar la lista', () => {
  assert.equal(C.nombreCorto('  ana   pérez gómez ', 'inicial'), 'Ana P.');
  assert.equal(C.nombreCorto('José', 'inicial'), 'José');
  assert.equal(C.nombreCorto('maría josé rodríguez', 'inicial'), 'María J.');
  assert.equal(C.nombreCorto('  ana  pérez ', 'completo'), 'ana pérez');
  assert.equal(C.nombreCorto('', 'inicial'), '');
  assert.equal(C.nombreCorto(null, 'completo'), '');
});

test('paginar: parte la lista de participantes en páginas', () => {
  const cien = Array.from({ length: 100 }, (_, i) => i);
  const pags = C.paginar(cien, 50);
  assert.equal(pags.length, 2);
  assert.equal(pags[0].length, 50);
  assert.deepEqual(pags[1].slice(-1), [99]);
  assert.equal(C.paginar(cien.slice(0, 39), 50).length, 1);
  assert.equal(C.paginar(cien.slice(0, 51), 24).length, 3);
  assert.deepEqual(C.paginar([], 50), [[]], 'sin participantes igual hay una página');
});
