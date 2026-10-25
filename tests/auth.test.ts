import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthScreen } from '../src/components/auth-screen';
import { requestOrigin, hasSameOrigin } from '../src/lib/request-origin';
import { safeAuthError } from '../src/lib/auth-messages';
import { isAllowedAdmin } from '../src/lib/admin-access';
import { POST } from '../src/app/auth/credentials/route';

test('acesso envia login e recuperação por POST, sem oferecer cadastro', () => {
  for (const initialMode of ['login', 'reset'] as const) {
    const html = renderToStaticMarkup(createElement(AuthScreen, { initialMode }));
    assert.match(html, /<form\b[^>]*action="\/auth\/credentials"[^>]*method="post"/);
    assert(html.includes(`name="mode" value="${initialMode}"`));
    assert(!html.includes('mode=signup'));
    assert(!html.includes('Criar minha conta'));
  }
});

test('restrição administrativa nega outros usuários e falha fechada sem configuração', () => {
  const adminId = '10000000-0000-4000-8000-000000000001';
  assert.equal(isAllowedAdmin(adminId, adminId), true);
  assert.equal(isAllowedAdmin('10000000-0000-4000-8000-000000000002', adminId), false);
  assert.equal(isAllowedAdmin(undefined, adminId), false);
  assert.equal(isAllowedAdmin(adminId, ''), false);
});

test('POST de cadastro manipulado não consegue criar conta', async () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'chave-publica-de-teste';
  try {
    const response = await POST(
      new Request('http://localhost:3000/auth/credentials', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
        body: new URLSearchParams({
          mode: 'signup',
          email: 'teste@example.com',
          password: 'SenhaSomenteTeste123!',
        }),
      }),
    );
    assert.equal(response.status, 303);
    assert.equal(
      new URL(response.headers.get('location')!).searchParams.get('error'),
      'signup_disabled',
    );
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});
test('origem local considera Host sem aceitar um site diferente', () => {
  const valid = new Request('http://localhost:3000/auth/credentials', {
    headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' },
  });
  assert.equal(requestOrigin(valid), 'http://127.0.0.1:3000');
  assert.equal(hasSameOrigin(valid), true);
  assert.equal(
    hasSameOrigin(
      new Request(valid, {
        headers: { host: '127.0.0.1:3000', origin: 'https://outro-site.example' },
      }),
    ),
    false,
  );
});
test('redirecionamentos de autenticação usam somente códigos de erro conhecidos', () => {
  assert.equal(safeAuthError('invalid_credentials'), 'invalid_credentials');
  assert.equal(safeAuthError('senha-ou-texto-sensivel'), 'request_failed');
  assert.equal(safeAuthError('__proto__'), 'request_failed');
});
