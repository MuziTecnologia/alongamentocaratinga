'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Bell,
  Check,
  Copy,
  Database,
  ExternalLink,
  Flower2,
  ImagePlus,
  Instagram,
  Link2,
  MapPin,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Smartphone,
  Upload,
} from 'lucide-react';
import { useStudio } from './studio-provider';
import {
  Avatar,
  Badge,
  Brand,
  Field,
  PageHeading,
  SectionHead,
  formValues,
  numberValue,
  value,
} from './ui';
import type { OpenEditor } from './workspace';
import { getSupabase } from '@/lib/supabase/client';
import { ServicePhoto } from './service-photo';
import { minutes, slugify, uid } from '@/lib/utils';

export function WebsitePage({ onEditor }: { onEditor: OpenEditor }) {
  const { data, saveBusiness, save, notify, busy, demo } = useStudio();
  const [copied, setCopied] = useState(false),
    [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const publicPath = `/agendar/${data.business.slug}`;
  const url = typeof window === 'undefined' ? publicPath : `${location.origin}${publicPath}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify('Copie o endereço exibido no campo do link.');
    }
  }
  async function upload(image: File) {
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(image.type) ||
      image.size > (demo ? 800_000 : 5_000_000)
    ) {
      notify(
        demo
          ? 'Use JPG, PNG ou WebP de até 800 KB na demonstração.'
          : 'Use JPG, PNG ou WebP de até 5 MB.',
      );
      return;
    }
    setUploading(true);
    try {
      let imageUrl = '';
      const supabase = getSupabase();
      if (supabase) {
        const path = `${data.business.id}/${uid()}.${image.type.split('/')[1]}`;
        const { error } = await supabase.storage
          .from('studio-gallery')
          .upload(path, image, { contentType: image.type, upsert: false });
        if (error) throw error;
        imageUrl = supabase.storage.from('studio-gallery').getPublicUrl(path).data.publicUrl;
      } else
        imageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(image);
        });
      await save('gallery', {
        id: uid(),
        business_id: data.business.id,
        url: imageUrl,
        caption: 'Um cuidado com a assinatura AlongamentosCaratinga',
      });
    } catch (err) {
      notify((err as Error).message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="UM CONVITE PARA O SEU STUDIO"
        title="Seu cuidado tem um endereço."
        subtitle="Um link para a bio. Uma agenda aberta para novos encontros."
        action={
          <a href={publicPath} target="_blank" rel="noreferrer" className="button primary">
            Abrir meu site <ArrowUpRight size={17} />
          </a>
        }
      />
      <div className="website-grid">
        <div className="website-settings">
          <section className="panel padded">
            <SectionHead
              title="Prontinho para compartilhar"
              subtitle="Envie pelo WhatsApp ou coloque na bio do Instagram."
            />
            <div className="public-link-field">
              <Link2 size={18} />
              <input aria-label="Seu link público" readOnly value={url} />
              <button className="icon-button" aria-label="Copiar link público" onClick={copy}>
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <div className="link-buttons">
              <button className="button primary" onClick={copy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
                {copied ? 'Link copiado!' : 'Copiar meu link'}
              </button>
              <a className="button secondary" href={publicPath} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                Visualizar
              </a>
            </div>
            <div className="setting-toggle">
              <div>
                <strong>Receber agendamentos online</strong>
                <small>As clientes veem os horários livres e reservam sozinhas.</small>
              </div>
              <button
                className={`switch ${data.business.booking_enabled ? 'on' : ''}`}
                role="switch"
                aria-checked={data.business.booking_enabled}
                aria-label="Receber agendamentos online"
                disabled={busy}
                onClick={() =>
                  saveBusiness({
                    ...data.business,
                    booking_enabled: !data.business.booking_enabled,
                  })
                }
              >
                <span />
              </button>
            </div>
            {demo && (
              <p className="form-note">
                Este endereço é local. Para suas clientes acessarem pelo celular, conecte o Supabase
                e publique o projeto.
              </p>
            )}
          </section>
          <section className="panel padded">
            <SectionHead
              title="A cara do seu studio"
              subtitle="Sua identidade recebe a cliente antes mesmo do atendimento."
            />
            <div className="website-checklist">
              <span>
                <Check size={16} />
                Nome, descrição e contato
              </span>
              <span>
                <Check size={16} />
                {data.services.filter((s) => s.active).length} serviços no menu
              </span>
              <span>
                <Check size={16} />
                Disponibilidade em tempo real
              </span>
              <span>
                <Check size={16} />
                Cores e cuidado com sua identidade
              </span>
            </div>
            <Link className="button secondary" href="/painel/configuracoes">
              <Pencil size={15} />
              Editar informações do studio
            </Link>
          </section>
          <section className="panel padded">
            <SectionHead
              title="Seu trabalho, em detalhes"
              subtitle="Uma galeria com fotos autorais das suas criações."
              action={
                <button
                  className="icon-button"
                  aria-label="Adicionar foto por link"
                  onClick={() => onEditor('gallery')}
                >
                  <ImagePlus size={21} />
                </button>
              }
            />
            <div className="gallery-grid">
              {data.gallery.map((g) => (
                <button
                  className="gallery-image"
                  key={g.id}
                  aria-label={`Editar foto: ${g.caption}`}
                  onClick={() => onEditor('gallery', g)}
                >
                  <img src={g.url} alt={g.caption} />
                  <span>
                    <Pencil size={15} />
                  </span>
                </button>
              ))}
              <button
                className="gallery-upload"
                disabled={uploading}
                onClick={() => file.current?.click()}
              >
                <Upload size={24} />
                <span>{uploading ? 'Enviando…' : 'Adicionar foto'}</span>
              </button>
            </div>
            <input
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              ref={file}
              onChange={(e) => {
                if (e.target.files?.[0]) void upload(e.target.files[0]);
              }}
            />
            <p className="form-note">
              Fotos enviadas à galeria são públicas. Na demonstração elas ficam somente neste
              navegador.
            </p>
          </section>
        </div>
        <div className="phone-preview-wrap">
          <div className="preview-label">
            <Smartphone size={16} />
            UM POUQUINHO DE COMO ELA VÊ
          </div>
          <div className="phone-preview">
            <div className="phone-camera" />
            <div className="phone-cover">
              <Flower2 size={48} strokeWidth={0.8} />
              <span>beleza em cada detalhe.</span>
            </div>
            <div className="phone-content">
              <span className="phone-avatar">
                <Flower2 size={28} strokeWidth={1} />
              </span>
              <h2>{data.business.name}</h2>
              <span className="phone-location">
                <MapPin size={11} />
                {data.business.address || 'Caratinga, MG'}
              </span>
              <p>{data.business.description}</p>
              <div className="phone-divider">ESCOLHA SEU MOMENTO</div>
              {data.services
                .filter((s) => s.active)
                .slice(0, 3)
                .map((s) => (
                  <div className="phone-service" key={s.id}>
                    <ServicePhoto service={s} />
                    <div>
                      <strong>{s.name}</strong>
                      <small>
                        {s.duration} min · R$ {s.price}
                      </small>
                    </div>
                    <ArrowUpRight size={14} />
                  </div>
                ))}
              <a
                href={publicPath}
                target="_blank"
                rel="noreferrer"
                className="button primary full-width"
              >
                Reservar meu momento
              </a>
              <div className="phone-footer">
                <Flower2 size={12} />
                feito com carinho.
              </div>
            </div>
          </div>
          <p>
            Seu site se adapta ao celular,
            <br />
            assim como o cuidado se adapta a ela.
          </p>
        </div>
      </div>
    </>
  );
}

export function SettingsPage() {
  const { data, saveBusiness, demo, notify, busy, resetDemo } = useStudio();
  const [tab, setTab] = useState('business'),
    [err, setErr] = useState(''),
    [restore, setRestore] = useState(false);
  const b = data.business;
  const [hours, setHours] = useState(b.hours);
  const [payments, setPayments] = useState(b.payment_methods);
  async function submit(event: FormEvent<HTMLFormElement>) {
    const form = formValues(event);
    setErr('');
    let next = { ...b };
    if (tab === 'business') {
      const slug = slugify(value(form, 'slug'));
      if (slug.length < 3 || slug.length > 60) {
        setErr('Use um endereço entre 3 e 60 letras, números e hífens.');
        return;
      }
      next = {
        ...b,
        name: value(form, 'name'),
        slug,
        description: value(form, 'description'),
        phone: value(form, 'phone').replace(/\D/g, ''),
        address: value(form, 'address'),
        instagram: value(form, 'instagram').replace(/^@/, ''),
      };
      if (next.phone && !/^\d{10,13}$/.test(next.phone)) {
        setErr('Confira o telefone do studio com DDD.');
        return;
      }
    }
    if (tab === 'hours') {
      for (const [day, h] of Object.entries(hours))
        if (h.enabled) {
          if (!h.start || !h.end || minutes(h.start) >= minutes(h.end)) {
            setErr(
              `Confira o início e o fim de ${['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][Number(day)]}.`,
            );
            return;
          }
          if (
            Boolean(h.break_start) !== Boolean(h.break_end) ||
            (h.break_start &&
              h.break_end &&
              (minutes(h.break_start) < minutes(h.start) ||
                minutes(h.break_end) > minutes(h.end) ||
                minutes(h.break_start) >= minutes(h.break_end)))
          ) {
            setErr(
              'O intervalo precisa começar e terminar dentro do expediente. Apague os dois horários para trabalhar sem intervalo.',
            );
            return;
          }
        }
      next = {
        ...b,
        hours,
        notice_hours: numberValue(form, 'notice_hours'),
        cancellation_hours: numberValue(form, 'cancellation_hours'),
      };
    }
    if (tab === 'payments') {
      if (!payments.length) {
        setErr('Selecione pelo menos uma forma de pagamento.');
        return;
      }
      next = { ...b, payment_methods: payments };
    }
    if (tab === 'notifications')
      next = {
        ...b,
        email_reminders: form.get('email_reminders') === 'on',
        reminder_hours: numberValue(form, 'reminder_hours'),
      };
    await saveBusiness(next);
  }
  function updateHour(day: string, key: string, val: string | boolean) {
    setHours({ ...hours, [day]: { ...hours[day], [key]: val } });
  }
  return (
    <>
      <PageHeading
        eyebrow="O SEU JEITO DE CUIDAR"
        title="Tudo do seu jeito."
        subtitle="Os detalhes que fazem o seu espaço funcionar em harmonia."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções das configurações">
          {[
            { id: 'business', label: 'Dados do studio', icon: Flower2 },
            { id: 'hours', label: 'Horários e reservas', icon: Smartphone },
            { id: 'payments', label: 'Formas de pagamento', icon: Check },
            { id: 'notifications', label: 'Avisos e lembretes', icon: Bell },
            { id: 'connection', label: 'Conexão e dados', icon: Database },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setErr('');
              }}
              className={tab === t.id ? 'active' : ''}
            >
              <t.icon size={18} />
              {t.label}
            </button>
          ))}
        </nav>
        <section className="panel settings-panel">
          {tab === 'connection' ? (
            <div className="editor-form">
              <SectionHead
                title="Seu studio conectado"
                subtitle="Uma base segura para todas as suas histórias."
              />
              <div className="connection-state">
                <Database size={28} />
                <div>
                  <strong>{demo ? 'Demonstração local' : 'Supabase conectado'}</strong>
                  <p>
                    {demo
                      ? 'Dados salvos apenas neste navegador.'
                      : 'Autenticação e banco de dados com acesso por proprietária.'}
                  </p>
                </div>
                <Badge tone={demo ? 'pending' : 'confirmed'}>
                  {demo ? 'Configuração pendente' : 'Conectado'}
                </Badge>
              </div>
              {demo && (
                <>
                  <h3>Para começar a usar com dados reais</h3>
                  <ol className="setup-steps">
                    <li>
                      Crie um projeto em{' '}
                      <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
                        supabase.com/dashboard <ArrowUpRight size={12} />
                      </a>
                      .
                    </li>
                    <li>
                      Execute o arquivo <code>supabase/migrations/001_initial.sql</code> no SQL
                      Editor do projeto.
                    </li>
                    <li>
                      Copie <code>.env.example</code> para <code>.env.local</code> e preencha a URL
                      e a chave pública do Supabase.
                    </li>
                    <li>
                      Reinicie o servidor, crie sua conta e entre no studio. O banco começa vazio,
                      sem os dados de exemplo.
                    </li>
                  </ol>
                  <p className="form-note">
                    O README do projeto explica a instalação, o banco, os lembretes e a publicação.
                    A chave secreta service_role nunca deve usar o prefixo NEXT_PUBLIC_.
                  </p>
                  <hr />
                  <h3>Restaurar a demonstração</h3>
                  <p className="muted">
                    Recarrega os exemplos e remove as alterações locais. Isso não afeta um projeto
                    Supabase.
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      if (!restore) {
                        setRestore(true);
                        return;
                      }
                      resetDemo();
                      setRestore(false);
                    }}
                  >
                    {restore ? 'Confirmar restauração dos exemplos' : 'Restaurar dados de exemplo'}
                  </button>
                </>
              )}
              <div className="security-note">
                <ShieldCheck size={22} />
                <p>
                  {demo
                    ? 'Quando conectado, as regras do banco restringem os dados privados à proprietária.'
                    : 'As regras do banco restringem clientes, histórico e finanças à conta proprietária.'}{' '}
                  O link público mostra apenas informações de divulgação e horários disponíveis.
                </p>
              </div>
              <Link className="text-button" href="/entrar">
                Ir para a tela de acesso <ArrowUpRight size={14} />
              </Link>
            </div>
          ) : (
            <form className="editor-form" onSubmit={submit} key={tab}>
              {tab === 'business' && (
                <>
                  <SectionHead
                    title="A essência do seu studio"
                    subtitle="Essas informações aparecem na sua página pública."
                  />
                  <Field label="Nome do studio">
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={120}
                      defaultValue={b.name}
                    />
                  </Field>
                  <Field label="Descrição">
                    <textarea
                      name="description"
                      required
                      maxLength={600}
                      rows={3}
                      defaultValue={b.description}
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="WhatsApp com DDD">
                      <input
                        name="phone"
                        type="tel"
                        defaultValue={b.phone}
                        placeholder="(33) 99999-9999"
                      />
                    </Field>
                    <Field label="Instagram">
                      <input
                        name="instagram"
                        maxLength={60}
                        defaultValue={b.instagram}
                        placeholder="@Alongamentoscaratinga"
                      />
                    </Field>
                  </div>
                  <Field label="Endereço ou região">
                    <input name="address" required maxLength={250} defaultValue={b.address} />
                  </Field>
                  <Field
                    label="Endereço do seu link"
                    hint="A alteração muda o link de agendamento. Atualize também sua bio."
                  >
                    <div className="input-prefix">
                      <span>/agendar/</span>
                      <input
                        name="slug"
                        required
                        minLength={3}
                        maxLength={60}
                        pattern="[a-z0-9-]+"
                        defaultValue={b.slug}
                      />
                    </div>
                  </Field>
                </>
              )}
              {tab === 'hours' && (
                <>
                  <SectionHead
                    title="Um tempo para cada coisa"
                    subtitle="Defina quando seu studio recebe clientes. Horário de Brasília."
                  />
                  <div className="hours-table">
                    {[
                      'Domingo',
                      'Segunda-feira',
                      'Terça-feira',
                      'Quarta-feira',
                      'Quinta-feira',
                      'Sexta-feira',
                      'Sábado',
                    ].map((day, i) => {
                      const h = hours[String(i)];
                      return (
                        <div className={`hours-row ${h.enabled ? '' : 'disabled'}`} key={day}>
                          <label>
                            <input
                              type="checkbox"
                              checked={h.enabled}
                              onChange={(e) => updateHour(String(i), 'enabled', e.target.checked)}
                            />
                            <strong>{day}</strong>
                          </label>
                          {h.enabled ? (
                            <div className="hours-inputs">
                              <label>
                                <span>Abre</span>
                                <input
                                  aria-label={`${day}: abertura`}
                                  type="time"
                                  required
                                  value={h.start}
                                  onChange={(e) => updateHour(String(i), 'start', e.target.value)}
                                />
                              </label>
                              <label>
                                <span>Fecha</span>
                                <input
                                  aria-label={`${day}: fechamento`}
                                  type="time"
                                  required
                                  value={h.end}
                                  onChange={(e) => updateHour(String(i), 'end', e.target.value)}
                                />
                              </label>
                              <label>
                                <span>Intervalo</span>
                                <input
                                  aria-label={`${day}: início do intervalo`}
                                  type="time"
                                  value={h.break_start}
                                  onChange={(e) =>
                                    updateHour(String(i), 'break_start', e.target.value)
                                  }
                                />
                              </label>
                              <label>
                                <span>Retorno</span>
                                <input
                                  aria-label={`${day}: fim do intervalo`}
                                  type="time"
                                  value={h.break_end}
                                  onChange={(e) =>
                                    updateHour(String(i), 'break_end', e.target.value)
                                  }
                                />
                              </label>
                            </div>
                          ) : (
                            <span className="muted">Um dia para descansar</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="form-grid">
                    <Field label="Antecedência mínima (horas)">
                      <input
                        name="notice_hours"
                        type="number"
                        required
                        min="0"
                        max="168"
                        defaultValue={b.notice_hours}
                      />
                    </Field>
                    <Field
                      label="Prazo para solicitar cancelamento (horas)"
                      hint="A cliente solicita cancelamento pelo WhatsApp do studio."
                    >
                      <input
                        name="cancellation_hours"
                        type="number"
                        required
                        min="0"
                        max="168"
                        defaultValue={b.cancellation_hours}
                      />
                    </Field>
                  </div>
                  <p className="form-note">
                    Os horários valem para toda a equipe. Para uma pausa específica de uma
                    profissional, use “Bloquear horário” na agenda.
                  </p>
                </>
              )}
              {tab === 'payments' && (
                <>
                  <SectionHead
                    title="Receber também pode ser simples"
                    subtitle="Mostre às clientes as opções aceitas no atendimento."
                  />
                  <div className="payment-options">
                    {[
                      'Pix',
                      'Dinheiro',
                      'Cartão de crédito',
                      'Cartão de débito',
                      'Transferência',
                    ].map((p) => (
                      <label
                        key={p}
                        className={`payment-option ${payments.includes(p) ? 'selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={payments.includes(p)}
                          onChange={(e) =>
                            setPayments(
                              e.target.checked ? [...payments, p] : payments.filter((v) => v !== p),
                            )
                          }
                        />
                        <strong>{p}</strong>
                        <Check size={18} />
                      </label>
                    ))}
                  </div>
                  <p className="form-note">
                    O sistema registra os recebimentos. Os pagamentos são realizados diretamente ao
                    studio.
                  </p>
                </>
              )}
              {tab === 'notifications' && (
                <>
                  <SectionHead
                    title="Um lembrete de carinho"
                    subtitle="Prepare os avisos para que ninguém perca um momento especial."
                  />
                  <div className="setting-toggle">
                    <div>
                      <strong>Lembretes por e-mail</strong>
                      <small>Enviar automaticamente antes dos atendimentos confirmados.</small>
                    </div>
                    <input
                      type="checkbox"
                      name="email_reminders"
                      defaultChecked={b.email_reminders}
                    />
                  </div>
                  <Field label="Lembrar com quantas horas de antecedência?">
                    <input
                      name="reminder_hours"
                      type="number"
                      min="1"
                      max="168"
                      required
                      defaultValue={b.reminder_hours}
                    />
                  </Field>
                  <div className="info-card">
                    <Bell size={21} />
                    <div>
                      <strong>Configure o envio antes de ativar</strong>
                      <p>
                        O envio automático requer uma conta Resend, domínio verificado e um
                        agendador chamando a rota de lembretes. As instruções e variáveis estão no
                        README. Sem essa conexão, nenhum e-mail é enviado.
                      </p>
                    </div>
                  </div>
                  <div className="info-card">
                    <MessageCircle size={21} />
                    <div>
                      <strong>WhatsApp com a sua voz</strong>
                      <p>
                        Na agenda, clientes e central de avisos, abra mensagens prontas para revisar
                        e enviar pelo seu WhatsApp. O envio por WhatsApp é manual.
                      </p>
                    </div>
                  </div>
                </>
              )}
              {err && (
                <p className="error-message" role="alert">
                  {err}
                </p>
              )}
              <div className="form-actions">
                <button className="button primary" type="submit" disabled={busy}>
                  <Check size={16} />
                  {busy ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
