import { getSupabase } from './supabase/client';
import { uid } from './utils';

export const STUDIO_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function validateStudioImage(file: Pick<File, 'type' | 'size'>, demo: boolean) {
  if (!STUDIO_IMAGE_TYPES.includes(file.type))
    throw new Error('Escolha uma foto JPG, PNG ou WebP.');
  if (file.size === 0) throw new Error('A foto está vazia. Escolha outro arquivo.');
  if (file.size > (demo ? 800_000 : 5_000_000))
    throw new Error(
      demo ? 'A foto deve ter até 800 KB na demonstração.' : 'A foto deve ter até 5 MB.',
    );
}
export function validatePhotoUrl(url: string, demo: boolean) {
  if (!url) return;
  if (demo && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) return;
  try {
    if (new URL(url).protocol === 'https:' && !/\s/.test(url)) return;
  } catch {
    /* Invalid URL. */
  }
  throw new Error('Use um link de foto com HTTPS ou envie um arquivo do seu dispositivo.');
}
export async function uploadStudioImage(
  file: File,
  businessId: string,
  demo: boolean,
): Promise<string> {
  validateStudioImage(file, demo);
  const supabase = getSupabase();
  if (!supabase)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error('Não foi possível ler a foto. Escolha outro arquivo.'));
      reader.readAsDataURL(file);
    });
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const objectPath = `${businessId}/services/${uid()}.${extension}`;
  const { error } = await supabase.storage
    .from('studio-gallery')
    .upload(objectPath, file, { contentType: file.type, upsert: false });
  if (error)
    throw new Error(
      'Não foi possível enviar a foto. Confira a conexão e o bucket studio-gallery no Supabase.',
    );
  return supabase.storage.from('studio-gallery').getPublicUrl(objectPath).data.publicUrl;
}
