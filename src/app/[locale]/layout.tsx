import type {Metadata, Viewport} from 'next';
import {NextIntlClientProvider} from 'next-intl';
import {getLocale, getTranslations} from 'next-intl/server';
import localFont from 'next/font/local';
import {routing} from '@/i18n/routing';
import {themeScript} from '@/lib/theme';
import '../globals.css';

// Inter (text) and Space Grotesk (titles) served by the app itself (OFL license in app/fonts/OFL.txt):
// opening a link makes no request to Google.
const inter = localFont({
  src: '../fonts/Inter-Variable.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
});
const spaceGrotesk = localFont({
  src: '../fonts/SpaceGrotesk-Variable.woff2',
  weight: '300 700',
  variable: '--font-space-grotesk',
  display: 'swap',
});

// With cacheComponents, every root param needs at least one value at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    metadataBase: siteUrl ? new URL(siteUrl) : undefined,
    title: t('title'),
    description: t('description'),
    openGraph: {title: t('title'), description: t('description'), siteName: 'Adsum', type: 'website'},
    // Links carry private tokens: keep every page out of search engines during the pilot.
    robots: {index: false, follow: false},
    // Home-screen app on iPhone (Android reads app/manifest.ts).
    appleWebApp: {capable: true, title: 'Adsum', statusBarStyle: 'default'},
  };
}

// Browser bar color, matching --surface in each theme.
export const viewport: Viewport = {
  themeColor: [
    {media: '(prefers-color-scheme: light)', color: '#f3f4f6'},
    {media: '(prefers-color-scheme: dark)', color: '#0d0f13'},
  ],
};

export default async function LocaleLayout({children}: LayoutProps<'/[locale]'>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets data-theme before the first paint (src/lib/theme.ts). */}
        <script dangerouslySetInnerHTML={{__html: themeScript}} />
      </head>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
