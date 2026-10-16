const test = require('node:test');
const assert = require('node:assert/strict');
const { buildNotaPdf } = require('../src/modules/notas/notas.pdf');
const { buildCertificadoPdf } = require('../src/modules/certificados/certificados.pdf');
const { buildCartaPdf } = require('../src/modules/cartas/cartas.pdf');

test('buildNotaPdf generates a valid PDF buffer', async () => {
  const sample = {
    codigo: 'SGC-NE-001',
    revision: '01',
    numero: '1024',
    clienteEntidad: 'UNIVERSIDAD MAYOR DE SAN SIMÓN',
    objetoContratacion: 'Adquisición de equipamiento de laboratorio',
    lugarEntrega: 'Facultad de Ciencias y Tecnología',
    fechaEntrega: '2026-10-16',
    introduccion: 'Por la presente se hace entrega formal de los equipos.',
    empresaEntregadoPor: 'jdblab',
    entregadoNombre: 'Lic. Delia Crespo',
    entregadoCargo: 'Gerente General',
    recibidoNombre: 'Ing. Carlos Mendoza',
    items: [
      {
        nombre: 'Osciloscopio Digital',
        descripcion: '100MHz 2 Canales',
        codigo: 'OSC-100',
        numeroSerie: 'SN123456',
        cantidad: 2,
        precioUnitario: 3500,
      },
      {
        nombre: 'Generador de Funciones',
        descripcion: '25MHz DDS',
        codigo: 'GEN-25',
        numeroSerie: 'SN78910',
        cantidad: 1,
        precioUnitario: 2200,
      },
    ],
  };

  const buffer = await buildNotaPdf(sample);
  assert.ok(Buffer.isBuffer(buffer), 'Output should be a Buffer');
  assert.ok(buffer.length > 1000, 'PDF buffer should have content');
  assert.equal(buffer.slice(0, 5).toString('ascii'), '%PDF-', 'Buffer should start with PDF magic header');
});

test('buildCertificadoPdf generates a valid PDF buffer', async () => {
  const sample = {
    codigo: 'SGC-CG-001',
    revision: '01',
    clienteEntidad: 'ALCALDÍA DE COCHABAMBA',
    objetoContratacion: 'Equipamiento de robótica',
    garantiaAnos: 2,
    fechaDesde: '2026-10-16',
    fechaHasta: '2028-10-16',
    empresaFirmante: 'tecnoequip',
    firmanteNombre: 'Ing. Jorge Davalos',
    firmanteCargo: 'Gerente Técnico',
    condicionesHtml: '<p>La garantía cubre defectos de fabricación por un período de dos años.</p>',
    items: [
      {
        descripcion: 'Kit de Robótica Educativa',
        marca: 'TecnoLab',
        modelo: 'TL-200',
        cantidad: 5,
        aclaraciones: 'NUEVO',
      },
    ],
  };

  const buffer = await buildCertificadoPdf(sample);
  assert.ok(Buffer.isBuffer(buffer), 'Output should be a Buffer');
  assert.ok(buffer.length > 1000, 'PDF buffer should have content');
  assert.equal(buffer.slice(0, 5).toString('ascii'), '%PDF-', 'Buffer should start with PDF magic header');
});

test('buildCartaPdf generates a valid PDF buffer', async () => {
  const sample = {
    ciudadFecha: 'Cochabamba',
    fecha: '2026-10-16',
    numero: '045/2026',
    tratamiento: 'Señor:',
    destinatario: 'Ing. Mario Vargas',
    cargoDestinatario: 'Director de Carrera',
    institucion: 'UMSS',
    presente: 'Presente.-',
    referencia: 'Presentación de propuesta técnica',
    cuerpoHtml: '<p>Tengo a bien dirigirme a usted con el propósito de remitir la documentación técnica.</p>',
    despedida: 'Sin otro particular, saludo a usted atentamente.',
    empresaFirmante: 'jdblab',
    firmanteNombre: 'Lic. Delia Crespo',
    firmanteCargo: 'Gerente General',
  };

  const buffer = await buildCartaPdf(sample);
  assert.ok(Buffer.isBuffer(buffer), 'Output should be a Buffer');
  assert.ok(buffer.length > 1000, 'PDF buffer should have content');
  assert.equal(buffer.slice(0, 5).toString('ascii'), '%PDF-', 'Buffer should start with PDF magic header');
});
