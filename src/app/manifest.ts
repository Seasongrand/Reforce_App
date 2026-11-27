import type { MetadataRoute } from 'next';

/**
 * Site instalável (decisão do dono, 27/11): com este manifesto, o celular
 * oferece "Adicionar à tela inicial" e a Reforce abre em tela cheia, com o
 * ícone da marca. Os ícones saem do desenho em src/components/site/brand.ts.
 * O ícone do iPhone é src/app/apple-icon.png.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Reforce',
    short_name: 'Reforce',
    description: 'Aulas particulares com professores verificados e pagamento na reserva.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fbfaff',
    theme_color: '#fbfaff',
    icons: [
      { src: '/assets/icons/app/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/assets/icons/app/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/assets/icons/app/icone-adaptavel-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
