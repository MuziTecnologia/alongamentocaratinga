'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { validateStudioImage } from '@/lib/studio-images';
import { Field } from './ui';

type Props = {
  url: string;
  file: File | null;
  demo: boolean;
  disabled: boolean;
  onChange: (url: string, file: File | null) => void;
  onError: (message: string) => void;
};
export function ServicePhotoPicker({ url, file, demo, disabled, onChange, onError }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(url);
  useEffect(() => {
    if (!file) {
      setPreview(url);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, url]);
  return (
    <div className="service-photo-field">
      <div className="field-heading">
        <span>
          Foto do serviço <small>opcional</small>
        </span>
        {(url || file) && (
          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={() => {
              onChange('', null);
              if (input.current) input.current.value = '';
            }}
          >
            <Trash2 size={13} />
            Remover foto
          </button>
        )}
      </div>
      <div className={`service-photo-picker ${preview ? 'with-preview' : ''}`}>
        {preview ? (
          <div className="service-photo-preview">
            <img src={preview} alt="Prévia da foto do serviço" />
          </div>
        ) : (
          <div className="service-photo-placeholder">
            <ImagePlus size={30} strokeWidth={1.2} />
          </div>
        )}
        <div>
          <strong>{preview ? 'Sua criação em destaque' : 'Mostre como fica esse cuidado'}</strong>
          <p>A foto aparece no seu painel e no menu que a cliente vê ao agendar.</p>
          <button
            type="button"
            className="button secondary small-button"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            <Upload size={15} />
            {file ? 'Escolher outra foto' : preview ? 'Trocar foto' : 'Enviar foto do dispositivo'}
          </button>
          <small>JPG, PNG ou WebP · até {demo ? '800 KB' : '5 MB'}</small>
        </div>
      </div>
      <input
        ref={input}
        className="sr-only"
        type="file"
        aria-label="Foto do serviço"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (!selected) return;
          try {
            validateStudioImage(selected, demo);
            onError('');
            onChange(url, selected);
          } catch (error) {
            onError((error as Error).message);
            event.target.value = '';
          }
        }}
      />
      <details className="photo-url-option">
        <summary>Ou usar um link de imagem</summary>
        <Field label="Link da foto (HTTPS)">
          <input
            type="url"
            aria-label="Link da foto do serviço"
            value={file ? '' : url.startsWith('data:') ? '' : url}
            disabled={disabled || Boolean(file)}
            placeholder="https://…/foto-do-servico.jpg"
            onChange={(event) => onChange(event.target.value, null)}
          />
        </Field>
      </details>
    </div>
  );
}
