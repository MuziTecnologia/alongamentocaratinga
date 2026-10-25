import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { isAllowedAdmin } from '@/lib/admin-access';
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get('code');
  const next = url.searchParams.get('next') === '/redefinir-senha' ? '/redefinir-senha' : '/';
  if (code && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      if (isAllowedAdmin(data.user?.id)) return NextResponse.redirect(new URL(next, url.origin));
      await supabase.auth.signOut({ scope: 'local' });
      return NextResponse.redirect(new URL('/entrar?error=account_not_allowed', url.origin));
    }
  }
  return NextResponse.redirect(new URL('/entrar?erro=link-invalido', url.origin));
}
