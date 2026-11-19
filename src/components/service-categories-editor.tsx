'use client';
import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Service, ServiceCategoryDef } from '@/lib/types';
import {
  CATEGORY_NAME_MAX,
  explicitServiceCategory,
  serviceCategoriesOf,
  serviceCategory,
  validateServiceCategories,
} from '@/lib/booking-options';
import { useStudio } from './studio-provider';
import { FormActions, Modal } from './ui';

type Row = { key: number; original: string; name: string; nail_art: boolean };

/** Painel → Serviços → Categorias: renomear, adicionar, remover e marcar a de nail art. */
export function ServiceCategoriesEditor({ onClose }: { onClose: () => void }) {
  const { data, saveBusiness, saveMany, busy } = useStudio();
  const current = serviceCategoriesOf(data.business);
  const [rows, setRows] = useState<Row[]>(() =>
      current.map((c, i) => ({ key: i, original: c.name, name: c.name, nail_art: !!c.nail_art })),
    ),
    [err, setErr] = useState('');
  const usage = (name: string) =>
    name ? data.services.filter((s) => serviceCategory(s, current) === name).length : 0;
  const update = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErr('');
    const next: ServiceCategoryDef[] = rows.map((r) => ({
      name: r.name.trim(),
      ...(r.nail_art ? { nail_art: true } : {}),
    }));
    const problem = validateServiceCategories(next);
    if (problem) {
      setErr(problem);
      return;
    }
    // Serviços cadastrados numa categoria renomeada acompanham o novo nome.
    const renames = new Map(
      rows.filter((r) => r.original && r.original !== r.name.trim()).map((r) => [r.original, r]),
    );
    const moved: Service[] = data.services.flatMap((s) => {
      const row = renames.get(explicitServiceCategory(s, current) || '');
      return row ? [{ ...s, category: row.name.trim() }] : [];
    });
    if (!(await saveBusiness({ ...data.business, service_categories: next }))) return;
    if (moved.length && !(await saveMany('services', moved))) return;
    onClose();
  }
  return (
    <Modal
      title="Categorias de serviço"
      subtitle="Organize seu menu. Renomear uma categoria atualiza os serviços dela."
      onClose={onClose}
    >
      <form onSubmit={submit} className="editor-form">
        <div className="category-rows">
          {rows.map((r, i) => {
            const count = usage(r.original);
            return (
              <div className="category-row" key={r.key}>
                <input
                  aria-label={`Nome da categoria ${i + 1}`}
                  value={r.name}
                  maxLength={CATEGORY_NAME_MAX}
                  required
                  placeholder="Ex.: Esmaltação"
                  onChange={(e) => update(r.key, { name: e.target.value })}
                />
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={r.nail_art}
                    onChange={(e) => update(r.key, { nail_art: e.target.checked })}
                  />
                  <span>Nail art (cortesia)</span>
                </label>
                <small>
                  {count} {count === 1 ? 'serviço' : 'serviços'}
                </small>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remover categoria ${r.name || i + 1}`}
                  title={count ? 'Mova os serviços desta categoria antes de remover' : 'Remover'}
                  disabled={busy || count > 0}
                  onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="text-button category-add"
          disabled={busy || rows.length >= 30}
          onClick={() =>
            setRows((list) => [
              ...list,
              { key: Date.now(), original: '', name: '', nail_art: false },
            ])
          }
        >
          <Plus size={15} />
          Adicionar categoria
        </button>
        <p className="form-note">
          Categorias marcadas como <strong>nail art</strong> são cortesia: não aparecem como serviço
          principal no agendamento. As demais viram opções para a cliente escolher, na ordem desta
          lista.
        </p>
        {err && (
          <p className="error-message" role="alert">
            {err}
          </p>
        )}
        <FormActions onClose={onClose} label="Salvar categorias" />
      </form>
    </Modal>
  );
}
