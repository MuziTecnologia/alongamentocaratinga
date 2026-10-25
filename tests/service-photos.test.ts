import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { validatePhotoUrl, validateStudioImage } from '../src/lib/studio-images';
import {
  BookingConfirmation,
  type BookingConfirmationProps,
} from '../src/components/booking-confirmation';

test('uploads validam formato, conteúdo vazio e limite antes de enviar', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp'])
    validateStudioImage({ type, size: 5_000_000 }, false);
  assert.throws(
    () => validateStudioImage({ type: 'image/svg+xml', size: 500 }, false),
    /JPG, PNG ou WebP/,
  );
  assert.throws(() => validateStudioImage({ type: 'image/png', size: 0 }, false), /vazia/);
  assert.throws(() => validateStudioImage({ type: 'image/png', size: 5_000_001 }, false), /5 MB/);
  assert.throws(() => validateStudioImage({ type: 'image/png', size: 800_001 }, true), /800 KB/);
});

test('fotos aceitam HTTPS e dados locais apenas na demonstração', () => {
  validatePhotoUrl('', false);
  validatePhotoUrl('https://example.com/foto.jpg', false);
  validatePhotoUrl('data:image/png;base64,aGVsbG8=', true);
  for (const url of [
    'javascript:alert(1)',
    'http://example.com/foto.jpg',
    'https://example.com/foto com espaço.jpg',
    'data:image/png;base64,aGVsbG8=',
  ])
    assert.throws(() => validatePhotoUrl(url, false), /HTTPS/);
});

const props: BookingConfirmationProps = {
  customerName: 'Cliente',
  date: '2026-11-04',
  time: '14:30',
  address: 'Rua das Flores, 25, Caratinga - MG',
  studioName: 'AlongamentosCaratinga',
  service: {
    id: 's',
    business_id: 'b',
    name: 'Alongamento em gel',
    category: 'Unhas',
    description: '',
    duration: 90,
    price: 120,
    color: '#edf2e5',
    active: true,
    photo_url: 'https://example.com/unhas.jpg',
  },
  professionalName: 'Profissional',
  onBookAgain() {},
};
test('reserva mostra dia e horário inequívocos, endereço e link de mapa sem afirmar confirmação', () => {
  const html = renderToStaticMarkup(createElement(BookingConfirmation, props));
  assert(html.includes('dateTime="2026-11-04"'));
  assert(html.includes('dateTime="2026-11-04T14:30:00-03:00"'));
  assert(html.includes('4 de novembro'));
  assert(html.includes('2026'));
  assert(html.includes(props.address));
  assert(html.includes(encodeURIComponent(props.address)));
  assert(html.includes('vai confirmar o atendimento'));
  assert(html.includes('Foto de Alongamento em gel'));
});
test('reserva sem endereço informa pendência sem oferecer um mapa vazio', () => {
  const html = renderToStaticMarkup(createElement(BookingConfirmation, { ...props, address: '' }));
  assert(html.includes('O studio informará o endereço'));
  assert(!html.includes('google.com/maps'));
});
