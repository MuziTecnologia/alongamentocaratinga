'use client';
import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { Appointment, TableName, TableMap } from '@/lib/types';
import {
  addDays,
  atTime,
  dateKey,
  normalizePhone,
  statusLabels,
  timeLabel,
  today,
  uid,
} from '@/lib/utils';
import { Field, FormActions, Modal, formValues, numberValue, value } from './ui';
import { useStudio } from './studio-provider';
import { ServicePhotoPicker } from './service-photo-picker';
import { uploadStudioImage, validatePhotoUrl } from '@/lib/studio-images';
export type EditorKind =
  | 'clients'
  | 'services'
  | 'professionals'
  | 'packages'
  | 'transactions'
  | 'customer_packages'
  | 'gallery';
const names: Record<EditorKind, string> = {
  clients: 'cliente',
  services: 'serviço',
  professionals: 'profissional',
  packages: 'pacote',
  transactions: 'lançamento',
  customer_packages: 'pacote da cliente',
  gallery: 'foto da galeria',
};
type EditorRow = Partial<TableMap[EditorKind]> & Record<string, unknown>;
export function EntityEditor({
  kind,
  initial,
  onClose,
}: {
  kind: EditorKind;
  initial?: EditorRow;
  onClose: () => void;
}) {
  const { data, save, remove, notify, busy, demo } = useStudio();
  const row = initial || {};
  const [err, setErr] = useState(''),
    [confirmDelete, setConfirmDelete] = useState(false);
  const [packageId, setPackageId] = useState(
    String(row.package_id || data.packages.find((p) => p.active)?.id || ''),
  );
  const text = (key: string, fallback = '') => String(row[key] ?? fallback);
  const [photoUrl, setPhotoUrl] = useState(text('photo_url'));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    const form = formValues(event);
    if (photoUploading || busy) return;
    setErr('');
    const common = { id: text('id') || uid(), business_id: data.business.id };
    let record: unknown;
    switch (kind) {
      case 'clients': {
        const phone = normalizePhone(value(form, 'phone'));
        if (phone && !/^\d{10,11}$/.test(phone)) {
          setErr('Informe DDD e telefone com 10 ou 11 dígitos.');
          return;
        }
        if (phone && data.clients.some((c) => c.phone === phone && c.id !== common.id)) {
          setErr('Já existe uma cliente com esse telefone.');
          return;
        }
        record = {
          ...common,
          name: value(form, 'name'),
          phone,
          email: value(form, 'email'),
          birthday: value(form, 'birthday') || null,
          notes: value(form, 'notes'),
          created_at: text('created_at', new Date().toISOString()),
        };
        break;
      }
      case 'services': {
        let savedPhotoUrl = photoUrl.trim();
        try {
          if (photoFile) {
            setPhotoUploading(true);
            savedPhotoUrl = await uploadStudioImage(photoFile, data.business.id, demo);
            setPhotoUrl(savedPhotoUrl);
            setPhotoFile(null);
          }
          validatePhotoUrl(savedPhotoUrl, demo);
        } catch (error) {
          setErr((error as Error).message);
          return;
        } finally {
          setPhotoUploading(false);
        }
        record = {
          ...common,
          name: value(form, 'name'),
          description: value(form, 'description'),
          category: value(form, 'category'),
          duration: numberValue(form, 'duration'),
          price: numberValue(form, 'price'),
          color: value(form, 'color'),
          active: form.get('active') === 'on',
          photo_url: savedPhotoUrl,
        };
        break;
      }
      case 'professionals':
        record = {
          ...common,
          name: value(form, 'name'),
          role: value(form, 'role'),
          color: value(form, 'color'),
          commission: numberValue(form, 'commission'),
          active: form.get('active') === 'on',
        };
        break;
      case 'packages':
        record = {
          ...common,
          name: value(form, 'name'),
          service_id: value(form, 'service_id'),
          sessions: numberValue(form, 'sessions'),
          price: numberValue(form, 'price'),
          validity_days: numberValue(form, 'validity_days'),
          active: form.get('active') === 'on',
        };
        break;
      case 'transactions':
        record = {
          ...common,
          type: value(form, 'type'),
          description: value(form, 'description'),
          category: value(form, 'category'),
          amount: numberValue(form, 'amount'),
          date: value(form, 'date'),
          payment_method: value(form, 'payment_method'),
        };
        break;
      case 'customer_packages': {
        const p = data.packages.find((p) => p.id === packageId);
        if (!p) {
          setErr('Cadastre um pacote antes de vinculá-lo a uma cliente.');
          return;
        }
        record = {
          ...common,
          package_id: p.id,
          client_id: value(form, 'client_id'),
          sessions_used: Number(row.sessions_used || 0),
          sessions_total: Number(row.sessions_total || p.sessions),
          price: numberValue(form, 'price'),
          purchased_at: value(form, 'purchased_at'),
          expires_at: value(form, 'expires_at'),
          paid: form.get('paid') === 'on',
        };
        break;
      }
      case 'gallery': {
        const url = value(form, 'url');
        try {
          if (new URL(url).protocol !== 'https:') throw new Error();
        } catch {
          setErr('Use uma URL de imagem com HTTPS.');
          return;
        }
        record = { ...common, url, caption: value(form, 'caption') };
        break;
      }
    }
    if (await save(kind, record as never)) onClose();
  }
  async function deleteRow() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (await remove(kind as TableName, text('id'))) onClose();
  }
  const colorField = (
    <Field label="Cor na agenda">
      <input type="color" name="color" defaultValue={text('color', '#cbdcc5')} />
    </Field>
  );
  const activeField = (
    <label className="check-field">
      <input type="checkbox" name="active" defaultChecked={row.active !== false} />
      <span>Ativo e disponível para novos agendamentos</span>
    </label>
  );
  const pack = data.packages.find((p) => p.id === packageId);
  return (
    <Modal
      title={`${row.id ? 'Editar' : kind === 'customer_packages' ? 'Vender' : 'Novo cadastro de'} ${names[kind]}`}
      subtitle="Os pequenos detalhes fazem toda a diferença."
      onClose={onClose}
    >
      <form onSubmit={submit} className="editor-form">
        {['clients', 'services', 'professionals', 'packages'].includes(kind) && (
          <Field label="Nome">
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={text('name')}
              placeholder={
                kind === 'clients' ? 'Nome completo da cliente' : 'Como vai aparecer no sistema'
              }
            />
          </Field>
        )}
        {kind === 'clients' && (
          <>
            <div className="form-grid">
              <Field label="WhatsApp com DDD">
                <input
                  name="phone"
                  type="tel"
                  defaultValue={text('phone')}
                  placeholder="(33) 99999-9999"
                />
              </Field>
              <Field label="Aniversário">
                <input name="birthday" type="date" defaultValue={text('birthday')} max={today()} />
              </Field>
            </div>
            <Field label="E-mail (opcional)">
              <input
                type="email"
                name="email"
                maxLength={254}
                defaultValue={text('email')}
                placeholder="cliente@email.com"
              />
            </Field>
            <Field label="Preferências e observações">
              <textarea
                name="notes"
                rows={3}
                defaultValue={text('notes')}
                placeholder="Formato favorito, cores preferidas, cuidados especiais…"
              />
            </Field>
          </>
        )}
        {kind === 'services' && (
          <>
            <ServicePhotoPicker
              url={photoUrl}
              file={photoFile}
              demo={demo}
              disabled={busy || photoUploading}
              onError={setErr}
              onChange={(url, file) => {
                setPhotoUrl(url);
                setPhotoFile(file);
              }}
            />
            <Field label="Descrição">
              <textarea
                name="description"
                rows={2}
                defaultValue={text('description')}
                placeholder="Conte um pouco sobre esse cuidado"
              />
            </Field>
            <div className="form-grid">
              <Field label="Valor (R$)">
                <input
                  name="price"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={text('price', '70')}
                />
              </Field>
              <Field label="Duração em minutos">
                <input
                  name="duration"
                  required
                  type="number"
                  min="15"
                  max="480"
                  step="5"
                  defaultValue={text('duration', '60')}
                />
              </Field>
              <Field label="Categoria">
                <input
                  name="category"
                  required
                  defaultValue={text('category', 'Cuidados')}
                  list="categories"
                />
                <datalist id="categories">
                  <option>Alongamento</option>
                  <option>Esmaltação</option>
                  <option>Cuidados</option>
                  <option>Nail art</option>
                </datalist>
              </Field>
              {colorField}
            </div>
            {activeField}
          </>
        )}
        {kind === 'professionals' && (
          <>
            <Field label="Especialidade">
              <input name="role" required defaultValue={text('role', 'Nail designer')} />
            </Field>
            <div className="form-grid">
              <Field label="Comissão (%)" hint="Calculada sobre atendimentos concluídos e pagos.">
                <input
                  name="commission"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  defaultValue={text('commission', '0')}
                />
              </Field>
              {colorField}
            </div>
            {activeField}
          </>
        )}
        {kind === 'packages' && (
          <>
            <Field label="Serviço do pacote">
              <select
                name="service_id"
                required
                defaultValue={text('service_id', data.services.find((s) => s.active)?.id)}
              >
                <option value="">Selecione o serviço</option>
                {data.services
                  .filter((s) => s.active || s.id === row.service_id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Número de sessões">
                <input
                  name="sessions"
                  required
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={text('sessions', '4')}
                />
              </Field>
              <Field label="Preço do pacote (R$)">
                <input
                  name="price"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={text('price', '240')}
                />
              </Field>
              <Field label="Validade em dias">
                <input
                  name="validity_days"
                  required
                  type="number"
                  min="1"
                  max="730"
                  defaultValue={text('validity_days', '60')}
                />
              </Field>
            </div>
            {activeField}
          </>
        )}
        {kind === 'transactions' && (
          <>
            <div className="form-grid">
              <Field label="Tipo">
                <select name="type" defaultValue={text('type', 'expense')}>
                  <option value="expense">Despesa</option>
                  <option value="income">Receita avulsa</option>
                </select>
              </Field>
              <Field label="Data">
                <input type="date" required name="date" defaultValue={text('date', today())} />
              </Field>
            </div>
            <Field label="Descrição">
              <input
                name="description"
                required
                maxLength={200}
                defaultValue={text('description')}
                placeholder="Ex.: reposição de esmaltes"
              />
            </Field>
            <div className="form-grid">
              <Field label="Valor (R$)">
                <input
                  name="amount"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={text('amount')}
                />
              </Field>
              <Field label="Categoria">
                <select name="category" defaultValue={text('category', 'Materiais')}>
                  {[
                    'Materiais',
                    'Aluguel',
                    'Contas',
                    'Marketing',
                    'Venda de produtos',
                    'Outros',
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <PaymentField defaultValue={text('payment_method', 'Pix')} />
          </>
        )}
        {kind === 'customer_packages' && (
          <>
            <Field label="Cliente">
              <select name="client_id" required defaultValue={text('client_id')}>
                <option value="">Selecione a cliente</option>
                {data.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pacote">
              <select
                name="package_id"
                required
                value={packageId}
                disabled={Boolean(row.id)}
                onChange={(event) => setPackageId(event.target.value)}
              >
                <option value="">Selecione o pacote</option>
                {data.packages
                  .filter((p) => p.active || p.id === row.package_id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.sessions} sessões
                    </option>
                  ))}
              </select>
            </Field>
            <div className="form-grid" key={packageId}>
              <Field label="Preço combinado (R$)">
                <input
                  name="price"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={text('price', String(pack?.price || 0))}
                />
              </Field>
              <Field label="Data da compra">
                <input
                  name="purchased_at"
                  required
                  type="date"
                  defaultValue={text('purchased_at', today())}
                />
              </Field>
              <Field label="Válido até">
                <input
                  name="expires_at"
                  required
                  type="date"
                  defaultValue={text('expires_at', addDays(today(), pack?.validity_days || 60))}
                />
              </Field>
            </div>
            <label className="check-field">
              <input type="checkbox" name="paid" defaultChecked={row.paid !== false} />
              Pagamento recebido
            </label>
            <p className="form-note">
              O valor entra no financeiro uma única vez. Cada sessão é descontada ao concluir um
              atendimento vinculado a este pacote.
            </p>
          </>
        )}
        {kind === 'gallery' && (
          <>
            <Field
              label="Link da imagem (HTTPS)"
              hint="Use uma imagem sua já hospedada, por exemplo no Supabase Storage."
            >
              <input
                name="url"
                type="url"
                required
                defaultValue={text('url')}
                placeholder="https://…/minha-nail-art.jpg"
              />
            </Field>
            <Field label="Descrição da foto">
              <input
                name="caption"
                required
                maxLength={160}
                defaultValue={text('caption')}
                placeholder="Alongamento delicado com francesinha"
              />
            </Field>
          </>
        )}
        {err && (
          <p className="error-message" role="alert">
            {err}
          </p>
        )}
        <FormActions
          pending={photoUploading}
          onClose={onClose}
          extra={
            row.id && (
              <button
                type="button"
                className="button danger subtle push-right"
                disabled={busy}
                onClick={deleteRow}
              >
                <Trash2 size={16} />
                {confirmDelete ? 'Confirmar exclusão' : 'Excluir'}
              </button>
            )
          }
        />
      </form>
    </Modal>
  );
}
function PaymentField({ defaultValue }: { defaultValue: string }) {
  const { data } = useStudio();
  return (
    <Field label="Forma de pagamento">
      <select name="payment_method" defaultValue={defaultValue}>
        {[...new Set([...data.business.payment_methods, defaultValue])].filter(Boolean).map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
    </Field>
  );
}
export function AppointmentEditor({
  initial,
  selectedDate,
  block = false,
  onClose,
}: {
  initial?: Appointment;
  selectedDate?: string;
  block?: boolean;
  onClose: () => void;
}) {
  const { data, save, remove, busy } = useStudio();
  const isBlock = initial?.kind === 'block' || block;
  const [serviceId, setServiceId] = useState(
    initial?.service_id || data.services.find((s) => s.active)?.id || '',
  );
  const service = data.services.find((s) => s.id === serviceId);
  const [price, setPrice] = useState(initial?.price ?? service?.price ?? 0),
    [duration, setDuration] = useState(
      initial
        ? (new Date(initial.ends_at).getTime() - new Date(initial.starts_at).getTime()) / 60000
        : service?.duration || 60,
    );
  const [clientId, setClientId] = useState(initial?.client_id || ''),
    [newClient, setNewClient] = useState(false),
    [packId, setPackId] = useState(initial?.customer_package_id || ''),
    [err, setErr] = useState('');
  const packs = data.customer_packages.filter(
    (p) =>
      p.client_id === clientId &&
      data.packages.find((def) => def.id === p.package_id)?.service_id === serviceId &&
      (p.sessions_used < p.sessions_total || p.id === initial?.customer_package_id) &&
      p.expires_at >= today(),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    const form = formValues(event);
    setErr('');
    let customer = clientId;
    if (!isBlock && newClient) {
      const phone = normalizePhone(value(form, 'new_phone'));
      if (phone && !/^\d{10,11}$/.test(phone)) {
        setErr('Confira o WhatsApp: DDD e número, com 10 ou 11 dígitos.');
        return;
      }
      const existing = phone ? data.clients.find((c) => c.phone === phone) : null;
      if (existing) {
        customer = existing.id;
        setClientId(existing.id);
        setNewClient(false);
      } else {
        customer = uid();
        const saved = await save('clients', {
          id: customer,
          business_id: data.business.id,
          name: value(form, 'new_name'),
          phone,
          email: '',
          birthday: null,
          notes: '',
          created_at: new Date().toISOString(),
        });
        if (!saved) return;
        setClientId(customer);
        setNewClient(false);
      }
    }
    const starts = atTime(value(form, 'date'), value(form, 'time'));
    const record: Appointment = {
      id: initial?.id || uid(),
      business_id: data.business.id,
      professional_id: value(form, 'professional_id'),
      client_id: isBlock ? null : customer,
      service_id: isBlock ? null : serviceId,
      starts_at: starts,
      ends_at: new Date(new Date(starts).getTime() + duration * 60000).toISOString(),
      price: isBlock || packId ? 0 : price,
      status: (value(form, 'status') || 'confirmed') as Appointment['status'],
      payment_status: (value(form, 'payment_status') as Appointment['payment_status']) || 'pending',
      payment_method: value(form, 'payment_method'),
      notes: value(form, 'notes'),
      kind: isBlock ? 'block' : 'booking',
      source: initial?.source || 'panel',
      customer_package_id: packId || null,
      reminder_sent_at: initial?.reminder_sent_at || null,
    };
    if (await save('appointments', record)) onClose();
  }
  return (
    <Modal
      title={
        isBlock
          ? 'Bloquear um horário'
          : initial
            ? 'Detalhes do atendimento'
            : 'Um novo momento de cuidado'
      }
      subtitle={
        isBlock
          ? 'Reserve um intervalo para você. Esse horário ficará indisponível.'
          : 'Tudo pronto para receber sua cliente.'
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="editor-form">
        {!isBlock && (
          <>
            <div className="field-heading">
              <span>Cliente</span>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setNewClient(!newClient);
                  setPackId('');
                }}
              >
                {newClient ? 'Escolher cadastrada' : '+ Cadastrar nova'}
              </button>
            </div>
            {newClient ? (
              <div className="inset form-grid">
                <Field label="Nome da cliente">
                  <input name="new_name" required minLength={2} maxLength={120} />
                </Field>
                <Field label="WhatsApp">
                  <input name="new_phone" type="tel" />
                </Field>
              </div>
            ) : (
              <select
                aria-label="Cliente"
                required
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setPackId('');
                }}
              >
                <option value="">Selecione uma cliente</option>
                {data.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <Field label="Serviço">
              <select
                required
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setPackId('');
                  const s = data.services.find((s) => s.id === e.target.value);
                  if (s) {
                    setPrice(s.price);
                    setDuration(s.duration);
                  }
                }}
              >
                <option value="">Selecione o serviço</option>
                {data.services
                  .filter((s) => s.active || s.id === serviceId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
          </>
        )}
        <div className="form-grid">
          <Field label="Data">
            <input
              type="date"
              name="date"
              required
              defaultValue={initial ? dateKey(initial.starts_at) : selectedDate || today()}
            />
          </Field>
          <Field label="Horário">
            <input
              type="time"
              name="time"
              required
              defaultValue={initial ? timeLabel(initial.starts_at) : '09:00'}
            />
          </Field>
          <Field label="Duração (minutos)">
            <input
              type="number"
              name="duration"
              min="15"
              max="720"
              step="5"
              required
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </Field>
          <Field label="Profissional">
            <select
              name="professional_id"
              required
              defaultValue={
                initial?.professional_id || data.professionals.find((p) => p.active)?.id
              }
            >
              <option value="">Selecione</option>
              {data.professionals
                .filter((p) => p.active || p.id === initial?.professional_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        {!isBlock && (
          <>
            <div className="form-grid">
              <Field label="Status">
                <select name="status" defaultValue={initial?.status || 'confirmed'}>
                  {Object.entries(statusLabels).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor (R$)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  disabled={Boolean(packId)}
                  value={packId ? 0 : price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
              </Field>
              <Field label="Pagamento">
                <select name="payment_status" defaultValue={initial?.payment_status || 'pending'}>
                  <option value="pending">A receber</option>
                  <option value="paid">Recebido</option>
                </select>
              </Field>
              <PaymentField defaultValue={initial?.payment_method || 'Pix'} />
            </div>
            {packs.length > 0 && !newClient && (
              <Field label="Utilizar pacote">
                <select value={packId} onChange={(e) => setPackId(e.target.value)}>
                  <option value="">Atendimento avulso</option>
                  {packs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {data.packages.find((d) => d.id === p.package_id)?.name} ·{' '}
                      {p.sessions_total - p.sessions_used} sessões restantes
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {packId && (
              <p className="form-note">
                A sessão será descontada ao concluir o atendimento. O valor já pertence à venda do
                pacote.
              </p>
            )}
          </>
        )}
        <Field label={isBlock ? 'Motivo do bloqueio' : 'Observações'}>
          <textarea
            name="notes"
            rows={2}
            defaultValue={initial?.notes || ''}
            placeholder={
              isBlock
                ? 'Ex.: compromisso pessoal, almoço, descanso…'
                : 'Algo que precisamos lembrar?'
            }
            required={isBlock}
          />
        </Field>
        {err && (
          <p className="error-message" role="alert">
            {err}
          </p>
        )}
        <FormActions
          onClose={onClose}
          label={
            initial ? 'Salvar alterações' : isBlock ? 'Bloquear horário' : 'Agendar atendimento'
          }
          extra={
            isBlock &&
            initial && (
              <button
                className="button danger subtle push-right"
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (await remove('appointments', initial.id)) onClose();
                }}
              >
                Remover bloqueio
              </button>
            )
          }
        />
      </form>
    </Modal>
  );
}
