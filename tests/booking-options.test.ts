import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData } from '../src/lib/demo';
import {
  isNailArtService,
  nailArtLabel,
  nailArtNote,
  serviceBookingCategory,
} from '../src/lib/booking-options';

const svc = (name: string, category = 'Cuidados') => ({ name, category });

test('serviços do studio são separados em aplicação e manutenção, sem nail art avulsa', () => {
  const cases: [string, 'Aplicação' | 'Manutenção' | null][] = [
    ['Alongamento', 'Aplicação'],
    ['Banho de gel', 'Aplicação'],
    ['Blindagem', 'Aplicação'],
    ['Manutenção - Alongamento', 'Manutenção'],
    ['Manutenção - Banho de gel', 'Manutenção'],
    ['Manutenção - Blindagem', 'Manutenção'],
    ['manutencao blindagem', 'Manutenção'],
    ['Nail Art (Cortesia exclusiva)', null],
    ['Decoração', null],
  ];
  for (const [name, expected] of cases)
    assert.equal(serviceBookingCategory(svc(name)), expected, name);
});

test('categoria cadastrada como Aplicação/Manutenção prevalece sobre o nome', () => {
  assert.equal(serviceBookingCategory(svc('Reparo de unha', 'Manutenção')), 'Manutenção');
  assert.equal(serviceBookingCategory(svc('Manutenção especial', 'Aplicação')), 'Aplicação');
  assert.equal(serviceBookingCategory(svc('Pintura livre', 'Nail art')), null);
  assert(isNailArtService(svc('nailart')));
});

test('dados de demonstração: nail art fica fora das categorias', () => {
  const services = createDemoData().services;
  assert.equal(services.filter((s) => serviceBookingCategory(s) === null).length, 1);
  assert.deepEqual(
    services.filter((s) => serviceBookingCategory(s) === 'Manutenção').map((s) => s.name),
    ['Manutenção em gel'],
  );
});

test('nail art é registrada como Sim (cortesia) ou não solicitada', () => {
  assert.equal(nailArtLabel(true), 'Sim (cortesia)');
  assert.equal(nailArtLabel(false), 'Não');
  assert.equal(nailArtNote(true), 'Nail art: Sim (cortesia)');
  assert.equal(nailArtNote(false), 'Nail art: Não solicitada');
});
