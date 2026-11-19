import type { NailArtStep, Service } from './types';

/** Categorias que o studio escolhe no cadastro de cada serviço. */
export const SERVICE_CATEGORIES = ['Aplicação', 'Manutenção', 'Nail Art'] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
/** Categorias oferecidas como serviço principal no agendamento público. */
export const BOOKING_CATEGORIES = ['Aplicação', 'Manutenção'] as const;
export type BookingCategory = (typeof BOOKING_CATEGORIES)[number];

// Remove acentos (marcas combinantes após NFD) para comparar nomes e categorias.
const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Categoria escolhida no cadastro, quando é uma das três; null para valores antigos. */
export function explicitServiceCategory(
  service: Pick<Service, 'category'>,
): ServiceCategory | null {
  const category = normalize(service.category || '');
  return SERVICE_CATEGORIES.find((c) => normalize(c) === category) ?? null;
}

/**
 * Categoria do serviço: a escolhida no cadastro ou, para serviços antigos
 * (ex.: "Cuidados"), uma sugestão pelo nome — usada só até o studio salvar uma categoria.
 */
export function serviceCategory(service: Pick<Service, 'name' | 'category'>): ServiceCategory {
  const explicit = explicitServiceCategory(service);
  if (explicit) return explicit;
  const name = normalize(service.name);
  if (/nail ?art|decoracao/.test(name)) return 'Nail Art';
  return name.startsWith('manutencao') ? 'Manutenção' : 'Aplicação';
}

/** Nail art é cortesia vinculada a um serviço principal; nunca é agendada sozinha. */
export const isNailArtService = (service: Pick<Service, 'name' | 'category'>) =>
  serviceCategory(service) === 'Nail Art';

/** Categoria no agendamento público; serviços de Nail Art não aparecem como principais. */
export function serviceBookingCategory(
  service: Pick<Service, 'name' | 'category'>,
): BookingCategory | null {
  const category = serviceCategory(service);
  return category === 'Nail Art' ? null : category;
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

/** Complemento das observações quando a cliente escolhe um pacote (mesmo texto do banco). */
export const packageNote = (pack: { name: string; sessions: number; price: number }) =>
  ` · Pacote: ${pack.name} (${pack.sessions} sessões · R$ ${Number(pack.price).toFixed(2).replace('.', ',')})`;

/** Texto gravado nas observações do agendamento (mesmo texto usado no banco). */
export const nailArtNote = (nailArt: boolean) =>
  nailArt ? 'Nail art: Sim (cortesia)' : 'Nail art: Não solicitada';
