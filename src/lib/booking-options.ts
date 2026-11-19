import type { NailArtStep, Service } from './types';

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

/** Textos padrão da etapa de nail art; o studio pode trocá-los no painel (Meu site). */
export const NAIL_ART_STEP_DEFAULTS: NailArtStep = {
  eyebrow: 'UM DETALHE A MAIS',
  title: 'Deseja incluir nail art?',
  yes_label: 'Sim',
  yes_hint: 'Quero uma decoração',
  no_label: 'Não',
  no_hint: 'Somente o serviço',
  note: 'A nail art é uma cortesia do studio e não altera o valor do serviço.',
  photo_url: '',
};
export const NAIL_ART_STEP_LIMITS: Record<Exclude<keyof NailArtStep, 'photo_url'>, number> = {
  eyebrow: 60,
  title: 90,
  yes_label: 30,
  yes_hint: 80,
  no_label: 30,
  no_hint: 80,
  note: 280,
};

// Foto: link HTTPS (Supabase) ou imagem embutida (somente na demonstração local).
const SAFE_PHOTO = /^(https:\/\/\S+|data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+)$/;

/** Combina o que o studio personalizou com os textos padrão (campos vazios usam o padrão). */
export function nailArtStep(custom?: Partial<NailArtStep> | null): NailArtStep {
  const step = { ...NAIL_ART_STEP_DEFAULTS };
  for (const key of Object.keys(NAIL_ART_STEP_LIMITS) as (keyof typeof NAIL_ART_STEP_LIMITS)[]) {
    const value = custom?.[key];
    if (typeof value === 'string' && value.trim())
      step[key] = value.trim().slice(0, NAIL_ART_STEP_LIMITS[key]);
  }
  const photo = custom?.photo_url?.trim() || '';
  if (SAFE_PHOTO.test(photo)) step.photo_url = photo;
  return step;
}

export const nailArtLabel = (nailArt: boolean) => (nailArt ? 'Sim (cortesia)' : 'Não');

/** Texto gravado nas observações do agendamento (mesmo texto usado no banco). */
export const nailArtNote = (nailArt: boolean) =>
  nailArt ? 'Nail art: Sim (cortesia)' : 'Nail art: Não solicitada';
