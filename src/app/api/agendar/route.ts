import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServer } from '@/lib/supabase/server';
import { hasSameOrigin } from '@/lib/request-origin';
const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/),
  service_id: z.uuid(),
  professional_id: z.uuid(),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  name: z.string().trim().min(2).max(120),
  phone: z.string().regex(/^\d{10,11}$/),
  email: z.union([z.email().max(254), z.literal('')]),
  website: z.literal('').optional(),
});
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return NextResponse.json({ error: 'Studio ainda não conectado.' }, { status: 503 });
  if (Number(request.headers.get('content-length') || 0) > 4096)
    return NextResponse.json({ error: 'Solicitação muito grande.' }, { status: 413 });
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: 'Origem não permitida.' }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 4096)
      return NextResponse.json({ error: 'Solicitação muito grande.' }, { status: 413 });
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return NextResponse.json(
        { error: 'Confira os dados da reserva e tente novamente.' },
        { status: 400 },
      );
    const input = parsed.data;
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.rpc('book_appointment', {
      p_slug: input.slug,
      p_service: input.service_id,
      p_professional: input.professional_id,
      p_date: input.date,
      p_time: input.time,
      p_name: input.name,
      p_phone: input.phone,
      p_email: input.email,
    });
    if (error)
      return NextResponse.json(
        {
          error:
            error.code === '23P01'
              ? 'Esse horário acabou de ser reservado. Escolha outro.'
              : error.code === 'P0001'
                ? error.message
                : 'Não foi possível reservar. Tente novamente.',
        },
        { status: 409 },
      );
    return NextResponse.json(
      { id: data },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Não foi possível processar a reserva.' }, { status: 400 });
  }
}
