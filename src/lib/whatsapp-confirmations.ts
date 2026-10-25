import type { Appointment } from './types';
import { dateLabel, timeLabel, whatsapp } from './utils';

export const STUDIO_CONFIRMATION_PHONE = '553197311275';

type BookingDetails = {
  customerName: string;
  studioName: string;
  serviceName: string;
  professionalName: string;
  address: string;
};

const singleLine = (text: string) => text.replace(/\s+/g, ' ').trim();

function appointmentSummary(details: BookingDetails, date: string, time: string) {
  const professional = singleLine(details.professionalName);
  const address = singleLine(details.address).replace(/[\s,;:.!?]+$/g, '');
  return [
    `*Serviço:* ${singleLine(details.serviceName)}`,
    `*Data:* ${dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
    `*Horário:* ${time} (horário de Brasília)`,
    professional &&
      professional.toLowerCase() !== 'minha agenda' &&
      `*Profissional:* ${professional}`,
    address && `*Endereço:* ${address}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function clientConfirmationLink(details: BookingDetails & { date: string; time: string }) {
  const { customerName, studioName, date, time } = details;
  return whatsapp(
    STUDIO_CONFIRMATION_PHONE,
    [
      `*CONFIRMAÇÃO DE AGENDAMENTO*\n*${singleLine(studioName)}*`,
      `Olá! Sou *${singleLine(customerName)}*.\nConfirmo minha presença no atendimento abaixo:`,
      appointmentSummary(details, date, time),
      'Até lá!',
    ]
      .filter(Boolean)
      .join('\n\n'),
  );
}

export function isWithinConfirmationHour(appointment: Appointment, now: number) {
  const remaining = Date.parse(appointment.starts_at) - now;
  return (
    appointment.kind === 'booking' &&
    ['pending', 'confirmed'].includes(appointment.status) &&
    remaining > 0 &&
    remaining <= 60 * 60 * 1000
  );
}

export function adminConfirmationLink(
  details: BookingDetails & { phone: string; startsAt: string },
) {
  const { customerName, studioName, phone, startsAt } = details;
  return whatsapp(
    phone,
    [
      `*LEMBRETE DE ATENDIMENTO*\n*${singleLine(studioName)}*`,
      `Olá, *${singleLine(customerName)}*!\nSeu momento de cuidado está chegando. Confira os detalhes:`,
      appointmentSummary(details, startsAt, timeLabel(startsAt)),
      '*Você confirma sua presença?*\nEstamos te esperando!',
    ]
      .filter(Boolean)
      .join('\n\n'),
  );
}
