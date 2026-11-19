'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Flower2,
  Heart,
  Instagram,
  MapPin,
  MessageCircle,
  Gift,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { PublicStudio, Appointment } from '@/lib/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { availableSlots } from '@/lib/domain';
import {
  PACKAGES_CATEGORY,
  bookingCategories,
  nailArtLabel,
  nailArtNote,
  nailArtStep,
  packageNote,
  sameCategory,
  serviceBookingCategory,
  serviceCategoriesOf,
} from '@/lib/booking-options';
import {
  addDays,
  atTime,
  currency,
  dateLabel,
  normalizePhone,
  today,
  uid,
  whatsapp,
} from '@/lib/utils';
import { useStudio } from './studio-provider';
import { Avatar, Brand, Empty, Field, formValues, value } from './ui';
import { ServicePhoto } from './service-photo';
import { BookingConfirmation } from './booking-confirmation';
// Categoria escolhida na etapa 1: uma das categorias do studio ou "Pacotes".
type FlowCategory = string;
const CATEGORY_COLORS = ['#dbe9d8', '#eee2cf', '#dce9e8', '#f3dfd6', '#e7e9cd'];
/** "Escolha entre aplicação, manutenção ou um pacote." conforme as opções existentes. */
function categoryPrompt(options: string[]) {
  if (options.length < 2) return 'Escolha uma opção para ver os serviços.';
  return `Escolha entre ${options.slice(0, -1).join(', ')} ou ${options[options.length - 1]}.`;
}
export function BookingPage({ slug }: { slug: string }) {
  const { data, ready, demo, save, notify } = useStudio();
  const [remote, setRemote] = useState<PublicStudio | null>(null),
    [loading, setLoading] = useState(isSupabaseConfigured),
    [error, setError] = useState('');
  const [step, setStep] = useState(1),
    [serviceId, setServiceId] = useState(''),
    [professionalId, setProfessionalId] = useState(''),
    [date, setDate] = useState(addDays(today(), 1)),
    [time, setTime] = useState(''),
    [slots, setSlots] = useState<string[]>([]),
    [slotsLoading, setSlotsLoading] = useState(false),
    [sending, setSending] = useState(false),
    [customerName, setCustomerName] = useState(''),
    // Etapa 1 em três momentos: categoria → serviço → nail art (cortesia).
    [pick, setPick] = useState<'category' | 'service' | 'nailArt'>('category'),
    [category, setCategory] = useState<FlowCategory | ''>(''),
    [packageId, setPackageId] = useState(''),
    [nailArt, setNailArt] = useState(false);
  const studio: PublicStudio | null = demo
    ? ready && data.business.slug === slug
      ? {
          business: data.business,
          services: data.services.filter((s) => s.active),
          packages: data.packages.filter((p) => p.active),
          professionals: data.professionals.filter((p) => p.active),
          gallery: data.gallery,
        }
      : null
    : remote;
  const nailStep = nailArtStep(studio?.business.nail_art_step);
  const categoryList = serviceCategoriesOf(studio?.business);
  // Nail art não entra na lista: só pode ser incluída como cortesia de outro serviço.
  const categoryServices = (c: string) =>
      studio?.services.filter((s) => serviceBookingCategory(s, categoryList) === c) || [],
    mainCategories = bookingCategories(categoryList).filter((c) => categoryServices(c).length),
    // Pacotes cujo serviço pode ser agendado (ativo e que não seja de nail art).
    packages = (studio?.packages || []).filter((p) => {
      const s = studio?.services.find((x) => x.id === p.service_id);
      return s && serviceBookingCategory(s, categoryList) !== null;
    }),
    isPackages = category === PACKAGES_CATEGORY,
    pack = isPackages ? packages.find((p) => p.id === packageId) : undefined,
    services = category && !isPackages ? categoryServices(category) : [],
    service = isPackages
      ? pack && studio?.services.find((s) => s.id === pack.service_id)
      : services.find((s) => s.id === serviceId),
    // Valor exibido: preço do pacote ou do serviço.
    price = pack ? pack.price : service?.price || 0,
    packageLabel = pack ? `${pack.name} · ${pack.sessions} sessões` : '',
    professional = studio?.professionals.find((p) => p.id === professionalId);
  function chooseCategory(next: FlowCategory) {
    if (next !== category) {
      setCategory(next);
      setPackageId('');
      if (
        next === PACKAGES_CATEGORY ||
        isPackages ||
        !categoryServices(next).some((s) => s.id === serviceId)
      ) {
        setServiceId('');
        setTime('');
      }
    }
    setPick('service');
    setError('');
  }
  function choosePackage(id: string, serviceId: string) {
    setPackageId(id);
    chooseService(serviceId);
  }
  function chooseService(id: string) {
    setServiceId(id);
    setTime('');
    const pro = studio?.professionals[0];
    if (pro) setProfessionalId(pro.id);
    for (let offset = 0; offset < 14; offset++) {
      const candidate = addDays(today(), offset),
        day = String(new Date(`${candidate}T12:00:00-03:00`).getUTCDay());
      if (
        demo && pro
          ? availableSlots(data, candidate, id, pro.id).length > 0
          : studio?.business.hours[day]?.enabled && offset > 0
      ) {
        setDate(candidate);
        break;
      }
    }
    setPick('nailArt');
    setError('');
  }
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    supabase.rpc('get_public_studio', { p_slug: slug }).then(({ data, error }) => {
      if (active) {
        if (error) setError('Não foi possível carregar o studio. Tente novamente em instantes.');
        else setRemote(data as PublicStudio | null);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [slug]);
  useEffect(() => setTime(''), [date, serviceId, professionalId]);
  useEffect(() => {
    if (!serviceId || !professionalId) return;
    setSlotsLoading(true);
    let active = true;
    const supabase = getSupabase();
    if (!supabase) {
      setSlots(availableSlots(data, date, serviceId, professionalId));
      setSlotsLoading(false);
      return;
    }
    supabase
      .rpc('get_available_slots', {
        p_slug: slug,
        p_service: serviceId,
        p_professional: professionalId,
        p_date: date,
      })
      .then(({ data, error }) => {
        if (active) {
          setSlots(error ? [] : (data || []).map((s: { slot: string }) => s.slot));
          if (error) setError('Não foi possível consultar os horários. Tente outra data.');
          setSlotsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [date, serviceId, professionalId, slug, data]);
  async function book(event: FormEvent<HTMLFormElement>) {
    const form = formValues(event);
    setError('');
    if (sending) return;
    const name = value(form, 'name'),
      phone = normalizePhone(value(form, 'phone')),
      email = value(form, 'email');
    if (!/^\d{10,11}$/.test(phone)) {
      setError('Confira seu WhatsApp: informe DDD e número.');
      return;
    }
    if (!service || !category || !studio || !professional || !time) {
      setError('Escolha um serviço e um horário antes de continuar.');
      return;
    }
    setSending(true);
    try {
      const supabase = getSupabase();
      if (supabase) {
        const response = await fetch('/api/agendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            service_id: serviceId,
            professional_id: professionalId,
            date,
            time,
            name,
            phone,
            email,
            nail_art: nailArt,
            ...(pack ? { package_id: pack.id } : {}),
            website: value(form, 'website'),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível reservar.');
      } else {
        if (!availableSlots(data, date, serviceId, professionalId).includes(time))
          throw new Error('Esse horário acabou de ser ocupado. Escolha outro.');
        let client = data.clients.find((c) => normalizePhone(c.phone) === phone);
        if (!client) {
          client = {
            id: uid(),
            business_id: data.business.id,
            name,
            phone,
            email,
            birthday: null,
            notes: '',
            created_at: new Date().toISOString(),
          };
          if (!(await save('clients', client)))
            throw new Error('Não foi possível cadastrar a reserva.');
        }
        const starts = atTime(date, time);
        const appointment: Appointment = {
          id: uid(),
          business_id: data.business.id,
          client_id: client.id,
          service_id: serviceId,
          professional_id: professionalId,
          starts_at: starts,
          ends_at: new Date(new Date(starts).getTime() + service.duration * 60000).toISOString(),
          price: service.price,
          status: 'pending',
          payment_status: 'pending',
          payment_method: '',
          kind: 'booking',
          source: 'link',
          notes: nailArtNote(nailArt) + (pack ? packageNote(pack) : ''),
          customer_package_id: null,
          reminder_sent_at: null,
        };
        if (!(await save('appointments', appointment)))
          throw new Error('Não foi possível reservar esse horário.');
      }
      setCustomerName(name);
      setStep(4);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }
  if (loading || (!ready && demo))
    return (
      <div className="loading-screen">
        <Brand />
        <span className="loading-line" />
        <p>Preparando um momento só seu…</p>
      </div>
    );
  if (!studio)
    return (
      <div className="public-not-found">
        <Brand />
        <h1>Esse cantinho ainda não está aberto.</h1>
        <p>{error || 'Confira o endereço do studio e tente novamente.'}</p>
      </div>
    );
  const b = studio.business;
  return (
    <div className="booking-app">
      <header className="booking-header">
        <Link href={`/agendar/${b.slug}`} className="brand-link">
          <Brand />
        </Link>
        <span className="booking-header-note">
          <Heart size={14} />
          feito para você.
        </span>
      </header>
      {demo && (
        <div className="public-demo">
          Demonstração local · Sua reserva de exemplo aparecerá no painel deste navegador.
        </div>
      )}
      <main className={`booking-layout ${step === 4 ? 'is-confirmed' : ''}`}>
        <aside className="studio-intro">
          <div className="intro-emblem">
            <Flower2 size={65} strokeWidth={0.75} />
            <span>BELEZA QUE FLORESCE</span>
          </div>
          <span className="eyebrow">SEU MOMENTO DE AUTOCUIDADO</span>
          <h1>
            Um cuidado especial.
            <br />
            <em>Todo seu.</em>
          </h1>
          <p className="studio-description">{b.description}</p>
          <div className="studio-details">
            <span>
              <MapPin size={16} />
              {b.address}
            </span>
            <span>
              <ShieldCheck size={16} />
              Agendamento simples e seguro
            </span>
            {b.instagram && (
              <a
                href={`https://www.instagram.com/${encodeURIComponent(b.instagram.replace(/^@/, ''))}/`}
                target="_blank"
                rel="noreferrer"
              >
                <Instagram size={16} />@{b.instagram.replace(/^@/, '')}
              </a>
            )}
            {b.phone && (
              <a
                href={whatsapp(b.phone, `Olá! Gostaria de saber mais sobre o ${b.name}.`)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={16} />
                Fale com o studio
              </a>
            )}
          </div>
          {studio.gallery.length > 0 && (
            <div className="public-gallery">
              {studio.gallery.slice(0, 6).map((g) => (
                <img key={g.id} src={g.url} alt={g.caption} loading="lazy" />
              ))}
            </div>
          )}
          <div className="intro-bottom">
            <Flower2 size={20} strokeWidth={1} />
            <span>
              Detalhes que encantam.
              <br />
              Cuidado que fica.
            </span>
          </div>
        </aside>
        <section className="booking-panel">
          {step < 4 ? (
            <>
              <div className="booking-steps">
                {['Seu cuidado', 'Seu horário', 'Seus dados'].map((label, i) => (
                  <div key={label} className={step >= i + 1 ? 'active' : ''}>
                    <span>{step > i + 1 ? <Check size={13} /> : i + 1}</span>
                    <strong>{label}</strong>
                    {i < 2 && <i />}
                  </div>
                ))}
              </div>
              {(step > 1 || pick !== 'category') && (
                <button
                  className="text-button back-button"
                  onClick={() => {
                    if (step > 1) setStep(step - 1);
                    else setPick(pick === 'nailArt' ? 'service' : 'category');
                    setError('');
                  }}
                >
                  <ArrowLeft size={15} />
                  {step === 1 && pick === 'service' ? 'Trocar categoria' : 'Voltar'}
                </button>
              )}
              {step === 1 && pick === 'category' && (
                <>
                  <span className="eyebrow">VAMOS COMEÇAR PELO QUE VOCÊ AMA</span>
                  <h2>Qual será o seu cuidado?</h2>
                  <p className="booking-subtitle">
                    {categoryPrompt([
                      ...mainCategories.map((c) => c.toLowerCase()),
                      ...(packages.length ? ['um pacote'] : []),
                    ])}
                  </p>
                  {!b.booking_enabled ? (
                    <Empty
                      title="Uma pequena pausa por aqui"
                      text="O agendamento online está temporariamente fechado. Fale com o studio pelo WhatsApp."
                    />
                  ) : mainCategories.length || packages.length ? (
                    <div className="booking-services">
                      {mainCategories.map((c, index) => {
                        const list = categoryServices(c);
                        return (
                          <button
                            key={c}
                            className={`booking-service ${category === c ? 'selected' : ''}`}
                            onClick={() => chooseCategory(c)}
                          >
                            <span
                              className="service-photo booking-service-icon"
                              style={{
                                background: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                              }}
                            >
                              {sameCategory(c, 'Aplicação') ? (
                                <Sparkles size={22} strokeWidth={1.2} aria-hidden="true" />
                              ) : sameCategory(c, 'Manutenção') ? (
                                <RefreshCw size={21} strokeWidth={1.2} aria-hidden="true" />
                              ) : (
                                <Flower2 size={22} strokeWidth={1.2} aria-hidden="true" />
                              )}
                            </span>
                            <div>
                              <h3>{c}</h3>
                              <p>{list.map((s) => s.name).join(' · ')}</p>
                              <small>
                                {list.length} {list.length === 1 ? 'serviço' : 'serviços'}
                              </small>
                            </div>
                            <div>
                              <strong>
                                a partir de {currency(Math.min(...list.map((s) => s.price)))}
                              </strong>
                              <ChevronRight size={17} />
                            </div>
                          </button>
                        );
                      })}
                      {packages.length > 0 && (
                        <button
                          className={`booking-service ${isPackages ? 'selected' : ''}`}
                          onClick={() => chooseCategory(PACKAGES_CATEGORY)}
                        >
                          <span
                            className="service-photo booking-service-icon"
                            style={{ background: '#e8dfec' }}
                          >
                            <Gift size={21} strokeWidth={1.2} aria-hidden="true" />
                          </span>
                          <div>
                            <h3>Pacotes</h3>
                            <p>{packages.map((p) => p.name).join(' · ')}</p>
                            <small>
                              {packages.length} {packages.length === 1 ? 'pacote' : 'pacotes'}
                            </small>
                          </div>
                          <div>
                            <strong>
                              a partir de {currency(Math.min(...packages.map((p) => p.price)))}
                            </strong>
                            <ChevronRight size={17} />
                          </div>
                        </button>
                      )}
                    </div>
                  ) : (
                    <Empty
                      title="O menu está sendo preparado"
                      text="Em breve, novos momentos de cuidado por aqui."
                    />
                  )}
                  <div className="booking-small-note">
                    <ShieldCheck size={15} />
                    Você não precisa criar uma conta para agendar.
                  </div>
                </>
              )}
              {step === 1 && pick === 'nailArt' && service && (
                <>
                  <span className="eyebrow">{nailStep.eyebrow}</span>
                  <h2>{nailStep.title}</h2>
                  <p className="booking-subtitle">
                    {category} · {packageLabel || service.name} · {currency(price)}
                  </p>
                  {nailStep.photo_url && (
                    <img
                      className="nail-art-photo"
                      src={nailStep.photo_url}
                      alt="Exemplo de nail art do studio"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <div className="nail-art-picker" role="radiogroup" aria-label={nailStep.title}>
                    {[true, false].map((option) => (
                      <button
                        key={String(option)}
                        type="button"
                        role="radio"
                        aria-checked={nailArt === option}
                        className={nailArt === option ? 'selected' : ''}
                        onClick={() => setNailArt(option)}
                      >
                        <strong>{option ? nailStep.yes_label : nailStep.no_label}</strong>
                        <small>{option ? nailStep.yes_hint : nailStep.no_hint}</small>
                        {nailArt === option && <Check size={15} />}
                      </button>
                    ))}
                  </div>
                  <p className="form-note nail-art-note">
                    <Heart size={13} />
                    {nailStep.note}
                  </p>
                  <div className="booking-next">
                    <span>
                      {currency(price)} · Nail art: {nailArtLabel(nailArt)}
                    </span>
                    <button
                      className="button primary"
                      onClick={() => {
                        setStep(2);
                        setError('');
                      }}
                    >
                      Continuar <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}
              {step === 1 && pick === 'nailArt' && !service && (
                <Empty
                  title="Escolha um serviço"
                  text="Volte e selecione um serviço para continuar."
                />
              )}
              {step === 1 && pick === 'service' && (
                <>
                  <span className="eyebrow">{category.toUpperCase()}</span>
                  <h2>Qual será o seu cuidado?</h2>
                  <p className="booking-subtitle">
                    {isPackages
                      ? 'Escolha o pacote e agende a primeira sessão.'
                      : 'Escolha o serviço para reservar seu momento.'}
                  </p>
                  {isPackages ? (
                    <div className="booking-services">
                      {packages.map((p) => {
                        const s = studio.services.find((x) => x.id === p.service_id)!;
                        return (
                          <button
                            key={p.id}
                            className={`booking-service ${p.id === packageId ? 'selected' : ''}`}
                            onClick={() => choosePackage(p.id, s.id)}
                          >
                            <ServicePhoto
                              service={s}
                              className={`booking-service-icon ${s.photo_url ? 'with-photo' : ''}`}
                            />
                            <div>
                              <h3>{p.name}</h3>
                              <p>
                                {s.name} · {p.sessions} sessões
                              </p>
                              <small>
                                <Clock3 size={12} />
                                {s.duration} min por sessão · válido por {p.validity_days} dias
                              </small>
                            </div>
                            <div>
                              <strong>{currency(p.price)}</strong>
                              <ChevronRight size={17} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : services.length ? (
                    <div className="booking-services">
                      {services.map((s) => (
                        <button
                          key={s.id}
                          className={`booking-service ${s.id === serviceId ? 'selected' : ''}`}
                          onClick={() => chooseService(s.id)}
                        >
                          <ServicePhoto
                            service={s}
                            className={`booking-service-icon ${s.photo_url ? 'with-photo' : ''}`}
                          />
                          <div>
                            <h3>{s.name}</h3>
                            <p>{s.description}</p>
                            <small>
                              <Clock3 size={12} />
                              {s.duration} min
                            </small>
                          </div>
                          <div>
                            <strong>{currency(s.price)}</strong>
                            <ChevronRight size={17} />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="O menu está sendo preparado"
                      text="Em breve, novos momentos de cuidado por aqui."
                    />
                  )}
                  <div className="booking-small-note">
                    <ShieldCheck size={15} />
                    Você não precisa criar uma conta para agendar.
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <span className="eyebrow">UMA PAUSA NA ROTINA</span>
                  <h2>Quando é o seu momento?</h2>
                  <p className="booking-subtitle">
                    {category} · {packageLabel ? `${packageLabel} · 1ª sessão: ` : ''}
                    {service?.name} · {service?.duration} min · {currency(price)} · Nail art:{' '}
                    {nailArtLabel(nailArt)}
                  </p>
                  <div className="field">
                    <span>Quem vai cuidar de você?</span>
                    <div className="professional-picker">
                      {studio.professionals.map((p) => (
                        <button
                          key={p.id}
                          className={p.id === professionalId ? 'selected' : ''}
                          type="button"
                          onClick={() => setProfessionalId(p.id)}
                        >
                          <Avatar name={p.name} color={p.color + '40'} />
                          <strong>{p.name}</strong>
                          {p.id === professionalId && <Check size={15} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  {!studio.professionals.length && (
                    <p className="form-note">
                      O studio está organizando sua equipe. Entre em contato para agendar.
                    </p>
                  )}
                  <div className="booking-date-heading">
                    <strong>Escolha o dia</strong>
                    <input
                      type="date"
                      aria-label="Data do agendamento"
                      value={date}
                      min={today()}
                      max={addDays(today(), 90)}
                      onChange={(e) => {
                        if (e.target.value) setDate(e.target.value);
                      }}
                    />
                  </div>
                  <div className="booking-days">
                    {Array.from({ length: 7 }, (_, i) => addDays(today(), i)).map((d) => (
                      <button
                        key={d}
                        className={date === d ? 'selected' : ''}
                        onClick={() => setDate(d)}
                      >
                        <small>{dateLabel(d, { weekday: 'short' }).replace('.', '')}</small>
                        <strong>{dateLabel(d, { day: '2-digit' })}</strong>
                        <span>{dateLabel(d, { month: 'short' }).replace('.', '')}</span>
                      </button>
                    ))}
                  </div>
                  <h3 className="slots-heading">
                    Horários disponíveis <small>Horário de Brasília</small>
                  </h3>
                  {slotsLoading ? (
                    <p className="muted">Procurando um espaço para você…</p>
                  ) : slots.length ? (
                    <div className="slot-grid">
                      {slots.map((t) => (
                        <button
                          key={t}
                          className={time === t ? 'selected' : ''}
                          onClick={() => setTime(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="no-slots">
                      <Clock3 size={21} />
                      <p>
                        Nenhum horário disponível nesse dia.
                        <br />
                        <small>Escolha outra data para encontrar o seu momento.</small>
                      </p>
                    </div>
                  )}
                  <div className="booking-next">
                    <span>
                      {time ? `${dateLabel(date)} às ${time}` : 'Escolha um horário para continuar'}
                    </span>
                    <button
                      className="button primary"
                      disabled={!time}
                      onClick={() => {
                        setStep(3);
                        setError('');
                      }}
                    >
                      Continuar <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <span className="eyebrow">ESTÁ QUASE TUDO PRONTO</span>
                  <h2>Como podemos te chamar?</h2>
                  <p className="booking-subtitle">
                    Só precisamos de alguns detalhes para cuidar da sua reserva.
                  </p>
                  <div className="booking-summary">
                    {service && <ServicePhoto service={service} className="booking-service-icon" />}
                    <div>
                      <strong>{service?.name}</strong>
                      <p>
                        {dateLabel(date, { weekday: 'short', day: 'numeric', month: 'long' })} ·{' '}
                        {time}
                      </p>
                      <small>
                        {professional?.name} · {service?.duration} min
                      </small>
                      <small className="booking-summary-extra">
                        {category} · {packageLabel && `Pacote ${packageLabel} · `}Nail art:{' '}
                        {nailArtLabel(nailArt)}
                      </small>
                    </div>
                    <strong>{currency(price)}</strong>
                  </div>
                  <form className="booking-form" onSubmit={book}>
                    <Field label="Seu nome completo">
                      <input
                        name="name"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={120}
                        placeholder="Como você gosta de ser chamada?"
                      />
                    </Field>
                    <Field label="Seu WhatsApp com DDD">
                      <input
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        maxLength={30}
                        placeholder="(33) 99999-9999"
                      />
                    </Field>
                    <Field
                      label="Seu e-mail (opcional)"
                      hint="Para receber lembretes, quando disponíveis."
                    >
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        placeholder="voce@email.com"
                      />
                    </Field>
                    <div className="honeypot" aria-hidden="true">
                      <input name="website" tabIndex={-1} autoComplete="off" />
                    </div>
                    <label className="check-field booking-consent">
                      <input type="checkbox" required />
                      <span>
                        Concordo que o studio use meu nome e contato para organizar e confirmar este
                        atendimento.
                      </span>
                    </label>
                    <p className="booking-policy">
                      Se precisar cancelar ou remarcar, entre em contato com o studio com pelo menos{' '}
                      {b.cancellation_hours} horas de antecedência. Pagamento no atendimento:{' '}
                      {b.payment_methods.join(', ')}.
                    </p>
                    {error && (
                      <p className="error-message" role="alert">
                        {error}
                      </p>
                    )}
                    <button className="button primary full-width" disabled={sending} type="submit">
                      {sending ? 'Reservando seu momento…' : 'Confirmar minha reserva'}{' '}
                      <Check size={17} />
                    </button>
                    <small className="booking-privacy">
                      <ShieldCheck size={13} />
                      Seus dados ficam somente com o studio.
                    </small>
                  </form>
                </>
              )}
              {error && step !== 3 && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
            </>
          ) : (
            <BookingConfirmation
              customerName={customerName}
              date={date}
              time={time}
              address={b.address}
              studioName={b.name}
              service={service!}
              category={category}
              nailArt={nailArt}
              pack={pack}
              professionalName={professional?.name || ''}
              onBookAgain={() => {
                setStep(1);
                setPick('category');
                setCategory('');
                setServiceId('');
                setPackageId('');
                setNailArt(false);
                setTime('');
                setError('');
              }}
            />
          )}
        </section>
      </main>
      <footer className="booking-footer">
        <Brand compact />
        <span>{b.name} · Carinho em cada detalhe.</span>
      </footer>
    </div>
  );
}
