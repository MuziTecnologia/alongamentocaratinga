'use client';
import { useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Gift,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Search,
  Sparkles,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import { useStudio } from './studio-provider';
import { ServicePhoto } from './service-photo';
import { AddButton, Avatar, Badge, Empty, Modal, PageHeading, SectionHead, Stat } from './ui';
import { AppointmentList, type OpenEditor } from './workspace';
import type { Appointment, Client } from '@/lib/types';
import {
  addDays,
  currency,
  dateKey,
  dateLabel,
  downloadCsv,
  normalizePhone,
  parseCsv,
  today,
  uid,
  whatsapp,
} from '@/lib/utils';

export function ClientsPage({
  onEditor,
  onAppointment,
}: {
  onEditor: OpenEditor;
  onAppointment: (a?: Appointment) => void;
}) {
  const { data, saveMany, busy, notify } = useStudio();
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [selected, setSelected] = useState<string | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [importRows, setImportRows] = useState<Client[]>([]),
    [importError, setImportError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const history = (id: string) =>
    data.appointments
      .filter((a) => a.client_id === id && a.status === 'completed')
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const lastVisit = (id: string) => history(id)[0]?.starts_at;
  const all = data.clients
    .filter(
      (c) =>
        `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(query.toLowerCase()) &&
        (filter === 'all' ||
          (filter === 'birthday'
            ? c.birthday?.slice(5, 7) === today().slice(5, 7)
            : Boolean(lastVisit(c.id)) &&
              dateKey(lastVisit(c.id)!) <= addDays(today(), -Number(filter)))),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const client = data.clients.find((c) => c.id === selected);
  async function readFile(file: File) {
    setImportRows([]);
    setImportError('');
    if (file.size > 2_000_000) {
      setImportError('O CSV deve ter até 2 MB.');
      return;
    }
    try {
      const rows = parseCsv(await file.text());
      const headers =
        rows.shift()?.map((h) =>
          h
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim(),
        ) || [];
      const ni = headers.indexOf('nome'),
        pi = headers.findIndex((h) => ['telefone', 'whatsapp', 'celular'].includes(h)),
        ei = headers.indexOf('email');
      if (ni < 0)
        throw new Error('O CSV precisa de uma coluna chamada nome. Pode incluir telefone e email.');
      if (rows.length > 500) throw new Error('Importe até 500 clientes por arquivo.');
      const phones = new Set(data.clients.map((c) => c.phone).filter(Boolean));
      const parsed = rows
        .map((r, i) => {
          const phone = normalizePhone(r[pi] || ''),
            name = r[ni]?.trim(),
            email = r[ei]?.trim() || '';
          if (!name || name.length < 2 || name.length > 120)
            throw new Error(`Linha ${i + 2}: confira o nome da cliente.`);
          if (phone && !/^\d{10,11}$/.test(phone))
            throw new Error(`Linha ${i + 2}: telefone deve ter DDD e 10 ou 11 dígitos.`);
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            throw new Error(`Linha ${i + 2}: e-mail inválido.`);
          if (phone && phones.has(phone)) return null;
          if (phone) phones.add(phone);
          return {
            id: uid(),
            business_id: data.business.id,
            name,
            phone,
            email,
            birthday: null,
            notes: '',
            created_at: new Date().toISOString(),
          } as Client;
        })
        .filter((c): c is Client => Boolean(c));
      if (!parsed.length)
        throw new Error(
          'Nenhuma cliente nova. Os telefones do arquivo já podem estar cadastrados.',
        );
      setImportRows(parsed);
    } catch (err) {
      setImportError((err as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="CONEXÕES QUE FLORESCEM"
        title="Cada cliente, uma história."
        subtitle="Conheça os detalhes, lembre das preferências e aproxime quem faz parte do seu studio."
        action={
          <div className="heading-actions">
            <button className="button secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} />
              Importar CSV
            </button>
            <AddButton onClick={() => onEditor('clients')}>Nova cliente</AddButton>
          </div>
        }
      />
      <div className="summary-pills">
        <span>
          <Users size={17} />
          <strong>{data.clients.length}</strong> clientes cadastradas
        </span>
        <span>
          <Gift size={17} />
          <strong>
            {data.clients.filter((c) => c.birthday?.slice(5, 7) === today().slice(5, 7)).length}
          </strong>{' '}
          aniversariantes do mês
        </span>
        <span>
          <Sparkles size={17} />
          <strong>{data.clients.filter((c) => history(c.id).length >= 3).length}</strong> clientes
          com 3+ visitas
        </span>
      </div>
      <section className="panel">
        <div className="list-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail"
              aria-label="Buscar clientes"
            />
          </div>
          <button
            className="button secondary small-button"
            onClick={() =>
              downloadCsv('clientes-Alongamentoscaratinga.csv', [
                ['nome', 'telefone', 'email', 'aniversario', 'observacoes'],
                ...all.map((c) => [c.name, c.phone, c.email, c.birthday || '', c.notes]),
              ])
            }
          >
            <Download size={15} />
            Exportar
          </button>
        </div>
        <div className="filter-tabs">
          {[
            ['all', 'Todas as clientes'],
            ['30', 'Há 30+ dias sem vir'],
            ['60', '60+ dias'],
            ['90', '90+ dias'],
            ['birthday', 'Aniversariantes'],
          ].map(([v, l]) => (
            <button key={v} className={filter === v ? 'selected' : ''} onClick={() => setFilter(v)}>
              {l}
              {v === 'all' && <span>{data.clients.length}</span>}
            </button>
          ))}
        </div>
        {all.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Última visita</th>
                  <th>Atendimentos</th>
                  <th>Total em serviços</th>
                  <th>Contato</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {all.map((c) => {
                  const visits = history(c.id),
                    last = visits[0];
                  return (
                    <tr key={c.id}>
                      <td>
                        <button className="table-person" onClick={() => setSelected(c.id)}>
                          <Avatar name={c.name} />
                          <span>
                            <strong>{c.name}</strong>
                            <small>{c.phone || 'Sem telefone cadastrado'}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        {last ? (
                          dateLabel(last.starts_at, {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        ) : (
                          <span className="muted">Ainda não veio</span>
                        )}
                      </td>
                      <td>
                        <span className="count-pill">{visits.length} visitas</span>
                      </td>
                      <td>{currency(visits.reduce((s, a) => s + Number(a.price), 0))}</td>
                      <td>
                        {c.phone ? (
                          <a
                            href={whatsapp(
                              c.phone,
                              `Oi, ${c.name.split(' ')[0]}! Aqui é do ${data.business.name}. Tudo bem?`,
                            )}
                            className="text-button"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle size={16} />
                            WhatsApp
                          </a>
                        ) : (
                          <button className="text-button" onClick={() => onEditor('clients', c)}>
                            Adicionar telefone
                          </button>
                        )}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Editar ${c.name}`}
                          onClick={() => onEditor('clients', c)}
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Vamos fazer novas conexões?"
            text={
              query
                ? 'Nenhuma cliente corresponde à sua busca.'
                : 'Cadastre sua primeira cliente para começar uma nova história.'
            }
            action={<AddButton onClick={() => onEditor('clients')}>Cadastrar cliente</AddButton>}
          />
        )}
      </section>
      {client && (
        <Modal
          title={client.name}
          subtitle="Cada detalhe ajuda a cuidar melhor."
          onClose={() => setSelected(null)}
          wide
        >
          <div className="editor-form">
            <div className="client-profile">
              <Avatar name={client.name} size="large" />
              <div>
                <strong>{client.phone || 'Telefone não cadastrado'}</strong>
                <p>{client.email || 'E-mail não cadastrado'}</p>
                {client.birthday && (
                  <small>
                    <Gift size={13} />
                    Aniversário: {dateLabel(client.birthday, { day: 'numeric', month: 'long' })}
                  </small>
                )}
              </div>
              <button
                className="button secondary small-button"
                onClick={() => {
                  setSelected(null);
                  onEditor('clients', client);
                }}
              >
                <Pencil size={14} />
                Editar cadastro
              </button>
            </div>
            {client.notes && (
              <div className="client-note">
                <Sparkles size={18} />
                <p>{client.notes}</p>
              </div>
            )}
            <div className="summary-pills">
              <span>
                <strong>{history(client.id).length}</strong> visitas concluídas
              </span>
              <span>
                <strong>
                  {currency(history(client.id).reduce((s, a) => s + Number(a.price), 0))}
                </strong>{' '}
                em serviços avulsos
              </span>
            </div>
            <SectionHead title="Histórico de atendimentos" />
            {data.appointments.some((a) => a.client_id === client.id) ? (
              <AppointmentList
                items={data.appointments
                  .filter((a) => a.client_id === client.id)
                  .sort((a, b) => b.starts_at.localeCompare(a.starts_at))}
                onAppointment={(a) => {
                  setSelected(null);
                  onAppointment(a);
                }}
              />
            ) : (
              <p className="muted">Os próximos momentos de cuidado vão aparecer aqui.</p>
            )}
            {data.customer_packages
              .filter((p) => p.client_id === client.id)
              .map((p) => (
                <div className="package-client-row" key={p.id}>
                  <Gift size={20} />
                  <div>
                    <strong>{data.packages.find((d) => d.id === p.package_id)?.name}</strong>
                    <p>
                      {p.sessions_total - p.sessions_used} de {p.sessions_total} sessões disponíveis
                      · válido até {dateLabel(p.expires_at)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </Modal>
      )}
      {importOpen && (
        <Modal
          title="Traga suas clientes para cá"
          subtitle="Importe um arquivo CSV com nome, telefone e email."
          onClose={() => {
            setImportOpen(false);
            setImportRows([]);
            setImportError('');
          }}
        >
          <div className="editor-form">
            <button className="upload-zone" onClick={() => fileInput.current?.click()}>
              <Upload size={30} />
              <strong>Escolher arquivo CSV</strong>
              <span>Até 500 clientes · máximo de 2 MB</span>
            </button>
            <input
              className="sr-only"
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                if (e.target.files?.[0]) void readFile(e.target.files[0]);
              }}
            />
            <button
              className="text-button"
              onClick={() =>
                downloadCsv('modelo-clientes.csv', [
                  ['nome', 'telefone', 'email'],
                  ['Cliente Exemplo', '33999999999', 'cliente@exemplo.com'],
                ])
              }
            >
              <Download size={15} />
              Baixar modelo de planilha
            </button>
            <p className="form-note">
              Telefones duplicados serão ignorados. Você pode exportar suas clientes de outro
              sistema e ajustar as colunas usando o modelo.
            </p>
            {importError && (
              <p className="error-message" role="alert">
                {importError}
              </p>
            )}
            {importRows.length > 0 && (
              <>
                <Badge tone="confirmed">
                  {importRows.length} novas clientes prontas para importar
                </Badge>
                <div className="import-preview">
                  {importRows.slice(0, 5).map((c) => (
                    <div key={c.id}>
                      <span>{c.name}</span>
                      <small>{c.phone}</small>
                    </div>
                  ))}
                </div>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={async () => {
                    if (await saveMany('clients', importRows)) {
                      setImportOpen(false);
                      setImportRows([]);
                      notify('Suas clientes chegaram. Importação concluída!');
                    }
                  }}
                >
                  <Check size={16} />
                  {busy ? 'Importando…' : 'Confirmar importação'}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

export function ServicesPage({ onEditor }: { onEditor: OpenEditor }) {
  const { data } = useStudio();
  const [category, setCategory] = useState('all'),
    [query, setQuery] = useState('');
  const categories = [...new Set(data.services.map((s) => s.category))];
  const services = data.services.filter(
    (s) =>
      (category === 'all' || s.category === category) &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="O SEU TALENTO, EM CADA DETALHE"
        title="Seu menu de cuidados."
        subtitle="Serviços, valores e tempo de dedicação. Tudo com a sua assinatura."
        action={<AddButton onClick={() => onEditor('services')}>Novo serviço</AddButton>}
      />
      <div className="list-toolbar standalone">
        <div className="filter-tabs no-border">
          <button
            className={category === 'all' ? 'selected' : ''}
            onClick={() => setCategory('all')}
          >
            Todos os serviços <span>{data.services.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? 'selected' : ''}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="search-box narrow">
          <Search size={17} />
          <input
            aria-label="Buscar serviços"
            placeholder="Buscar serviço…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="service-grid">
        {services.map((s) => (
          <article className={`service-card ${s.photo_url ? 'has-photo' : ''}`} key={s.id}>
            <div className="service-card-top">
              <ServicePhoto
                service={s}
                className={s.photo_url ? 'service-cover-photo' : 'service-symbol'}
              />
              <button
                className="icon-button"
                aria-label={`Editar ${s.name}`}
                onClick={() => onEditor('services', s)}
              >
                <MoreHorizontal size={21} />
              </button>
            </div>
            <span className="eyebrow">{s.category}</span>
            <h2>{s.name}</h2>
            <p>{s.description || 'Um cuidado especial, do seu jeito.'}</p>
            <div className="service-card-footer">
              <strong>{currency(s.price)}</strong>
              <span>
                <Clock3 size={14} />
                {s.duration} min
              </span>
            </div>
            <div className="service-status">
              <span className={`live-dot ${s.active ? '' : 'inactive'}`} />
              {s.active ? 'Disponível no agendamento' : 'Serviço desativado'}
              <button className="text-button" onClick={() => onEditor('services', s)}>
                Editar <Pencil size={13} />
              </button>
            </div>
          </article>
        ))}
        <button className="add-card" onClick={() => onEditor('services')}>
          <span>＋</span>
          <strong>Um novo cuidado</strong>
          <small>Adicione um serviço ao seu menu</small>
        </button>
      </div>
      {!services.length && query && <Empty text="Nenhum serviço corresponde à sua busca." />}
    </>
  );
}

export function PackagesPage({ onEditor }: { onEditor: OpenEditor }) {
  const { data } = useStudio();
  const [tab, setTab] = useState('catalog');
  return (
    <>
      <PageHeading
        eyebrow="CUIDADO QUE CONTINUA"
        title="Mais motivos para voltar."
        subtitle="Transforme visitas em uma rotina de autocuidado com pacotes de sessões."
        action={
          <div className="heading-actions">
            <button className="button secondary" onClick={() => onEditor('packages')}>
              <Gift size={16} />
              Criar pacote
            </button>
            <AddButton onClick={() => onEditor('customer_packages')}>Vender pacote</AddButton>
          </div>
        }
      />
      <div className="filter-tabs standalone-tabs">
        {[
          ['catalog', 'Meus pacotes'],
          ['clients', 'Pacotes das clientes'],
        ].map(([v, l]) => (
          <button key={v} className={tab === v ? 'selected' : ''} onClick={() => setTab(v)}>
            {l}
            <span>{v === 'catalog' ? data.packages.length : data.customer_packages.length}</span>
          </button>
        ))}
      </div>
      {tab === 'catalog' ? (
        <div className="service-grid">
          {data.packages.map((p) => {
            const s = data.services.find((s) => s.id === p.service_id),
              saving = (s?.price || 0) * p.sessions - p.price;
            return (
              <article className="package-card" key={p.id}>
                <div className="service-card-top">
                  <div className="service-symbol">
                    <Gift size={24} strokeWidth={1.3} />
                  </div>
                  <Badge tone={p.active ? 'confirmed' : ''}>
                    {p.active ? 'Ativo' : 'Desativado'}
                  </Badge>
                </div>
                <span className="eyebrow">UM COMPROMISSO COM O CUIDADO</span>
                <h2>{p.name}</h2>
                <p>
                  {s?.name} · {p.sessions} sessões
                </p>
                <div className="package-price">
                  <strong>{currency(p.price)}</strong>
                  <span>{currency(p.price / p.sessions)} por sessão</span>
                </div>
                {saving > 0 && <Badge tone="light">Economia de {currency(saving)}</Badge>}
                <div className="package-details">
                  <span>
                    <Clock3 size={15} />
                    Válido por {p.validity_days} dias
                  </span>
                  <span>
                    <Check size={15} />
                    Controle automático das sessões
                  </span>
                </div>
                <button
                  className="button secondary full-width"
                  onClick={() => onEditor('packages', p)}
                >
                  <Pencil size={15} />
                  Editar pacote
                </button>
              </article>
            );
          })}
          <button className="add-card" onClick={() => onEditor('packages')}>
            <span>＋</span>
            <strong>Um cuidado recorrente</strong>
            <small>Crie seu próximo pacote</small>
          </button>
        </div>
      ) : (
        <section className="panel">
          {data.customer_packages.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente e pacote</th>
                    <th>Sessões disponíveis</th>
                    <th>Validade</th>
                    <th>Pagamento</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.customer_packages.map((p) => {
                    const c = data.clients.find((c) => c.id === p.client_id),
                      definition = data.packages.find((d) => d.id === p.package_id);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="table-person">
                            <Avatar name={c?.name || 'Cliente'} />
                            <span>
                              <strong>{c?.name}</strong>
                              <small>{definition?.name}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="session-progress">
                            <strong>
                              {p.sessions_total - p.sessions_used} de {p.sessions_total}
                            </strong>
                            <div>
                              <i
                                style={{
                                  width: `${((p.sessions_total - p.sessions_used) / p.sessions_total) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span>
                            {dateLabel(p.expires_at, {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          {p.expires_at < today() && <Badge tone="cancelled">Vencido</Badge>}
                        </td>
                        <td>
                          <Badge tone={p.paid ? 'confirmed' : 'pending'}>
                            {p.paid ? 'Recebido' : 'Pendente'}
                          </Badge>
                          <small className="table-small">{currency(p.price)}</small>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Editar pacote de ${c?.name}`}
                            onClick={() => onEditor('customer_packages', p)}
                          >
                            <Pencil size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="O cuidado pode durar mais"
              text="Venda um pacote e acompanhe as sessões de cada cliente aqui."
              action={
                <AddButton onClick={() => onEditor('customer_packages')}>
                  Vender primeiro pacote
                </AddButton>
              }
            />
          )}
        </section>
      )}
      <p className="page-note">
        <Gift size={16} />
        Para usar uma sessão, selecione o pacote no agendamento da cliente. Ela será descontada
        quando o atendimento for concluído.
      </p>
    </>
  );
}

export function FinancePage({ onEditor }: { onEditor: OpenEditor }) {
  const { data } = useStudio();
  const [month, setMonth] = useState(today().slice(0, 7)),
    [filter, setFilter] = useState('all');
  const paid = data.appointments.filter(
    (a) =>
      a.kind === 'booking' &&
      a.status === 'completed' &&
      a.payment_status === 'paid' &&
      dateKey(a.starts_at).startsWith(month) &&
      Number(a.price) > 0,
  );
  const packs = data.customer_packages.filter((p) => p.paid && p.purchased_at.startsWith(month));
  const manual = data.transactions.filter((t) => t.date.startsWith(month));
  const rows = [
    ...paid.map((a) => ({
      id: a.id,
      date: dateKey(a.starts_at),
      description: `${data.services.find((s) => s.id === a.service_id)?.name} · ${data.clients.find((c) => c.id === a.client_id)?.name}`,
      type: 'income',
      category: 'Atendimento',
      amount: Number(a.price),
      payment_method: a.payment_method,
      editable: false,
    })),
    ...packs.map((p) => ({
      id: p.id,
      date: p.purchased_at,
      description: `${data.packages.find((d) => d.id === p.package_id)?.name} · ${data.clients.find((c) => c.id === p.client_id)?.name}`,
      type: 'income',
      category: 'Pacote',
      amount: Number(p.price),
      payment_method: 'Venda de pacote',
      editable: false,
    })),
    ...manual.map((t) => ({ ...t, editable: true })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const income = rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0),
    expense = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const pending =
    data.appointments
      .filter(
        (a) =>
          a.kind === 'booking' &&
          !['cancelled', 'no_show'].includes(a.status) &&
          a.payment_status === 'pending' &&
          dateKey(a.starts_at).startsWith(month),
      )
      .reduce((s, a) => s + Number(a.price), 0) +
    data.customer_packages
      .filter((p) => !p.paid && p.purchased_at.startsWith(month))
      .reduce((s, p) => s + Number(p.price), 0);
  const filtered = rows.filter((r) => filter === 'all' || r.type === filter);
  function moveMonth(delta: number) {
    const date = new Date(`${month}-15T12:00:00-03:00`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    setMonth(dateKey(date).slice(0, 7));
  }
  return (
    <>
      <PageHeading
        eyebrow="SEU TRABALHO, SEU CRESCIMENTO"
        title="O cuidado também rende."
        subtitle="Entenda o que entra, o que sai e os frutos do seu trabalho."
        action={<AddButton onClick={() => onEditor('transactions')}>Novo lançamento</AddButton>}
      />
      <div className="finance-period">
        <button className="icon-button" aria-label="Mês anterior" onClick={() => moveMonth(-1)}>
          <ChevronLeft size={18} />
        </button>
        <h2>{dateLabel(`${month}-15`, { month: 'long', year: 'numeric' })}</h2>
        <button className="icon-button" aria-label="Próximo mês" onClick={() => moveMonth(1)}>
          <ChevronRight size={18} />
        </button>
        <input
          aria-label="Selecionar mês financeiro"
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
        />
        <button
          className="button secondary small-button"
          onClick={() =>
            downloadCsv(`financeiro-${month}.csv`, [
              ['Data', 'Descrição', 'Tipo', 'Categoria', 'Valor', 'Pagamento'],
              ...filtered.map((r) => [
                r.date,
                r.description,
                r.type === 'income' ? 'Receita' : 'Despesa',
                r.category,
                r.amount,
                r.payment_method,
              ]),
            ])
          }
        >
          <Download size={15} />
          Exportar extrato
        </button>
      </div>
      <div className="stats-grid">
        <Stat
          label="Entradas recebidas"
          value={currency(income)}
          detail="Serviços, pacotes e receitas avulsas"
          icon={<ArrowDownLeft size={19} />}
          positive
        />
        <Stat
          label="Saídas registradas"
          value={currency(expense)}
          detail="Despesas do studio neste mês"
          icon={<ArrowUpRight size={19} />}
        />
        <Stat
          label="Saldo do mês"
          value={currency(income - expense)}
          detail="Entradas menos despesas registradas"
          icon={<Wallet size={19} />}
          positive={income >= expense}
        />
        <Stat
          label="A receber"
          value={currency(pending)}
          detail="Atendimentos e pacotes em aberto"
          icon={<Clock3 size={19} />}
        />
      </div>
      <section className="panel">
        <div className="list-toolbar">
          <SectionHead title="Movimentações" subtitle="Um retrato claro do seu mês." />
          <div className="segmented">
            <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>
              Todas
            </button>
            <button
              className={filter === 'income' ? 'selected' : ''}
              onClick={() => setFilter('income')}
            >
              Entradas
            </button>
            <button
              className={filter === 'expense' ? 'selected' : ''}
              onClick={() => setFilter('expense')}
            >
              Saídas
            </button>
          </div>
        </div>
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Pagamento</th>
                  <th className="text-right">Valor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="finance-description">
                        <span className={`transaction-icon ${r.type}`}>
                          {r.type === 'income' ? (
                            <ArrowDownLeft size={17} />
                          ) : (
                            <ArrowUpRight size={17} />
                          )}
                        </span>
                        <strong>{r.description}</strong>
                      </div>
                    </td>
                    <td>{dateLabel(r.date, { day: '2-digit', month: 'short' })}</td>
                    <td>
                      <Badge>{r.category}</Badge>
                    </td>
                    <td>{r.payment_method || 'Não informado'}</td>
                    <td
                      className={`money-cell text-right ${r.type === 'income' ? 'positive' : ''}`}
                    >
                      {r.type === 'income' ? '+' : '−'} {currency(r.amount)}
                    </td>
                    <td>
                      {r.editable && (
                        <button
                          className="icon-button"
                          aria-label={`Editar ${r.description}`}
                          onClick={() =>
                            onEditor(
                              'transactions',
                              data.transactions.find((t) => t.id === r.id),
                            )
                          }
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Um mês para começar"
            text="As receitas aparecem quando você conclui um atendimento e marca o pagamento como recebido."
          />
        )}
      </section>
      <section className="panel commission-panel">
        <SectionHead
          title="A dedicação de cada profissional"
          subtitle="Produção e comissão sobre atendimentos concluídos e pagos no período."
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Profissional</th>
                <th>Atendimentos</th>
                <th>Produção</th>
                <th>Comissão</th>
                <th className="text-right">Valor da comissão</th>
              </tr>
            </thead>
            <tbody>
              {data.professionals.map((p) => {
                const visits = paid.filter((a) => a.professional_id === p.id),
                  production = visits.reduce((s, a) => s + Number(a.price), 0);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="table-person">
                        <Avatar name={p.name} color={p.color + '40'} />
                        <strong>{p.name}</strong>
                      </div>
                    </td>
                    <td>{visits.length}</td>
                    <td>{currency(production)}</td>
                    <td>{p.commission}%</td>
                    <td className="text-right">{currency((production * p.commission) / 100)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="form-note table-note">
          Comissões são uma previsão e não são descontadas do saldo automaticamente. Registre o
          pagamento como despesa para refletir a saída no caixa. Sessões de pacotes não geram
          receita ou comissão duplicada.
        </p>
      </section>
    </>
  );
}

export function TeamPage({ onEditor }: { onEditor: OpenEditor }) {
  const { data } = useStudio();
  const month = today().slice(0, 7);
  return (
    <>
      <PageHeading
        eyebrow="QUEM FAZ A MAGIA ACONTECER"
        title="Talentos que se encontram."
        subtitle="Uma agenda para cada profissional, um studio em sintonia."
        action={<AddButton onClick={() => onEditor('professionals')}>Nova profissional</AddButton>}
      />
      <div className="service-grid">
        {data.professionals.map((p) => {
          const appts = data.appointments.filter(
            (a) =>
              a.professional_id === p.id &&
              a.kind === 'booking' &&
              a.status === 'completed' &&
              dateKey(a.starts_at).startsWith(month),
          );
          return (
            <article className="team-card" key={p.id}>
              <div className="team-cover" style={{ background: p.color + '30' }}>
                <span className="team-decoration">✳</span>
                <button
                  className="icon-button"
                  aria-label={`Editar ${p.name}`}
                  onClick={() => onEditor('professionals', p)}
                >
                  <MoreHorizontal size={21} />
                </button>
              </div>
              <div className="team-body">
                <Avatar name={p.name} color={p.color + '55'} size="large" />
                <Badge tone={p.active ? 'confirmed' : ''}>{p.active ? 'Ativa' : 'Inativa'}</Badge>
                <h2>{p.name}</h2>
                <p>{p.role}</p>
                <div className="team-metrics">
                  <div>
                    <strong>{appts.length}</strong>
                    <span>atendimentos no mês</span>
                  </div>
                  <div>
                    <strong>{p.commission}%</strong>
                    <span>de comissão</span>
                  </div>
                </div>
                <button
                  className="button secondary full-width"
                  onClick={() => onEditor('professionals', p)}
                >
                  <Pencil size={15} />
                  Editar profissional
                </button>
              </div>
            </article>
          );
        })}
        <button className="add-card" onClick={() => onEditor('professionals')}>
          <span>＋</span>
          <strong>Novos talentos</strong>
          <small>Adicione alguém à equipe</small>
        </button>
      </div>
      <p className="page-note">
        <Users size={16} />
        Cada profissional tem sua agenda e percentual de comissão. A administração é feita pela
        conta da proprietária do studio.
      </p>
    </>
  );
}
