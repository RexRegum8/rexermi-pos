import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rexermi Marketplace',
    short_name: 'Rexermi',
    description: 'Tu tienda y punto de venta de confianza',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0A0F',
    theme_color: '#D4AF37',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
