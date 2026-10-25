import type { Appointment, StudioData } from './types';
import { atTime, minutes } from './utils';
export const occupiesTime = (a: Appointment) => a.status !== 'cancelled' && a.status !== 'no_show';
export function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return (
    new Date(aStart).getTime() < new Date(bEnd).getTime() &&
    new Date(aEnd).getTime() > new Date(bStart).getTime()
  );
}
export function validateAppointment(data: StudioData, appointment: Appointment) {
  if (!(new Date(appointment.ends_at).getTime() > new Date(appointment.starts_at).getTime()))
    throw new Error('O fim deve ser depois do início.');
  if (!data.professionals.some((p) => p.id === appointment.professional_id))
    throw new Error('Selecione uma profissional.');
  if (
    appointment.kind === 'booking' &&
    (!data.clients.some((c) => c.id === appointment.client_id) ||
      !data.services.some((s) => s.id === appointment.service_id))
  )
    throw new Error('Selecione cliente e serviço.');
  if (
    occupiesTime(appointment) &&
    data.appointments.some(
      (a) =>
        a.id !== appointment.id &&
        a.professional_id === appointment.professional_id &&
        occupiesTime(a) &&
        overlap(a.starts_at, a.ends_at, appointment.starts_at, appointment.ends_at),
    )
  )
    throw new Error('Esse horário já está ocupado ou bloqueado. Escolha outro horário.');
  if (appointment.customer_package_id && !['cancelled', 'no_show'].includes(appointment.status)) {
    const pack = data.customer_packages.find((p) => p.id === appointment.customer_package_id);
    const definition = data.packages.find((p) => p.id === pack?.package_id);
    const previous = data.appointments.find((a) => a.id === appointment.id);
    const alreadyUsed =
      previous?.status === 'completed' && previous.customer_package_id === pack?.id;
    if (
      !pack ||
      pack.client_id !== appointment.client_id ||
      definition?.service_id !== appointment.service_id ||
      pack.expires_at < appointment.starts_at.slice(0, 10) ||
      (!alreadyUsed && pack.sessions_used >= pack.sessions_total)
    )
      throw new Error('Pacote incompatível, vencido ou sem sessões disponíveis.');
  }
}
export function availableSlots(
  data: StudioData,
  date: string,
  serviceId: string,
  professionalId: string,
  now = new Date(),
) {
  const service = data.services.find((s) => s.id === serviceId && s.active);
  if (
    !service ||
    !data.business.booking_enabled ||
    !data.professionals.some((p) => p.id === professionalId && p.active)
  )
    return [];
  const weekday = String(new Date(`${date}T12:00:00-03:00`).getUTCDay());
  const hours = data.business.hours[weekday];
  if (!hours?.enabled) return [];
  const result: string[] = [];
  for (let m = minutes(hours.start); m + service.duration <= minutes(hours.end); m += 30) {
    const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const start = atTime(date, time),
      end = new Date(new Date(start).getTime() + service.duration * 60000).toISOString();
    if (new Date(start).getTime() < now.getTime() + data.business.notice_hours * 3600000) continue;
    if (
      hours.break_start &&
      hours.break_end &&
      m < minutes(hours.break_end) &&
      m + service.duration > minutes(hours.break_start)
    )
      continue;
    if (
      !data.appointments.some(
        (a) =>
          a.professional_id === professionalId &&
          occupiesTime(a) &&
          overlap(start, end, a.starts_at, a.ends_at),
      )
    )
      result.push(time);
  }
  return result;
}
