'use client';
import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Service, ServiceCategoryDef } from '@/lib/types';
import {
  CATEGORY_NAME_MAX,
  serviceCategoriesOf,
  serviceCategory,
  servicesToRecategorize,
  validateServiceCategories,
} from '@/lib/booking-options';
import { useStudio } from './studio-provider';
import { Badge, FormActions, Modal } from './ui';

type Row = {
  key: number;
  /** Nome salvo hoje ('' para categoria nova). */
  original: string;
  name: string;
  nail_art: boolean;
  mode: 'view' | 'edit' | 'delete';
  /** Ao excluir uma categoria com serviços: para qual linha eles vão. */
  moveTo: number | null;
};
type Removed = { original: string; moveTo: number | null };

/** Painel → Serviços → Categorias: editar, excluir, adicionar e marcar a de nail art. */
export function ServiceCategoriesEditor({ onClose }: { onClose: () => void }) {
  const { data, saveBusiness, saveMany, busy } = useStudio();
  const current = serviceCategoriesOf(data.business);
  const [rows, setRows] = useState<Row[]>(() =>
      current.map((c, i) => ({
        key: i,
        original: c.name,
        name: c.name,
        nail_art: !!c.nail_art,
        mode: 'view',
        moveTo: null,
      })),
    ),
    [removed, setRemoved] = useState<Removed[]>([]),
    [err, setErr] = useState('');
  // Serviços que aparecem em cada categoria salva (inclui os antigos, pela sugestão).
  const usage = (name: string) =>
    name ? data.services.filter((s) => serviceCategory(s, current) === name).length : 0;
  const update = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  function remove(row: Row, moveTo: number | null) {
    if (row.original) setRemoved((list) => [...list, { original: row.original, moveTo }]);
    setRows((list) =>
      list
        .filter((r) => r.key !== row.key)
        // Quem ia mover serviços para a categoria excluída passa a mover para o destino dela.
        .map((r) => (r.moveTo === row.key ? { ...r, moveTo } : r)),
    );
    setErr('');
  }
  function askDelete(row: Row) {
    setErr('');
    if (!usage(row.original)) return remove(row, null);
    const target = rows.find((r) => r.key !== row.key);
    update(row.key, { mode: 'delete', moveTo: target?.key ?? null });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErr('');
    if (rows.some((r) => r.mode === 'delete')) {
      setErr('Confirme ou cancele a exclusão antes de salvar.');
      return;
    }
    const next: ServiceCategoryDef[] = rows.map((r) => ({
      name: r.name.trim(),
      ...(r.nail_art ? { nail_art: true } : {}),
    }));
    const problem = validateServiceCategories(next);
    if (problem) {
      setErr(problem);
      return;
    }
    const finalName = (key: number | null) => rows.find((r) => r.key === key)?.name.trim() || '';
    const deleted = new Map(removed.map((r) => [r.original, finalName(r.moveTo)]));
    const renamed = new Map(
      rows
        .filter((r) => r.original && r.original !== r.name.trim())
        .map((r) => [r.original, r.name.trim()]),
    );
    const moved: Service[] = servicesToRecategorize(data.services, current, renamed, deleted);
    if (!(await saveBusiness({ ...data.business, service_categories: next }))) return;
    if (moved.length && !(await saveMany('services', moved))) return;
    onClose();
  }
  return (
    <Modal
      title="Categorias de serviço"
      subtitle="Edite, exclua ou crie categorias. Os serviços acompanham as mudanças."
      onClose={onClose}
    >
      <form onSubmit={submit} className="editor-form">
        <div className="category-rows">
          {rows.map((r, i) => {
            const count = usage(r.original);
            const countLabel = `${count} ${count === 1 ? 'serviço' : 'serviços'}`;
            if (r.mode === 'edit')
              return (
                <div className="category-row" key={r.key}>
                  <input
                    aria-label={`Nome da categoria ${i + 1}`}
                    value={r.name}
                    maxLength={CATEGORY_NAME_MAX}
                    required
                    autoFocus
                    placeholder="Ex.: Esmaltação"
                    onChange={(e) => update(r.key, { name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (r.name.trim()) update(r.key, { mode: 'view' });
                      }
                    }}
                  />
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={r.nail_art}
                      onChange={(e) => update(r.key, { nail_art: e.target.checked })}
                    />
                    <span>Nail art (cortesia)</span>
                  </label>
                  <small>{countLabel}</small>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Concluir edição de ${r.name || 'categoria'}`}
                    disabled={!r.name.trim()}
                    onClick={() => update(r.key, { mode: 'view' })}
                  >
                    <Check size={16} />
                  </button>
                </div>
              );
            if (r.mode === 'delete')
              return (
                <div className="category-row category-delete" key={r.key} role="group">
                  <p>
                    Excluir <strong>{r.name}</strong>? Mover os {countLabel} para:
                  </p>
                  <select
                    aria-label={`Categoria que recebe os serviços de ${r.name}`}
                    value={r.moveTo ?? ''}
                    onChange={(e) => update(r.key, { moveTo: Number(e.target.value) })}
                  >
                    {rows
                      .filter((x) => x.key !== r.key)
                      .map((x) => (
                        <option key={x.key} value={x.key}>
                          {x.name.trim() || 'Nova categoria'}
                        </option>
                      ))}
                  </select>
                  <div className="category-delete-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => update(r.key, { mode: 'view', moveTo: null })}
                    >
                      <X size={15} />
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="button danger subtle"
                      disabled={r.moveTo === null}
                      onClick={() => remove(r, r.moveTo)}
                    >
                      <Trash2 size={15} />
                      Excluir categoria
                    </button>
                  </div>
                </div>
              );
            return (
              <div className="category-row category-view" key={r.key}>
                <div>
                  <strong>{r.name}</strong>
                  {r.nail_art && <Badge>Nail art · cortesia</Badge>}
                </div>
                <small>{countLabel}</small>
                <button
                  type="button"
                  className="text-button"
                  aria-label={`Editar categoria ${r.name}`}
                  disabled={busy}
                  onClick={() => update(r.key, { mode: 'edit' })}
                >
                  <Pencil size={14} />
                  Editar
                </button>
                <button
                  type="button"
                  className="text-button category-danger"
                  aria-label={`Excluir categoria ${r.name}`}
                  disabled={busy || rows.length < 2}
                  onClick={() => askDelete(r)}
                >
                  <Trash2 size={14} />
                  Excluir
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
              {
                key: Date.now(),
                original: '',
                name: '',
                nail_art: false,
                mode: 'edit',
                moveTo: null,
              },
            ])
          }
        >
          <Plus size={15} />
          Adicionar categoria
        </button>
        <p className="form-note">
          Categorias marcadas como <strong>nail art</strong> são cortesia: não aparecem como serviço
          principal no agendamento. As demais viram opções para a cliente escolher, na ordem desta
          lista. Nada muda até você clicar em <strong>Salvar categorias</strong>.
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
