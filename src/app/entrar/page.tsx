import { AuthScreen } from '@/components/auth-screen';
import { authErrors, authMessages } from '@/lib/auth-messages';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const mode = params.mode === 'reset' ? 'reset' : 'login';
  const error =
    typeof params.error === 'string' && Object.hasOwn(authErrors, params.error)
      ? authErrors[params.error]
      : '';
  const message =
    typeof params.message === 'string' && Object.hasOwn(authMessages, params.message)
      ? authMessages[params.message]
      : '';
  return (
    <AuthScreen
      key={mode}
      initialMode={mode}
      initialError={error}
      initialMessage={message}
      bookingSlug={process.env.STUDIO_PUBLIC_SLUG}
    />
  );
}
