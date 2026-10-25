import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData } from '../src/lib/demo';
import { availableSlots, overlap, validateAppointment } from '../src/lib/domain';
import { addDays, atTime, dateKey, normalizePhone, parseCsv, today } from '../src/lib/utils';

test('horário de Brasília preserva a data ao atravessar meia-noite UTC', () => {
  assert.equal(dateKey('2026-10-25T01:30:00Z'), '2026-10-24');
  assert.equal(atTime('2026-10-24', '22:30'), '2026-10-25T01:30:00.000Z');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
test('horários consecutivos são aceitos, sobreposição é rejeitada', () => {
  assert.equal(
    overlap(
      '2026-10-24T09:00-03:00',
      '2026-10-24T10:00-03:00',
      '2026-10-24T10:00-03:00',
      '2026-10-24T11:00-03:00',
    ),
    false,
  );
  const data = createDemoData(),
    existing = data.appointments[0];
  assert.throws(
    () => validateAppointment(data, { ...existing, id: crypto.randomUUID() }),
    /ocupado/,
  );
  assert.doesNotThrow(() =>
    validateAppointment(data, { ...existing, id: crypto.randomUUID(), status: 'cancelled' }),
  );
  assert.doesNotThrow(() =>
    validateAppointment(data, {
      ...existing,
      id: crypto.randomUUID(),
      professional_id: data.professionals[1].id,
      starts_at: atTime(today(), '17:00'),
      ends_at: atTime(today(), '18:00'),
    }),
  );
});
test('disponibilidade respeita expediente, pausa, antecedência e bloqueios', () => {
  const data = createDemoData();
  data.appointments = [];
  data.business.notice_hours = 2;
  const date = '2027-01-04',
    s = data.services[2],
    p = data.professionals[0];
  const now = new Date(atTime(date, '08:00'));
  let slots = availableSlots(data, date, s.id, p.id, now);
  assert(!slots.includes('09:00'));
  assert(slots.includes('10:00'));
  assert(!slots.includes('11:30'));
  assert(!slots.includes('12:00'));
  assert(slots.includes('13:00'));
  assert(slots.includes('18:00'));
  assert(!slots.includes('18:30'));
  data.appointments = [
    {
      ...createDemoData().appointments[0],
      id: crypto.randomUUID(),
      professional_id: p.id,
      kind: 'block',
      starts_at: atTime(date, '14:00'),
      ends_at: atTime(date, '15:00'),
      client_id: null,
      service_id: null,
    },
  ];
  slots = availableSlots(data, date, s.id, p.id, now);
  assert(!slots.includes('13:30'));
  assert(!slots.includes('14:00'));
  assert(slots.includes('15:00'));
  assert.deepEqual(availableSlots(data, '2027-01-03', s.id, p.id, now), []);
  data.business.booking_enabled = false;
  assert.deepEqual(availableSlots(data, date, s.id, p.id, now), []);
});
test('pacotes vencidos, de outro serviço e esgotados não são usados', () => {
  const data = createDemoData(),
    p = data.customer_packages[0],
    appt = {
      ...data.appointments[0],
      service_id: data.packages[0].service_id,
      customer_package_id: p.id,
    };
  assert.doesNotThrow(() => validateAppointment(data, appt));
  p.sessions_used = p.sessions_total;
  assert.throws(() => validateAppointment(data, appt), /Pacote/);
  assert.doesNotThrow(() => validateAppointment(data, { ...appt, status: 'cancelled' }));
  p.sessions_used = 0;
  p.expires_at = addDays(today(), -1);
  assert.throws(() => validateAppointment(data, appt), /Pacote/);
});
test('importação suporta delimitadores, vírgulas, aspas e quebras internas', () => {
  assert.deepEqual(
    parseCsv('\uFEFFnome;telefone\r\n"Ana; Maria";"33999999999"\r\n"Bia ""Flor""";\r\n'),
    [
      ['nome', 'telefone'],
      ['Ana; Maria', '33999999999'],
      ['Bia "Flor"', ''],
    ],
  );
  assert.deepEqual(parseCsv('nome,email\n"Nome\nComposto",a@exemplo.com'), [
    ['nome', 'email'],
    ['Nome\nComposto', 'a@exemplo.com'],
  ]);
  assert.throws(() => parseCsv('nome\n"incompleto'), /aspas/);
  assert.equal(normalizePhone('+55 (33) 99999-9999'), '33999999999');
});
