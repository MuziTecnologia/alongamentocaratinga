import type { NailArtStep, Service, ServiceCategoryDef } from './types';

/** Categorias padrão, usadas enquanto o studio não salvar a própria lista. */
export const DEFAULT_SERVICE_CATEGORIES: ServiceCategoryDef[] = [
  { name: 'Aplicação' },
  { name: 'Manutenção' },
  { name: 'Nail Art', nail_art: true },
];
/** Nome reservado para o cartão de pacotes no agendamento. */
export const PACKAGES_CATEGORY = 'Pacotes';
export const CATEGORY_NAME_MAX = 40;

type Categories = readonly ServiceCategoryDef[];
type ServiceLike = Pick<Service, 'name' | 'category'>;

// Remove acentos (marcas combinantes após NFD) para comparar nomes e categorias.
const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
export const sameCategory = (a: string, b: string) => normalize(a) === normalize(b);

/** Lista de categorias do studio, limpa (sem vazios/duplicados), ou a padrão. */
export function serviceCategoriesOf(
  business?: { service_categories?: unknown } | null,
): Categories {
  const raw = Array.isArray(business?.service_categories) ? business.service_categories : [];
  const list: ServiceCategoryDef[] = [];
  for (const item of raw as ServiceCategoryDef[]) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    if (name && !list.some((c) => sameCategory(c.name, name)))
      list.push({ name, ...(item.nail_art ? { nail_art: true } : {}) });
  }
  return list.length ? list : DEFAULT_SERVICE_CATEGORIES;
}

/** Categoria cadastrada no serviço, quando está na lista do studio; null para valores antigos. */
export function explicitServiceCategory(
  service: Pick<Service, 'category'>,
  categories: Categories = DEFAULT_SERVICE_CATEGORIES,
): string | null {
  return categories.find((c) => sameCategory(c.name, service.category || ''))?.name ?? null;
}

/**
 * Categoria do serviço: a cadastrada ou, para serviços antigos (ex.: "Cuidados"),
 * uma sugestão pelo nome — usada só até o studio salvar uma categoria da lista.
 */
export function serviceCategory(
  service: ServiceLike,
  categories: Categories = DEFAULT_SERVICE_CATEGORIES,
): string {
  const explicit = explicitServiceCategory(service, categories);
  if (explicit) return explicit;
  const main = categories.filter((c) => !c.nail_art),
    byName = (n: string) => main.find((c) => sameCategory(c.name, n))?.name,
    fallback = byName('Aplicação') || main[0]?.name || categories[0].name;
  const name = normalize(service.name);
  if (/nail ?art|decoracao/.test(name)) return categories.find((c) => c.nail_art)?.name || fallback;
  return name.startsWith('manutencao') ? byName('Manutenção') || fallback : fallback;
}

/** Nail art é cortesia vinculada a um serviço principal; nunca é agendada sozinha. */
export const isNailArtService = (
  service: ServiceLike,
  categories: Categories = DEFAULT_SERVICE_CATEGORIES,
) => {
  const category = serviceCategory(service, categories);
  return Boolean(categories.find((c) => c.name === category)?.nail_art);
};

/** Categoria no agendamento público; categorias de nail art não aparecem como principais. */
export function serviceBookingCategory(
  service: ServiceLike,
  categories: Categories = DEFAULT_SERVICE_CATEGORIES,
): string | null {
  return isNailArtService(service, categories) ? null : serviceCategory(service, categories);
}

/** Categorias oferecidas como serviço principal no agendamento, na ordem do studio. */
export const bookingCategories = (categories: Categories) =>
  categories.filter((c) => !c.nail_art).map((c) => c.name);

/** Valida a lista editada no painel; devolve a mensagem de erro ou ''. */
export function validateServiceCategories(categories: ServiceCategoryDef[]): string {
  const names = categories.map((c) => c.name.trim());
  if (names.some((n) => !n)) return 'Dê um nome para cada categoria.';
  if (names.some((n) => n.length > CATEGORY_NAME_MAX))
    return `Use até ${CATEGORY_NAME_MAX} caracteres no nome da categoria.`;
  if (names.some((n, i) => names.findIndex((m) => sameCategory(m, n)) !== i))
    return 'Já existe uma categoria com esse nome.';
  if (names.some((n) => sameCategory(n, PACKAGES_CATEGORY)))
    return '"Pacotes" é reservado para os pacotes do agendamento. Escolha outro nome.';
  if (!categories.some((c) => !c.nail_art))
    return 'Mantenha pelo menos uma categoria que não seja de nail art.';
  if (categories.length > 30) return 'Use no máximo 30 categorias.';
  return '';
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
