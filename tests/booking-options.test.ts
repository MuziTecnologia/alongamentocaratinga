import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData } from '../src/lib/demo';
import {
  DEFAULT_SERVICE_CATEGORIES,
  NAIL_ART_STEP_DEFAULTS,
  bookingCategories,
  explicitServiceCategory,
  isNailArtService,
  nailArtLabel,
  nailArtNote,
  nailArtStep,
  packageBookingIssue,
  packageNote,
  serviceBookingCategory,
  serviceCategoriesOf,
  serviceCategory,
  servicesToRecategorize,
  validateServiceCategories,
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

test('observação do pacote no modo demo usa o mesmo texto gravado pelo banco', () => {
  assert.equal(
    nailArtNote(false) + packageNote({ name: 'Alongamento', sessions: 4, price: 280 }),
    'Nail art: Não solicitada · Pacote: Alongamento (4 sessões · R$ 280,00)',
  );
});

test('categorias do studio: renomeadas, novas e marcação de nail art', () => {
  const list = serviceCategoriesOf({
    service_categories: [
      { name: 'Alongamentos' },
      { name: ' Manutenção ' },
      { name: 'Esmaltação' },
      { name: 'Arte nas unhas', nail_art: true },
      { name: 'esmaltação' },
      { name: '' },
    ],
  });
  assert.deepEqual(
    list.map((c) => c.name),
    ['Alongamentos', 'Manutenção', 'Esmaltação', 'Arte nas unhas'],
  );
  assert.deepEqual(bookingCategories(list), ['Alongamentos', 'Manutenção', 'Esmaltação']);
  assert.equal(serviceCategory(svc('Pé e mão', 'esmaltação'), list), 'Esmaltação');
  assert.equal(serviceBookingCategory(svc('Pintura', 'Arte nas unhas'), list), null);
  // Categoria antiga: sugestão pelo nome, usando os nomes atuais da lista.
  assert.equal(serviceCategory(svc('Manutenção - Blindagem'), list), 'Manutenção');
  assert.equal(serviceCategory(svc('Blindagem'), list), 'Alongamentos');
  assert.equal(serviceCategory(svc('Nail Art (Cortesia exclusiva)'), list), 'Arte nas unhas');
  // Sem lista salva: padrão.
  assert.deepEqual(serviceCategoriesOf({}), DEFAULT_SERVICE_CATEGORIES);
  assert.deepEqual(serviceCategoriesOf(null), DEFAULT_SERVICE_CATEGORIES);
});

test('validação da lista de categorias editada no painel', () => {
  const ok = [{ name: 'Aplicação' }, { name: 'Nail Art', nail_art: true }];
  assert.equal(validateServiceCategories(ok), '');
  assert.match(validateServiceCategories([...ok, { name: ' ' }]), /nome/);
  assert.match(validateServiceCategories([...ok, { name: 'aplicacao' }]), /Já existe/);
  assert.match(validateServiceCategories([...ok, { name: 'Pacotes' }]), /reservado/);
  assert.match(validateServiceCategories([{ name: 'Nail Art', nail_art: true }]), /pelo menos/);
  assert.match(validateServiceCategories([{ name: 'x'.repeat(41) }]), /40 caracteres/);
});

test('excluir categoria move os serviços dela; renomear leva o novo nome; o resto fica igual', () => {
  const current = serviceCategoriesOf({
    service_categories: [
      { name: 'Aplicação' },
      { name: 'Manutenção' },
      { name: 'Esmaltação' },
      { name: 'Nail Art', nail_art: true },
    ],
  });
  const services = [
    { id: 1, name: 'Banho de gel', category: 'Aplicação' },
    { id: 2, name: 'Manutenção - Blindagem', category: 'Manutenção' },
    { id: 3, name: 'Esmaltação em gel', category: 'Esmaltação' },
    { id: 4, name: 'Manicure', category: 'Esmaltação' },
    { id: 5, name: 'Manutenção - Banho de gel', category: 'Cuidados' }, // antigo, sugerido
    { id: 6, name: 'Nail Art (Cortesia)', category: 'Nail Art' },
  ];
  const moved = servicesToRecategorize(
    services,
    current,
    new Map([['Aplicação', 'Alongamentos']]),
    new Map([
      ['Esmaltação', 'Alongamentos'],
      ['Manutenção', 'Aplicação'],
    ]),
  );
  assert.deepEqual(
    moved.map((s) => [s.id, s.category]),
    [
      [1, 'Alongamentos'],
      [2, 'Aplicação'],
      [3, 'Alongamentos'],
      [4, 'Alongamentos'],
      [5, 'Aplicação'],
    ],
  );
  // Sem mudanças: nenhum serviço é regravado.
  assert.deepEqual(servicesToRecategorize(services, current, new Map(), new Map()), []);
});

test('pacote ligado a nail art, serviço desativado ou inexistente não aparece no agendamento', () => {
  const on = { active: true };
  assert.equal(
    packageBookingIssue(on, { name: 'Banho de gel', category: 'Aplicação', active: true }),
    '',
  );
  assert.match(
    packageBookingIssue(on, {
      name: 'Nail Art (Cortesia exclusiva)',
      category: 'Cuidados',
      active: true,
    }),
    /nail art/,
  );
  assert.match(
    packageBookingIssue(on, { name: 'Blindagem', category: 'Aplicação', active: false }),
    /desativado/,
  );
  assert.match(packageBookingIssue(on, undefined), /não existe/);
  assert.match(
    packageBookingIssue(
      { active: false },
      { name: 'Banho de gel', category: 'Aplicação', active: true },
    ),
    /desativado/,
  );
});
