import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { StudioProvider } from '@/components/studio-provider';
import './globals.css';
export const metadata: Metadata = {
  title: {
    default: 'AlongamentosCaratinga · Seu espaço de cuidado',
    template: '%s · AlongamentosCaratinga',
  },
  description:
    'Seu studio, em boas mãos. Agenda, clientes e momentos de autocuidado em um só lugar.',
  applicationName: 'AlongamentosCaratinga',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#355b43' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        <noscript>
          <div
            style={{
              padding: '16px',
              background: '#f2f6e9',
              color: '#365a43',
              textAlign: 'center',
            }}
          >
            O painel precisa de JavaScript ativado no navegador. O formulário de acesso continua
            disponível.
          </div>
        </noscript>
        <StudioProvider>{children}</StudioProvider>
        <Script
          id="metricool-tracker"
          src="https://tracker.metricool.com/resources/be.js"
          strategy="afterInteractive"
        />
        <Script id="metricool-init" strategy="afterInteractive">
          {`(function init(n){if(window.beTracker){window.beTracker.t({hash:"64ca5fd0266fde97c7ed4ca3a9a6b6df"})}else if(n<50){setTimeout(function(){init(n+1)},100)}})(0);`}
        </Script>
      </body>
    </html>
  );
}
