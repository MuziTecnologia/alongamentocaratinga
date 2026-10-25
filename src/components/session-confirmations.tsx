'use client';
import { useEffect, useState } from 'react';
import { Clock3, MessageCircle } from 'lucide-react';
import type { Client, StudioData } from '@/lib/types';
import { normalizePhone, timeLabel } from '@/lib/utils';
import { adminConfirmationLink, isWithinConfirmationHour } from '@/lib/whatsapp-confirmations';
import { useStudio } from './studio-provider';
import { Avatar, SectionHead } from './ui';

export function UpcomingConfirmations({
  onEditClient,
}: {
  onEditClient: (client: Client) => void;
}) {
  const { data } = useStudio();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 15_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return <SessionConfirmations data={data} now={now} onEditClient={onEditClient} />;
}

export function SessionConfirmations({
  data,
  now,
  onEditClient,
}: {
  data: StudioData;
  now: number;
  onEditClient: (client: Client) => void;
}) {
  const appointments = data.appointments
    .filter((a) => isWithinConfirmationHour(a, now))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return (
    <section
      className="panel session-confirmations"
      aria-label="Confirmações de atendimento pelo WhatsApp"
    >
      <SectionHead
        title="Confirmar os próximos atendimentos"
        subtitle="O botão fica disponível quando faltar até 1 hora para a sessão."
        action={
          <span className="mini-icon">
            <MessageCircle size={20} />
          </span>
        }
      />
      {appointments.length ? (
        <div className="session-confirmation-list">
          {appointments.map((appointment) => {
            const client = data.clients.find((c) => c.id === appointment.client_id);
            const service = data.services.find((s) => s.id === appointment.service_id);
            const professional = data.professionals.find(
              (p) => p.id === appointment.professional_id,
            );
            const hasPhone = client && /^\d{10,11}$/.test(normalizePhone(client.phone));
            const minutes = Math.ceil((Date.parse(appointment.starts_at) - now) / 60_000);
            return (
              <div className="session-confirmation-row" key={appointment.id}>
                <div className="session-confirmation-time">
                  <strong>{timeLabel(appointment.starts_at)}</strong>
                  <span>
                    <Clock3 size={12} />
                    Em {minutes} min
                  </span>
                </div>
                <Avatar name={client?.name || 'Cliente'} color={service?.color} />
                <div className="session-confirmation-person">
                  <strong>{client?.name || 'Cliente sem cadastro'}</strong>
                  <span>
                    {service?.name || 'Atendimento'}
                    {professional ? ` · ${professional.name}` : ''}
                  </span>
                </div>
                {hasPhone ? (
                  <a
                    className="button primary small-button"
                    href={adminConfirmationLink({
                      phone: client.phone,
                      customerName: client.name,
                      studioName: data.business.name,
                      serviceName: service?.name || 'cuidado',
                      professionalName: professional?.name || '',
                      address: data.business.address,
                      startsAt: appointment.starts_at,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Confirmar atendimento de ${client.name} no WhatsApp`}
                  >
                    <MessageCircle size={16} />
                    Confirmar atendimento
                  </a>
                ) : client ? (
                  <button
                    className="button secondary small-button"
                    onClick={() => onEditClient(client)}
                  >
                    Adicionar WhatsApp
                  </button>
                ) : (
                  <span className="muted">Cadastre a cliente e o WhatsApp na agenda.</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="session-confirmation-empty">
          <Clock3 size={19} />
          Nenhum atendimento na próxima hora. As sessões aparecem aqui automaticamente.
        </p>
      )}
      <p className="session-confirmation-note">
        A mensagem abre no WhatsApp da cliente para você revisar e enviar. O status na agenda
        continua sob seu controle.
      </p>
    </section>
  );
}
