import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDemoData } from '../src/lib/demo';
import type { Appointment } from '../src/lib/types';
import { BookingConfirmation } from '../src/components/booking-confirmation';
import { SessionConfirmations } from '../src/components/session-confirmations';
import {
  adminConfirmationLink,
  clientConfirmationLink,
  isWithinConfirmationHour,
} from '../src/lib/whatsapp-confirmations';

const details = {
  customerName: 'Ana & Maria',
  studioName: 'Studio de unhas',
  serviceName: 'Alongamento',
  professionalName: 'Marina',
  address: 'Rua das Flores, 25',
};
const now = Date.parse('2026-10-26T13:00:00-03:00');
const data = createDemoData();
const base: Appointment = {
  ...data.appointments[0],
  kind: 'booking',
  status: 'confirmed',
  starts_at: '2026-10-26T14:00:00-03:00',
};

test('cliente confirma para o número solicitado com nome completo, data, hora, serviço e endereço', () => {
  const url = new URL(clientConfirmationLink({ ...details, date: '2026-11-04', time: '14:30' }));
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/553197311275');
  const message = url.searchParams.get('text')!;
  for (const text of [
    'Ana & Maria',
    '4 de novembro de 2026',
    '14:30',
    'Alongamento',
    'Rua das Flores, 25',
    'Marina',
    'Confirmo minha presença',
  ])
    assert(message.includes(text));
  assert.equal([...url.searchParams.keys()].length, 1);
  const html = renderToStaticMarkup(
    createElement(BookingConfirmation, {
      customerName: details.customerName,
      studioName: details.studioName,
      address: '',
      professionalName: '',
      date: '2026-11-04',
      time: '14:30',
      service: data.services[0],
      onBookAgain() {},
    }),
  );
  assert(html.includes('href="https://wa.me/553197311275?text='));
  assert(html.includes('Confirmar pelo WhatsApp'));
});

test('janela de confirmação abre em 60 minutos e exclui sessões iniciadas, bloqueios e cancelamentos', () => {
  assert.equal(isWithinConfirmationHour(base, now), true);
  assert.equal(isWithinConfirmationHour(base, now - 1), false);
  assert.equal(isWithinConfirmationHour(base, now + 59 * 60_000), true);
  assert.equal(isWithinConfirmationHour(base, now + 60 * 60_000), false);
  assert.equal(isWithinConfirmationHour(base, now + 61 * 60_000), false);
  assert.equal(isWithinConfirmationHour({ ...base, status: 'pending' }, now), true);
  for (const status of ['cancelled', 'completed', 'no_show'] as const)
    assert.equal(isWithinConfirmationHour({ ...base, status }, now), false);
  assert.equal(isWithinConfirmationHour({ ...base, kind: 'block' }, now), false);
  assert.equal(isWithinConfirmationHour({ ...base, starts_at: 'inválido' }, now), false);
});

test('admin abre o número de cada cliente sem duplicar código do Brasil e preserva horário de Brasília', () => {
  for (const phone of ['(33) 99999-1111', '+55 33 99999-1111']) {
    const url = new URL(
      adminConfirmationLink({ ...details, phone, startsAt: '2026-11-04T17:30:00Z' }),
    );
    assert.equal(url.pathname, '/5533999991111');
    const message = url.searchParams.get('text')!;
    assert(message.includes('*Horário:* 14:30 (horário de Brasília)'));
    assert(message.includes('Ana & Maria'));
    assert(message.includes(details.address));
    assert(message.includes('Você confirma sua presença?'));
  }
});

test('mensagens usam negrito e blocos separados, limpam o endereço e omitem o nome genérico da agenda', () => {
  const booking = {
    ...details,
    professionalName: ' Minha   agenda ',
    address: ' Rua das Flores, 25,  ',
    date: '2026-10-26',
    time: '17:00',
  };
  const messages = [
    new URL(clientConfirmationLink(booking)).searchParams.get('text')!,
    new URL(
      adminConfirmationLink({ ...booking, phone: '33999991111', startsAt: '2026-10-26T20:00:00Z' }),
    ).searchParams.get('text')!,
  ];
  for (const message of messages) {
    assert(message.includes('*Studio de unhas*\n\nOlá'));
    assert(
      message.includes(
        '*Serviço:* Alongamento\n*Data:* segunda-feira, 26 de outubro de 2026\n*Horário:* 17:00 (horário de Brasília)',
      ),
    );
    assert(message.includes('*Endereço:* Rua das Flores, 25\n\n'));
    assert(!message.includes('Minha agenda'));
    assert(!message.includes('*Profissional:*'));
    assert(!message.includes(',.'));
    assert(!message.includes('\uFFFD'));
    assert(!/\p{Extended_Pictographic}/u.test(message));
  }
  assert(messages[0].startsWith('*CONFIRMAÇÃO DE AGENDAMENTO*'));
  assert(messages[1].startsWith('*LEMBRETE DE ATENDIMENTO*'));
  const empty = new URL(
    clientConfirmationLink({ ...booking, professionalName: '', address: ', .' }),
  ).searchParams.get('text')!;
  assert(!empty.includes('*Endereço:*'));
});

test('dashboard mostra ações por cliente somente na próxima hora e oferece corrigir contato ausente', () => {
  const client = {
    ...data.clients[0],
    id: 'qa-client',
    name: 'Cliente de teste',
    phone: '33999991111',
  };
  const studio = {
    ...data,
    clients: [client],
    appointments: [
      { ...base, client_id: client.id },
      { ...base, id: 'too-early', starts_at: '2026-10-26T14:01:00-03:00', client_id: client.id },
    ],
  };
  const render = () =>
    renderToStaticMarkup(
      createElement(SessionConfirmations, { data: studio, now, onEditClient() {} }),
    );
  const html = render();
  assert.equal((html.match(/href="https:\/\/wa.me\//g) || []).length, 1);
  assert(html.includes('Confirmar atendimento de Cliente de teste no WhatsApp'));
  client.phone = '';
  assert(!render().includes('href="https://wa.me/'));
  assert(render().includes('Adicionar WhatsApp'));
  studio.appointments = [];
  assert(render().includes('Nenhum atendimento na próxima hora'));
});
