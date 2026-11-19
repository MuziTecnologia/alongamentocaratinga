import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData } from '../src/lib/demo';
import {
  NAIL_ART_STEP_DEFAULTS,
  explicitServiceCategory,
  isNailArtService,
  nailArtLabel,
  nailArtNote,
  nailArtStep,
  serviceBookingCategory,
  serviceCategory,
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

test('etapa de nail art usa textos do studio e volta ao padrão quando o campo fica vazio', () => {
  assert.deepEqual(nailArtStep(undefined), NAIL_ART_STEP_DEFAULTS);
  const step = nailArtStep({
    title: '  Quer uma arte nas unhas?  ',
    yes_hint: 'Escolho na hora',
    no_label: '   ',
    photo_url: 'https://example.com/arte.jpg',
  });
  assert.equal(step.title, 'Quer uma arte nas unhas?');
  assert.equal(step.yes_hint, 'Escolho na hora');
  assert.equal(step.no_label, NAIL_ART_STEP_DEFAULTS.no_label);
  assert.equal(step.note, NAIL_ART_STEP_DEFAULTS.note);
  assert.equal(step.photo_url, 'https://example.com/arte.jpg');
  assert.equal(nailArtStep({ title: 'x'.repeat(500) }).title.length, 90);
});

test('foto da etapa aceita HTTPS ou imagem embutida inteira e recusa links inseguros', () => {
  const embedded = `data:image/jpeg;base64,${'A'.repeat(5000)}`;
  assert.equal(nailArtStep({ photo_url: embedded }).photo_url, embedded);
  for (const unsafe of [
    'javascript:alert(1)',
    'http://example.com/a.jpg',
    'data:text/html;base64,AA',
  ])
    assert.equal(nailArtStep({ photo_url: unsafe }).photo_url, '');
});

test('categoria escolhida no cadastro prevalece; valores antigos recebem sugestão pelo nome', () => {
  assert.equal(serviceCategory(svc('Banho de gel', 'Aplicação')), 'Aplicação');
  assert.equal(serviceCategory(svc('Manutenção de banho de gel', 'Manutenção')), 'Manutenção');
  assert.equal(serviceCategory(svc('Nail Art personalizada', 'Nail Art')), 'Nail Art');
  // Escolha explícita vence o nome: o studio decide.
  assert.equal(serviceCategory(svc('Nail art francesinha', 'Aplicação')), 'Aplicação');
  assert.equal(serviceBookingCategory(svc('Nail art francesinha', 'Aplicação')), 'Aplicação');
  assert.equal(serviceCategory(svc('Blindagem', 'Nail Art')), 'Nail Art');
  assert.equal(serviceBookingCategory(svc('Blindagem', 'Nail Art')), null);
  // Categoria antiga ("Cuidados"): sugestão pelo nome.
  assert.equal(explicitServiceCategory(svc('Blindagem')), null);
  assert.equal(serviceCategory(svc('Manutenção - Blindagem')), 'Manutenção');
  assert.equal(serviceCategory(svc('Nail Art (Cortesia exclusiva)')), 'Nail Art');
  assert.equal(explicitServiceCategory(svc('x', 'nail art')), 'Nail Art');
});
