import { AuthScreen } from '@/components/auth-screen';
export default function Page() {
  return <AuthScreen recovery bookingSlug={process.env.STUDIO_PUBLIC_SLUG} />;
}
