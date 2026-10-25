import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AlongamentosCaratinga',
    short_name: 'Alongamentos',
    description: 'Seu espaço de cuidado, sempre com você.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f8f3',
    theme_color: '#355b43',
    lang: 'pt-BR',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
