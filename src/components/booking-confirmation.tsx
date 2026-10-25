'use client';
import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  MessageCircle,
  UserRound,
} from 'lucide-react';
import type { Service } from '@/lib/types';
import { currency, dateLabel } from '@/lib/utils';
import { clientConfirmationLink } from '@/lib/whatsapp-confirmations';
import { ServicePhoto } from './service-photo';

export type BookingConfirmationProps = {
  customerName: string;
  date: string;
  time: string;
  address: string;
  studioName: string;
  service: Service;
  professionalName: string;
  onBookAgain: () => void;
};
export function BookingConfirmation({
  customerName,
  date,
  time,
  address,
  studioName,
  service,
  professionalName,
  onBookAgain,
}: BookingConfirmationProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.parentElement?.scrollIntoView({ block: 'start' });
  }, []);
  const mapsUrl = address.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
    : '';
  return (
    <div className="booking-confirmation">
      <div className="confirmation-received">
        <span>
          <Check size={16} strokeWidth={2} />
        </span>
        RESERVA RECEBIDA
      </div>
      <h2 ref={heading} tabIndex={-1}>
        {customerName.trim().split(/\s+/)[0]}, seu momento
        <br />
        <em>já tem dia e hora.</em>
      </h2>
      <p className="confirmation-intro">
        Guarde os detalhes abaixo. O studio recebeu sua solicitação e vai confirmar o atendimento
        com você.
      </p>
      <div className="confirmation-card" aria-label="Dia, horário e local do atendimento">
        <div className="confirmation-schedule">
          <div className="confirmation-date">
            <span className="confirmation-label">
              <CalendarDays size={17} />
              DIA DO ATENDIMENTO
            </span>
            <small>{dateLabel(date, { weekday: 'long' })}</small>
            <time dateTime={date}>{dateLabel(date, { day: 'numeric', month: 'long' })}</time>
            <span className="confirmation-year">{date.slice(0, 4)}</span>
          </div>
          <div className="confirmation-time">
            <span className="confirmation-label">
              <Clock3 size={17} />
              SEU HORÁRIO
            </span>
            <time dateTime={`${date}T${time}:00-03:00`}>{time}</time>
            <span>Horário de Brasília · {service.duration} min</span>
          </div>
        </div>
        <div className="confirmation-address">
          <span className="confirmation-location-icon">
            <MapPin size={24} strokeWidth={1.5} />
          </span>
          <div>
            <span className="confirmation-label">ONDE TE ESPERAMOS</span>
            <strong>
              {address.trim() || 'O studio informará o endereço antes do atendimento.'}
            </strong>
            <small>{studioName}</small>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer">
                Ver endereço no mapa <ArrowUpRight size={15} />
              </a>
            )}
          </div>
        </div>
        <div className="confirmation-service">
          <ServicePhoto service={service} />
          <div>
            <strong>{service.name}</strong>
            <span>
              <UserRound size={13} />
              Com {professionalName}
            </span>
          </div>
          <div className="confirmation-price">
            <strong>{currency(service.price)}</strong>
            <span>no atendimento</span>
          </div>
        </div>
      </div>
      <p className="confirmation-save-note">
        Você pode tirar um print desta tela para lembrar do seu horário e do endereço.
      </p>
      <a
        href={clientConfirmationLink({
          customerName,
          date,
          time,
          address,
          studioName,
          serviceName: service.name,
          professionalName,
        })}
        className="button primary confirmation-whatsapp"
        target="_blank"
        rel="noreferrer"
      >
        <MessageCircle size={18} />
        Confirmar pelo WhatsApp
      </a>
      <p className="confirmation-whatsapp-note">
        Abre o WhatsApp do studio com os dados da sua reserva. É só revisar e enviar.
      </p>
      <button className="text-button confirmation-again" onClick={onBookAgain}>
        Agendar outro cuidado <ArrowRight size={15} />
      </button>
    </div>
  );
}
