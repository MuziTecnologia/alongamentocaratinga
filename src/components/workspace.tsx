'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  ExternalLink,
  Flower2,
  Gift,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useStudio } from './studio-provider';
import {
  AddButton,
  Avatar,
  Badge,
  Brand,
  Empty,
  Modal,
  PageHeading,
  SectionHead,
  Stat,
} from './ui';
import { AppointmentEditor, EntityEditor, type EditorKind } from './editors';
import type { Appointment, Client, TableMap } from '@/lib/types';
import {
  addDays,
  currency,
  dateKey,
  dateLabel,
  downloadCsv,
  statusLabels,
  timeLabel,
  today,
  whatsapp,
} from '@/lib/utils';
import { getSupabase } from '@/lib/supabase/client';
import { ClientsPage, ServicesPage, PackagesPage, FinancePage, TeamPage } from './workspace-pages';
import { SettingsPage, WebsitePage } from './workspace-settings';
import { UpcomingConfirmations } from './session-confirmations';
const nav = [
  { id: 'inicio', label: 'Visão geral', icon: LayoutDashboard, href: '/' },
  { id: 'agenda', label: 'Minha agenda', icon: CalendarDays, href: '/painel/agenda' },
  { id: 'clientes', label: 'Clientes', icon: Users, href: '/painel/clientes' },
  { id: 'servicos', label: 'Serviços', icon: Sparkles, href: '/painel/servicos' },
  { id: 'pacotes', label: 'Pacotes', icon: Gift, href: '/painel/pacotes' },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet, href: '/painel/financeiro' },
  { id: 'equipe', label: 'Equipe', icon: Users, href: '/painel/equipe' },
  { id: 'meu-link', label: 'Meu link de agendamento', icon: Link2, href: '/painel/meu-link' },
];
export type OpenEditor = (kind: EditorKind, row?: Partial<TableMap[EditorKind]>) => void;
export function Workspace({ section = 'inicio' }: { section?: string }) {
  const { data, ready, demo, error, refresh, busy } = useStudio();
  const [appointment, setAppointment] = useState<Appointment | 'new' | 'block' | null>(null),
    [appointmentDate, setAppointmentDate] = useState(today());
  const [editor, setEditor] = useState<{
    kind: EditorKind;
    row?: Partial<TableMap[EditorKind]>;
  } | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false),
    [search, setSearch] = useState(false),
    [notifications, setNotifications] = useState(false),
    [query, setQuery] = useState('');
  const openEditor: OpenEditor = (kind, row) => setEditor({ kind, row });
  const openAppointment = (a?: Appointment, date?: string, block?: boolean) => {
    setAppointmentDate(date || today());
    setAppointment(a || (block ? 'block' : 'new'));
  };
  const pending = data.appointments.filter((a) => a.status === 'pending' && a.kind === 'booking');
  const tomorrow = addDays(today(), 1);
  const reminders = data.appointments
    .filter(
      (a) =>
        a.kind === 'booking' &&
        ['confirmed', 'pending'].includes(a.status) &&
        [today(), tomorrow].includes(dateKey(a.starts_at)),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const birthdays = data.clients.filter((c) => c.birthday?.slice(5) === today().slice(5));
  const results =
    query.trim().length >= 2
      ? data.clients
          .filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 8)
      : [];
  if (!ready)
    return (
      <div className="loading-screen">
        <Brand />
        <span className="loading-line" />
        <p>Preparando seu espaço de cuidado…</p>
      </div>
    );
  if (error && !demo)
    return (
      <div className="setup-screen">
        <Brand />
        <h1>Vamos conectar seu studio.</h1>
        <p className="error-message">{error}</p>
        <p>
          Confira as variáveis de ambiente e execute{' '}
          <code>supabase/migrations/001_initial.sql</code> no SQL Editor do seu projeto.
        </p>
        <button className="button primary" onClick={() => refresh()}>
          Tentar novamente
        </button>
        <Link href="/entrar" className="text-button">
          Voltar para o login
        </Link>
      </div>
    );
  return (
    <div className="app-layout">
      {mobileMenu && (
        <button
          className="sidebar-scrim"
          onClick={() => setMobileMenu(false)}
          aria-label="Fechar menu"
        />
      )}
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <Link className="brand-link" href="/" onClick={() => setMobileMenu(false)}>
          <Brand />
        </Link>
        <div className="studio-label">
          <span className="live-dot" />
          MEU STUDIO<span>MG</span>
        </div>
        <nav aria-label="Navegação principal">
          {nav.map((item) => (
            <Link
              key={item.id}
              onClick={() => setMobileMenu(false)}
              href={item.href}
              className={`nav-item ${section === item.id ? 'active' : ''}`}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span>{item.label}</span>
              {item.id === 'agenda' && (
                <span className="nav-count">
                  {
                    data.appointments.filter(
                      (a) =>
                        dateKey(a.starts_at) === today() &&
                        a.kind === 'booking' &&
                        !['cancelled', 'no_show'].includes(a.status),
                    ).length
                  }
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Flower2 size={27} strokeWidth={1.1} />
            <p>
              Mais tempo para fazer
              <br />
              <em>o que você ama.</em>
            </p>
            <span>O resto, a gente organiza.</span>
          </div>
          <Link
            className={`nav-item ${section === 'configuracoes' ? 'active' : ''}`}
            href="/painel/configuracoes"
          >
            <Settings2 size={18} />
            Configurações
          </Link>
          <div className="profile">
            <Avatar name={data.business.name} color="#e1eadb" />
            <div>
              <strong>Meu espaço</strong>
              <span>{demo ? 'Modo demonstração' : 'Conta do studio'}</span>
            </div>
            {!demo && (
              <button
                className="icon-button"
                title="Sair da conta"
                aria-label="Sair da conta"
                onClick={async () => {
                  await getSupabase()?.auth.signOut();
                  location.assign('/entrar');
                }}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-layout">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="Abrir menu"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span className="desktop-only">Meu studio</span>
            <span className="crumb-slash desktop-only">/</span>
            <strong>
              {section === 'configuracoes'
                ? 'Configurações'
                : nav.find((n) => n.id === section)?.label || 'Visão geral'}
            </strong>
          </div>
          <div className="top-actions">
            <button
              aria-label="Buscar cliente"
              className="search-trigger"
              onClick={() => setSearch(true)}
            >
              <Search size={17} />
              <span>Buscar uma cliente…</span>
              <kbd>⌕</kbd>
            </button>
            <span className="top-date desktop-only">
              <CalendarDays size={15} />
              {dateLabel(today(), { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button
              className="icon-button notification-button"
              aria-label="Abrir notificações"
              onClick={() => setNotifications(true)}
            >
              <Bell size={20} />
              {pending.length + birthdays.length > 0 && <i />}
            </button>
            <Avatar name={data.business.name} color="#d9e6d0" size="small" />
          </div>
        </header>
        <main className="main-content">
          {demo && (
            <div className="demo-banner">
              <span>
                <span className="live-dot" />
                Você está no studio de demonstração. Explore e deixe tudo do seu jeito.
              </span>
              <Link href="/painel/configuracoes">
                Conectar Supabase <ArrowUpRight size={13} />
              </Link>
            </div>
          )}
          {error && demo && (
            <div role="alert" className="error-message">
              {error}
            </div>
          )}
          {section === 'inicio' && (
            <Overview onAppointment={openAppointment} onEditor={openEditor} />
          )}
          {section === 'agenda' && <CalendarPage onAppointment={openAppointment} />}
          {section === 'clientes' && (
            <ClientsPage onEditor={openEditor} onAppointment={openAppointment} />
          )}
          {section === 'servicos' && <ServicesPage onEditor={openEditor} />}
          {section === 'pacotes' && <PackagesPage onEditor={openEditor} />}
          {section === 'financeiro' && <FinancePage onEditor={openEditor} />}
          {section === 'equipe' && <TeamPage onEditor={openEditor} />}
          {section === 'meu-link' && <WebsitePage onEditor={openEditor} />}
          {section === 'configuracoes' && <SettingsPage />}
          {![
            'inicio',
            'agenda',
            'clientes',
            'servicos',
            'pacotes',
            'financeiro',
            'equipe',
            'meu-link',
            'configuracoes',
          ].includes(section) && (
            <Empty
              title="Página não encontrada"
              text="Esse cantinho ainda não existe."
              action={
                <Link className="button primary" href="/">
                  Voltar ao início
                </Link>
              }
            />
          )}
          <footer className="app-footer">
            <span>
              <Flower2 size={13} />
              AlongamentosCaratinga
            </span>
            <span>Feito para cuidar de quem cuida.</span>
          </footer>
        </main>
        <nav className="mobile-bottom" aria-label="Atalhos no celular">
          {nav
            .filter((n) => ['inicio', 'agenda', 'clientes', 'financeiro'].includes(n.id))
            .map((n) => (
              <Link key={n.id} className={section === n.id ? 'active' : ''} href={n.href}>
                <n.icon size={20} />
                <span>{n.id === 'inicio' ? 'Início' : n.label.replace('Minha ', '')}</span>
              </Link>
            ))}
          <button onClick={() => setMobileMenu(true)}>
            <MoreHorizontal size={21} />
            <span>Mais</span>
          </button>
        </nav>
      </div>
      {appointment && (
        <AppointmentEditor
          initial={typeof appointment === 'object' ? appointment : undefined}
          selectedDate={appointmentDate}
          block={appointment === 'block'}
          onClose={() => setAppointment(null)}
        />
      )}
      {editor && (
        <EntityEditor
          kind={editor.kind}
          initial={editor.row as never}
          onClose={() => setEditor(null)}
        />
      )}
      {search && (
        <Modal
          title="Encontre uma cliente"
          subtitle="Um nome ou telefone é tudo que você precisa."
          onClose={() => {
            setSearch(false);
            setQuery('');
          }}
        >
          <div className="editor-form">
            <div className="search-box">
              <Search size={18} />
              <input
                aria-label="Buscar cliente"
                placeholder="Digite pelo menos duas letras…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="search-results">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSearch(false);
                    setQuery('');
                    openEditor('clients', c);
                  }}
                >
                  <Avatar name={c.name} />
                  <div>
                    <strong>{c.name}</strong>
                    <small>{c.phone || 'Sem telefone cadastrado'}</small>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
              ))}
              {query.length >= 2 && !results.length && (
                <Empty
                  title="Nenhuma cliente encontrada"
                  text="Tente outro nome ou cadastre uma nova cliente."
                />
              )}
            </div>
          </div>
        </Modal>
      )}
      {notifications && (
        <Modal
          title="Seu studio em dia"
          subtitle="Reservas, aniversários e cuidados para lembrar."
          onClose={() => setNotifications(false)}
        >
          <div className="editor-form notification-list">
            {pending.length > 0 && (
              <>
                <h3>Novas reservas pelo link</h3>
                {pending.map((a) => (
                  <button
                    className="notification-row"
                    key={a.id}
                    onClick={() => {
                      setNotifications(false);
                      openAppointment(a);
                    }}
                  >
                    <span className="notification-icon">
                      <CalendarDays size={19} />
                    </span>
                    <div>
                      <strong>{data.clients.find((c) => c.id === a.client_id)?.name}</strong>
                      <p>
                        {data.services.find((s) => s.id === a.service_id)?.name} ·{' '}
                        {dateLabel(a.starts_at)} às {timeLabel(a.starts_at)}
                      </p>
                      <small>Toque para confirmar ou remarcar.</small>
                    </div>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
              </>
            )}
            {birthdays.map((c) => (
              <div className="notification-row" key={c.id}>
                <span className="notification-icon">
                  <Gift size={20} />
                </span>
                <div>
                  <strong>Hoje é aniversário de {c.name.split(' ')[0]}!</strong>
                  <p>Um carinho especial pode fazer o dia dela.</p>
                  {c.phone && (
                    <a
                      className="text-button"
                      href={whatsapp(
                        c.phone,
                        `Feliz aniversário, ${c.name.split(' ')[0]}! Que seu dia seja lindo. Um carinho do ${data.business.name}.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir mensagem no WhatsApp
                    </a>
                  )}
                </div>
              </div>
            ))}
            <h3>Lembretes de hoje e amanhã</h3>
            {reminders.length ? (
              reminders.map((a) => {
                const c = data.clients.find((c) => c.id === a.client_id);
                return (
                  <div className="notification-row" key={a.id}>
                    <Avatar name={c?.name || 'Cliente'} />
                    <div>
                      <strong>{c?.name}</strong>
                      <p>
                        {dateLabel(a.starts_at)} · {timeLabel(a.starts_at)}
                      </p>
                    </div>
                    {c?.phone && (
                      <a
                        className="icon-button"
                        title="Abrir lembrete no WhatsApp"
                        href={whatsapp(
                          c.phone,
                          `Oi, ${c.name.split(' ')[0]}! Passando para lembrar do seu horário no ${data.business.name}, dia ${dateLabel(a.starts_at)} às ${timeLabel(a.starts_at)}. Esperamos você!`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle size={19} />
                      </a>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="muted">Nenhum lembrete para esse período.</p>
            )}
            <p className="form-note">
              O WhatsApp abre a mensagem para você revisar e enviar. Lembretes automáticos por
              e-mail podem ser conectados nas configurações.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
type AppointmentOpener = (a?: Appointment, date?: string, block?: boolean) => void;
export function AppointmentList({
  items,
  onAppointment,
  compact = false,
}: {
  items: Appointment[];
  onAppointment: AppointmentOpener;
  compact?: boolean;
}) {
  const { data } = useStudio();
  return (
    <div className={`appointment-list ${compact ? 'compact' : ''}`}>
      {items.map((a) => {
        const client = data.clients.find((c) => c.id === a.client_id),
          service = data.services.find((s) => s.id === a.service_id),
          pro = data.professionals.find((p) => p.id === a.professional_id);
        return (
          <button
            key={a.id}
            className={`appointment-row ${a.kind === 'block' ? 'blocked' : ''}`}
            onClick={() => onAppointment(a)}
          >
            <div className="appointment-time">
              <strong>{timeLabel(a.starts_at)}</strong>
              <span>{timeLabel(a.ends_at)}</span>
            </div>
            <span
              className="appointment-accent"
              style={{ background: service?.color || '#dddcd4' }}
            />
            <Avatar name={client?.name || 'Pausa'} color={service?.color} />
            <div className="appointment-person">
              <strong>{client?.name || 'Horário bloqueado'}</strong>
              <span>
                {service?.name || a.notes}
                <i />
                {pro?.name}
              </span>
            </div>
            <div className="appointment-meta">
              <strong>{a.kind === 'block' ? 'Pausa' : currency(a.price)}</strong>
              <Badge tone={a.status}>
                {a.kind === 'block' ? 'Bloqueado' : statusLabels[a.status]}
              </Badge>
            </div>
            <ChevronRight className="row-chevron" size={17} />
          </button>
        );
      })}
    </div>
  );
}
function Overview({
  onAppointment,
  onEditor,
}: {
  onAppointment: AppointmentOpener;
  onEditor: OpenEditor;
}) {
  const { data } = useStudio();
  const day = today(),
    month = day.slice(0, 7);
  const todays = data.appointments
    .filter(
      (a) =>
        dateKey(a.starts_at) === day &&
        a.kind === 'booking' &&
        !['cancelled', 'no_show'].includes(a.status),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const completed = data.appointments.filter(
    (a) =>
      a.status === 'completed' &&
      a.payment_status === 'paid' &&
      dateKey(a.starts_at).startsWith(month),
  );
  const revenue =
    completed.reduce((s, a) => s + Number(a.price), 0) +
    data.transactions
      .filter((t) => t.type === 'income' && t.date.startsWith(month))
      .reduce((s, t) => s + Number(t.amount), 0) +
    data.customer_packages
      .filter((p) => p.paid && p.purchased_at.startsWith(month))
      .reduce((s, p) => s + Number(p.price), 0);
  const newClients = data.clients.filter((c) => dateKey(c.created_at).startsWith(month)).length;
  const pending = todays
    .filter((a) => a.payment_status === 'pending')
    .reduce((s, a) => s + Number(a.price), 0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6));
  const amounts = days.map(
    (d) =>
      data.appointments
        .filter(
          (a) =>
            a.status === 'completed' && a.payment_status === 'paid' && dateKey(a.starts_at) === d,
        )
        .reduce((s, a) => s + Number(a.price), 0) +
      data.transactions
        .filter((t) => t.type === 'income' && t.date === d)
        .reduce((s, t) => s + Number(t.amount), 0) +
      data.customer_packages
        .filter((p) => p.paid && p.purchased_at === d)
        .reduce((s, p) => s + Number(p.price), 0),
  );
  const max = Math.max(...amounts, 100);
  const inactive = data.clients
    .map((c) => ({
      client: c,
      last: data.appointments
        .filter((a) => a.client_id === c.id && a.status === 'completed')
        .map((a) => dateKey(a.starts_at))
        .sort()
        .at(-1),
    }))
    .filter((c) => c.last && c.last < addDays(day, -30))
    .slice(0, 3);
  return (
    <>
      <PageHeading
        eyebrow="UM BOM DIA COMEÇA COM CUIDADO"
        title="Seu studio, em boas mãos."
        subtitle={`${dateLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}. Vamos fazer esse dia florescer?`}
        action={<AddButton onClick={() => onAppointment()}>Novo agendamento</AddButton>}
      />
      <div className="welcome-banner">
        <div>
          <Badge tone="light">
            <span className="live-dot" />
            SEU DIA, ORGANIZADO
          </Badge>
          <h2>
            Pequenos detalhes.
            <br />
            <em>Grandes momentos.</em>
          </h2>
          <p>
            {todays.length
              ? `Você tem ${todays.length} momentos de cuidado agendados para hoje.`
              : 'Sua agenda está aberta para novos momentos de cuidado.'}
            <br />
            Cuide das suas clientes. Seu studio está por aqui.
          </p>
          <Link href="/painel/agenda">
            Ver minha agenda <ArrowRight size={16} />
          </Link>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-ring ring-one" />
          <div className="art-ring ring-two" />
          <div className="art-note">
            <Flower2 size={28} strokeWidth={1} />
            <span>feito com</span>
            <em>carinho.</em>
            <i>AlongamentosCARATINGA</i>
          </div>
          <div className="art-leaf leaf-one" />
          <div className="art-leaf leaf-two" />
          <div className="art-spark">✧</div>
          <span className="art-caption">BELEZA EM CADA DETALHE</span>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          label="Atendimentos hoje"
          value={String(todays.length).padStart(2, '0')}
          detail={`${todays.filter((a) => a.status === 'completed').length} concluídos · ${todays.filter((a) => a.status !== 'completed').length} para cuidar`}
          icon={<CalendarDays size={19} />}
        />
        <Stat
          label="Recebido no mês"
          value={currency(revenue)}
          detail="Atendimentos, pacotes e receitas"
          icon={<Wallet size={19} />}
          positive
        />
        <Stat
          label="Clientes no studio"
          value={data.clients.length}
          detail={`${newClients} novas neste mês`}
          icon={<Users size={19} />}
        />
        <Stat
          label="A receber hoje"
          value={currency(pending)}
          detail="Pagamentos dos atendimentos do dia"
          icon={<CircleDollarSign size={19} />}
        />
      </div>
      <UpcomingConfirmations onEditClient={(client) => onEditor('clients', client)} />
      <div className="dashboard-grid">
        <section className="panel today-panel">
          <SectionHead
            title="Seus encontros de hoje"
            subtitle="Cada horário, uma história para cuidar."
            action={
              <Link className="text-button" href="/painel/agenda">
                Ver agenda <ArrowUpRight size={15} />
              </Link>
            }
          />
          <div className="day-strip">
            <span>
              <span className="live-dot" />
              {dateLabel(day, { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
            <small>{todays.length} agendamentos</small>
          </div>
          {todays.length ? (
            <AppointmentList items={todays} onAppointment={onAppointment} compact />
          ) : (
            <Empty
              text="Abra espaço para sua próxima cliente."
              action={
                <button className="button secondary" onClick={() => onAppointment()}>
                  Agendar primeiro atendimento
                </button>
              }
            />
          )}
        </section>
        <section className="panel revenue-panel">
          <SectionHead
            title="Seu cuidado dá frutos"
            subtitle="Entradas dos últimos 7 dias"
            action={
              <span className="mini-icon">
                <ChartNoAxesCombined size={19} />
              </span>
            }
          />
          <div className="chart-total">
            <strong>{currency(amounts.reduce((a, b) => a + b, 0))}</strong>
            <Badge tone="confirmed">Recebidos</Badge>
          </div>
          <div className="bar-chart">
            <div className="chart-lines">
              <span>{currency(max)}</span>
              <span>{currency(max / 2)}</span>
              <span>R$ 0</span>
            </div>
            <div className="chart-bars">
              {days.map((d, i) => (
                <div className="chart-column" key={d}>
                  <div
                    className={`chart-bar ${i === 6 ? 'current' : ''}`}
                    style={{ height: `${Math.max(3, (amounts[i] / max) * 100)}%` }}
                    title={`${dateLabel(d)}: ${currency(amounts[i])}`}
                  >
                    <span>{currency(amounts[i])}</span>
                  </div>
                  <small>{dateLabel(d, { weekday: 'short' }).replace('.', '')}</small>
                </div>
              ))}
            </div>
          </div>
          <Link className="chart-footer" href="/painel/financeiro">
            Acompanhar meu financeiro <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <div className="bottom-grid">
        <section className="panel">
          <SectionHead
            title="Um carinho para quem faz falta"
            subtitle="Clientes que não aparecem há mais de 30 dias."
            action={
              <span className="mini-icon warm">
                <MessageCircle size={18} />
              </span>
            }
          />
          {inactive.length ? (
            inactive.map(({ client, last }) => (
              <div className="return-client" key={client.id}>
                <Avatar name={client.name} />
                <div>
                  <strong>{client.name}</strong>
                  <span>Última visita em {dateLabel(last!)}</span>
                </div>
                {client.phone ? (
                  <a
                    className="button secondary small-button"
                    href={whatsapp(
                      client.phone,
                      `Oi, ${client.name.split(' ')[0]}! Sentimos sua falta por aqui no ${data.business.name}. Vamos reservar seu próximo momento de cuidado?`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={14} />
                    Chamar
                  </a>
                ) : (
                  <button className="text-button" onClick={() => onEditor('clients', client)}>
                    Ver cliente <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="gentle-empty">
              <Flower2 size={24} />
              <span>
                Por aqui, o cuidado está em dia.
                <small>As clientes que estiverem há mais tempo sem vir aparecerão aqui.</small>
              </span>
            </div>
          )}
        </section>
        <section className="link-callout">
          <div className="link-callout-icon">
            <Link2 size={25} strokeWidth={1.5} />
          </div>
          <span className="eyebrow">SEU STUDIO, SEMPRE ABERTO</span>
          <h2>
            Ela escolhe o horário.
            <br />
            <em>Você faz a magia.</em>
          </h2>
          <p>Seu link de agendamento prontinho para a bio e para o WhatsApp.</p>
          <Link className="button secondary" href="/painel/meu-link">
            Conhecer meu link <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
    </>
  );
}
function CalendarPage({ onAppointment }: { onAppointment: AppointmentOpener }) {
  const { data } = useStudio();
  const [date, setDate] = useState(today()),
    [view, setView] = useState('day'),
    [pro, setPro] = useState('all');
  const day = new Date(`${date}T12:00:00-03:00`);
  const weekStart = addDays(date, -((day.getUTCDay() + 6) % 7));
  const monthStart = `${date.slice(0, 7)}-01`;
  const firstDay = new Date(`${monthStart}T12:00:00-03:00`);
  const monthGridStart = addDays(monthStart, -((firstDay.getUTCDay() + 6) % 7));
  const monthCells = Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i));
  const dates =
    view === 'month'
      ? monthCells
      : view === 'week'
        ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
        : [date];
  const items = data.appointments
    .filter(
      (a) => dates.includes(dateKey(a.starts_at)) && (pro === 'all' || a.professional_id === pro),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  function movePeriod(delta: number) {
    if (view === 'month') {
      const target = new Date(`${monthStart}T12:00:00-03:00`);
      target.setUTCMonth(target.getUTCMonth() + delta);
      setDate(dateKey(target));
    } else setDate(addDays(date, delta * (view === 'week' ? 7 : 1)));
  }
  function exportCalendar() {
    downloadCsv(`agenda-${date}.csv`, [
      ['Data', 'Início', 'Fim', 'Cliente', 'Serviço', 'Profissional', 'Status', 'Valor'],
      ...items.map((a) => [
        dateKey(a.starts_at),
        timeLabel(a.starts_at),
        timeLabel(a.ends_at),
        data.clients.find((c) => c.id === a.client_id)?.name || 'Bloqueio',
        data.services.find((s) => s.id === a.service_id)?.name || a.notes,
        data.professionals.find((p) => p.id === a.professional_id)?.name || '',
        statusLabels[a.status],
        a.price,
      ]),
    ]);
  }
  return (
    <>
      <PageHeading
        eyebrow="CADA HORÁRIO, UM MOMENTO ESPECIAL"
        title="Sua agenda de cuidado."
        subtitle="Um dia leve começa com tudo no lugar."
        action={
          <div className="heading-actions">
            <button
              className="button secondary"
              onClick={() => onAppointment(undefined, date, true)}
            >
              <Clock3 size={16} />
              Bloquear horário
            </button>
            <AddButton onClick={() => onAppointment(undefined, date)}>Novo agendamento</AddButton>
          </div>
        }
      />
      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div className="calendar-controls">
            <button
              className="icon-button"
              aria-label="Período anterior"
              onClick={() => movePeriod(-1)}
            >
              <ChevronLeft size={19} />
            </button>
            <h2>{dateLabel(date, { month: 'long', year: 'numeric' })}</h2>
            <button
              className="icon-button"
              aria-label="Próximo período"
              onClick={() => movePeriod(1)}
            >
              <ChevronRight size={19} />
            </button>
            <button className="button secondary small-button" onClick={() => setDate(today())}>
              Hoje
            </button>
            <input
              type="date"
              aria-label="Ir para uma data"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              onInput={(e) => e.currentTarget.value && setDate(e.currentTarget.value)}
            />
          </div>
          <div className="calendar-options">
            <select
              aria-label="Filtrar profissional"
              value={pro}
              onChange={(e) => setPro(e.target.value)}
            >
              <option value="all">Toda a equipe</option>
              {data.professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="segmented">
              <button className={view === 'day' ? 'selected' : ''} onClick={() => setView('day')}>
                Dia
              </button>
              <button className={view === 'week' ? 'selected' : ''} onClick={() => setView('week')}>
                Semana
              </button>
              <button
                className={view === 'month' ? 'selected' : ''}
                onClick={() => setView('month')}
              >
                Mês
              </button>
            </div>
            <button
              className="icon-button"
              aria-label="Exportar agenda CSV"
              title="Exportar CSV"
              onClick={exportCalendar}
            >
              <Download size={18} />
            </button>
          </div>
        </div>
        {view !== 'month' && (
          <div className="week-picker">
            {week.map((d) => (
              <button
                key={d}
                className={`${d === date ? 'selected' : ''} ${d === today() ? 'is-today' : ''}`}
                onClick={() => setDate(d)}
              >
                <span>{dateLabel(d, { weekday: 'short' }).replace('.', '')}</span>
                <strong>{dateLabel(d, { day: '2-digit' })}</strong>
                <i
                  className={
                    data.appointments.some(
                      (a) =>
                        dateKey(a.starts_at) === d && !['cancelled', 'no_show'].includes(a.status),
                    )
                      ? 'has-events'
                      : ''
                  }
                />
              </button>
            ))}
          </div>
        )}
        {view === 'day' ? (
          <div className="calendar-day">
            <div className="day-title">
              <h3>{dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
              <Badge>{items.filter((a) => a.kind === 'booking').length} atendimentos</Badge>
            </div>
            {items.length ? (
              <AppointmentList items={items} onAppointment={onAppointment} />
            ) : (
              <Empty
                title="Um dia cheio de possibilidades"
                text="Sua próxima cliente pode estar a um agendamento de distância."
                action={
                  <AddButton onClick={() => onAppointment(undefined, date)}>
                    Agendar atendimento
                  </AddButton>
                }
              />
            )}
          </div>
        ) : view === 'week' ? (
          <div className="week-grid">
            {dates.map((d) => (
              <div key={d} className="week-column">
                <div className={d === today() ? 'today-title' : ''}>
                  <small>{dateLabel(d, { weekday: 'short' })}</small>
                  <strong>{dateLabel(d, { day: 'numeric' })}</strong>
                </div>
                {items
                  .filter((a) => dateKey(a.starts_at) === d)
                  .map((a) => (
                    <button
                      key={a.id}
                      className="week-event"
                      style={{
                        background:
                          data.services.find((s) => s.id === a.service_id)?.color || '#eeede6',
                      }}
                      onClick={() => onAppointment(a)}
                    >
                      <span>
                        {timeLabel(a.starts_at)} – {timeLabel(a.ends_at)}
                      </span>
                      <strong>
                        {data.clients.find((c) => c.id === a.client_id)?.name || 'Pausa'}
                      </strong>
                      <small>
                        {data.services.find((s) => s.id === a.service_id)?.name || a.notes}
                      </small>
                      <small>{statusLabels[a.status]}</small>
                    </button>
                  ))}
                <button
                  className="week-add"
                  aria-label={`Agendar em ${dateLabel(d)}`}
                  onClick={() => onAppointment(undefined, d)}
                >
                  <Plus size={17} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="month-calendar">
            <div className="month-weekdays">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="month-grid">
              {monthCells.map((d) => {
                const dayItems = items.filter(
                  (a) => dateKey(a.starts_at) === d && !['cancelled', 'no_show'].includes(a.status),
                );
                return (
                  <div
                    key={d}
                    className={`month-cell ${d.slice(0, 7) !== date.slice(0, 7) ? 'outside' : ''}`}
                  >
                    <button
                      className={`month-number ${d === today() ? 'today' : ''}`}
                      aria-label={`Ver dia ${dateLabel(d)}`}
                      onClick={() => {
                        setDate(d);
                        setView('day');
                      }}
                    >
                      {dateLabel(d, { day: 'numeric' })}
                    </button>
                    <div className="month-events">
                      {dayItems.slice(0, 3).map((a) => (
                        <button
                          key={a.id}
                          style={{
                            background:
                              data.services.find((s) => s.id === a.service_id)?.color || '#eeede6',
                          }}
                          onClick={() => onAppointment(a)}
                        >
                          <strong>{timeLabel(a.starts_at)}</strong>
                          <span>
                            {data.clients.find((c) => c.id === a.client_id)?.name || 'Bloqueio'}
                          </span>
                        </button>
                      ))}
                      {dayItems.length > 3 && (
                        <button
                          className="month-more"
                          onClick={() => {
                            setDate(d);
                            setView('day');
                          }}
                        >
                          +{dayItems.length - 3} horários
                        </button>
                      )}
                    </div>
                    <button
                      className="month-mobile-count"
                      aria-label={`${dayItems.length} horários em ${dateLabel(d)}`}
                      onClick={() => {
                        setDate(d);
                        setView('day');
                      }}
                    >
                      {dayItems.length ? (
                        <>
                          <i />
                          {dayItems.length}
                        </>
                      ) : (
                        '—'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
      <p className="page-note">
        <span className="live-dot" />
        Reservas pelo link chegam como pendentes para você revisar. Todos os horários são de
        Brasília.
      </p>
    </>
  );
}
