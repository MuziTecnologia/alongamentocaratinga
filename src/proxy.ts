import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAllowedAdmin } from '@/lib/admin-access';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const privatePath =
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/painel') ||
    request.nextUrl.pathname === '/redefinir-senha';
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return privatePath
      ? NextResponse.redirect(new URL('/entrar?error=not_configured', request.url))
      : response;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims();
  if (privatePath && !isAllowedAdmin(data?.claims?.sub)) {
    const target = new URL('/entrar', request.url);
    if (data?.claims) target.searchParams.set('error', 'account_not_allowed');
    return NextResponse.redirect(target);
  }
  return response;
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)'],
};
