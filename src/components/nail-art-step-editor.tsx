'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import type { NailArtStep } from '@/lib/types';
import { NAIL_ART_STEP_DEFAULTS, NAIL_ART_STEP_LIMITS, nailArtStep } from '@/lib/booking-options';
import { uploadStudioImage, validatePhotoUrl } from '@/lib/studio-images';
import { useStudio } from './studio-provider';
import { Field, SectionHead } from './ui';
import { ServicePhotoPicker } from './service-photo-picker';

type TextKey = Exclude<keyof NailArtStep, 'photo_url'>;

/** Painel → Meu site: textos e foto da etapa "Deseja incluir nail art?" do agendamento. */
export function NailArtStepEditor() {
  const { data, saveBusiness, busy, demo, notify } = useStudio();
  const stored = JSON.stringify(data.business.nail_art_step || {});
  const [draft, setDraft] = useState<NailArtStep>(() => nailArtStep(data.business.nail_art_step)),
    [photoFile, setPhotoFile] = useState<File | null>(null),
    [uploading, setUploading] = useState(false),
    [err, setErr] = useState('');
  useEffect(() => {
    setDraft(nailArtStep(JSON.parse(stored)));
    setPhotoFile(null);
  }, [stored]);
  const set = (key: keyof NailArtStep, text: string) => setDraft((d) => ({ ...d, [key]: text }));
  const text = (key: TextKey, label: string, multiline = false) => (
    <Field label={label}>
      {multiline ? (
        <textarea
          rows={2}
          value={draft[key]}
          maxLength={NAIL_ART_STEP_LIMITS[key]}
          placeholder={NAIL_ART_STEP_DEFAULTS[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <input
          value={draft[key]}
          maxLength={NAIL_ART_STEP_LIMITS[key]}
          placeholder={NAIL_ART_STEP_DEFAULTS[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </Field>
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErr('');
    try {
      let photoUrl = draft.photo_url.trim();
      if (photoFile) {
        setUploading(true);
        photoUrl = await uploadStudioImage(photoFile, data.business.id, demo);
      } else validatePhotoUrl(photoUrl, demo);
      // Grava só o que difere do padrão: campos vazios voltam a usar o texto padrão.
      const custom: Partial<NailArtStep> = {};
      for (const key of Object.keys(NAIL_ART_STEP_DEFAULTS) as (keyof NailArtStep)[]) {
        const value = key === 'photo_url' ? photoUrl : draft[key].trim();
        if (value && value !== NAIL_ART_STEP_DEFAULTS[key]) custom[key] = value;
      }
      if (await saveBusiness({ ...data.business, nail_art_step: custom }))
        notify('Etapa de nail art atualizada.');
    } catch (error) {
      setErr((error as Error).message || 'Não foi possível salvar.');
    } finally {
      setUploading(false);
    }
  }
  return (
    <section className="panel padded">
      <SectionHead
        title="Etapa da nail art"
        subtitle="Textos e foto que a cliente vê ao escolher se quer incluir nail art."
      />
      <form className="nail-art-step-editor" onSubmit={submit}>
        <ServicePhotoPicker
          url={draft.photo_url}
          file={photoFile}
          demo={demo}
          disabled={busy || uploading}
          onError={setErr}
          label="Foto de exemplo"
          emptyTitle="Mostre uma nail art sua"
          description="A foto aparece para a cliente junto da pergunta sobre nail art."
          onChange={(url, file) => {
            set('photo_url', url);
            setPhotoFile(file);
          }}
        />
        <div className="form-grid">
          {text('eyebrow', 'Texto pequeno acima do título')}
          {text('title', 'Pergunta (título)')}
        </div>
        <div className="form-grid">
          {text('yes_label', 'Opção "Sim"')}
          {text('yes_hint', 'Texto abaixo do "Sim"')}
        </div>
        <div className="form-grid">
          {text('no_label', 'Opção "Não"')}
          {text('no_hint', 'Texto abaixo do "Não"')}
        </div>
        {text('note', 'Aviso abaixo das opções', true)}
        {err && (
          <p className="error-message" role="alert">
            {err}
          </p>
        )}
        <div className="link-buttons">
          <button className="button primary" type="submit" disabled={busy || uploading}>
            <Save size={16} />
            {uploading ? 'Enviando foto…' : 'Salvar etapa'}
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={busy || uploading}
            onClick={() => {
              setDraft({ ...NAIL_ART_STEP_DEFAULTS, photo_url: draft.photo_url });
              setErr('');
            }}
          >
            <RotateCcw size={16} />
            Textos padrão
          </button>
        </div>
      </form>
    </section>
  );
}
