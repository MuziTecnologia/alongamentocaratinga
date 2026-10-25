import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { safeAuthError } from '@/lib/auth-messages';
import { z } from 'zod';
import { requestOrigin, hasSameOrigin } from '@/lib/request-origin';
import { isAllowedAdmin } from '@/lib/admin-access';

const modes = ['login', 'reset', 'new-password'] as const;
const schema = z.object({
  mode: z.enum(modes),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(1).max(128).optional(),
});

// Native form fallback: credentials always travel in a POST body, even before hydration.
// This endpoint uses the public key and the ordinary Supabase Auth flow, never an admin key.
export async function POST(request: Request) {
  const origin = requestOrigin(request);
  if (!hasSameOrigin(request)) return new Response('Origem não permitida.', { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 8192)
    return new Response('Solicitação muito grande.', { status: 413 });
  let mode: (typeof modes)[number] = 'login';
  const back = (field: 'error' | 'message', code: string) => {
    const target = new URL(mode === 'new-password' ? '/redefinir-senha' : '/entrar', origin);
    if (mode !== 'login' && mode !== 'new-password') target.searchParams.set('mode', mode);
    target.searchParams.set(field, code);
    const response = NextResponse.redirect(target, 303);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return back('error', 'not_configured');
  try {
    const form = await request.formData();
    if (form.get('mode') === 'signup') return back('error', 'signup_disabled');
    const result = schema.safeParse({
      mode: form.get('mode'),
      email: form.get('email') || undefined,
      password: form.get('password') || undefined,
    });
    if (!result.success) return back('error', 'validation_failed');
    mode = result.data.mode;
    const { email, password } = result.data;
    if (
      (mode !== 'new-password' && !email) ||
      (mode !== 'reset' && !password) ||
      (mode === 'new-password' && password!.length < 8)
    )
      return back('error', 'validation_failed');
    const supabase = await createSupabaseServer();
    if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email!,
        password: password!,
      });
      if (error) return back('error', safeAuthError(error.code));
      if (!isAllowedAdmin(data.user?.id)) {
        await supabase.auth.signOut({ scope: 'local' });
        return back('error', 'account_not_allowed');
      }
    } else if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email!, {
        redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
      });
      if (error) return back('error', safeAuthError(error.code));
      return back('message', 'recovery_sent');
    } else {
      const { data: auth } = await supabase.auth.getUser();
      if (!isAllowedAdmin(auth.user?.id)) return back('error', 'account_not_allowed');
      const { error } = await supabase.auth.updateUser({ password: password! });
      if (error) return back('error', safeAuthError(error.code));
    }
    const response = NextResponse.redirect(new URL('/', origin), 303);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return back('error', 'request_failed');
  }
}
