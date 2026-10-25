import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
type ReminderRow = {
  id: string;
  starts_at: string;
  client: { name: string; email: string };
  service: { name: string };
  business: { name: string; email_reminders: boolean; reminder_hours: number };
};
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret || ''}`),
    actual = Buffer.from(request.headers.get('authorization') || '');
  if (
    !secret ||
    secret.length < 24 ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  )
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const {
    RESEND_API_KEY,
    REMINDER_FROM_EMAIL,
    SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL,
  } = process.env;
  if (
    !RESEND_API_KEY ||
    !REMINDER_FROM_EMAIL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !NEXT_PUBLIC_SUPABASE_URL
  )
    return NextResponse.json({ error: 'Envio ainda não configurado.' }, { status: 503 });
  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = Date.now();
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id,starts_at,client:clients!appointments_business_id_client_id_fkey(name,email),service:services!appointments_business_id_service_id_fkey(name),business:businesses!inner(name,email_reminders,reminder_hours)',
    )
    .eq('kind', 'booking')
    .eq('status', 'confirmed')
    .eq('business.email_reminders', true)
    .is('reminder_sent_at', null)
    .gt('starts_at', new Date(now).toISOString())
    .lt('starts_at', new Date(now + 168 * 3600000).toISOString())
    .order('starts_at')
    .limit(100);
  if (error) return NextResponse.json({ error: 'Falha ao consultar lembretes.' }, { status: 500 });
  let sent = 0,
    failed = 0;
  for (const row of data as unknown as ReminderRow[]) {
    if (
      !row.business?.email_reminders ||
      !row.client?.email ||
      new Date(row.starts_at).getTime() > now + row.business.reminder_hours * 3600000
    )
      continue;
    const appointmentDate = new Date(row.starts_at).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `appointment-reminder/${row.id}/${row.starts_at}`,
        },
        body: JSON.stringify({
          from: REMINDER_FROM_EMAIL,
          to: [row.client.email],
          subject: `Seu momento de cuidado no ${row.business.name}`,
          html: `<div style="font-family:Arial,sans-serif;color:#355b43;max-width:520px;margin:0 auto;padding:32px;background:#f7f8f2"><h2>Um lembrete de carinho.</h2><p>Oi, ${escapeHtml(row.client.name.split(' ')[0])}!</p><p>Seu atendimento de <strong>${escapeHtml(row.service.name)}</strong> no ${escapeHtml(row.business.name)} está marcado para <strong>${escapeHtml(appointmentDate)}</strong> (horário de Brasília).</p><p>Esperamos você para esse momento de cuidado.</p><small>Para remarcar, fale diretamente com o studio.</small></div>`,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        failed++;
        continue;
      }
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('starts_at', row.starts_at);
      if (updateError) failed++;
      else sent++;
    } catch {
      failed++;
    }
  }
  return NextResponse.json(
    { sent, failed },
    { status: failed ? 207 : 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
