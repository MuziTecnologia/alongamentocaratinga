import type { Service } from './types';

export const BOOKING_CATEGORIES = ['Aplicação', 'Manutenção'] as const;
export type BookingCategory = (typeof BOOKING_CATEGORIES)[number];

// Remove acentos (marcas combinantes após NFD) para comparar nomes e categorias.
const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Nail art é cortesia vinculada a um serviço principal; nunca é agendada sozinha. */
export function isNailArtService(service: Pick<Service, 'name' | 'category'>) {
  return (
    /nail ?art|decoracao/.test(normalize(service.name)) ||
    normalize(service.category) === 'nail art'
  );
}

/**
 * Categoria do agendamento público. Usa a categoria cadastrada quando ela já é
 * "Aplicação" ou "Manutenção"; caso contrário, serviços cujo nome começa com
 * "Manutenção" são manutenção e os demais são aplicação.
 */
export function serviceBookingCategory(
  service: Pick<Service, 'name' | 'category'>,
): BookingCategory | null {
  if (isNailArtService(service)) return null;
  const category = normalize(service.category);
  if (category === 'manutencao') return 'Manutenção';
  if (category === 'aplicacao') return 'Aplicação';
  return normalize(service.name).startsWith('manutencao') ? 'Manutenção' : 'Aplicação';
}

export const nailArtLabel = (nailArt: boolean) => (nailArt ? 'Sim (cortesia)' : 'Não');

/** Texto gravado nas observações do agendamento (mesmo texto usado no banco). */
export const nailArtNote = (nailArt: boolean) =>
  nailArt ? 'Nail art: Sim (cortesia)' : 'Nail art: Não solicitada';
