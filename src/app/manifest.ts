import type {MetadataRoute} from 'next';

// /manifest.webmanifest · Lets people add Adsum to the home screen (PWA).
// Opens on the notebook: whoever installs it is usually the person who marks their days.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Adsum',
    short_name: 'Adsum',
    description: 'Caderno de presença: anote seus dias e mande o resumo do mês. Sem cadastro.',
    lang: 'pt-BR',
    start_url: '/notebook',
    scope: '/',
    display: 'standalone',
    background_color: '#f3f4f6',
    theme_color: '#2340d9',
    icons: [
      {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
      {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
      {src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
    ],
  };
}
