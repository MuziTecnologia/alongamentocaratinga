import type { Metadata } from 'next';
import { BookingPage } from '@/components/booking-page';
import { redirect } from 'next/navigation';
export const metadata: Metadata = {
  title: 'Reserve seu momento',
  description:
    'Escolha seu cuidado, encontre um horário e reserve seu momento com o AlongamentosCaratinga.',
};
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const canonical = process.env.STUDIO_PUBLIC_SLUG;
  const previousSlugs = (process.env.STUDIO_LEGACY_SLUGS || '')
    .split(',')
    .map((value) => value.trim());
  if (canonical && canonical !== slug && previousSlugs.includes(slug))
    redirect(`/agendar/${canonical}`);
  return <BookingPage slug={slug} />;
}
