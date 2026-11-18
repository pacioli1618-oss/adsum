import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {LegalLinks} from '@/components/legal/LegalLinks';
import {HomeScreen} from './HomeScreen';

// Home · Two doors: the client creates a workplace and invites people; the provider opens the notebook.
// Static shell; the choices run in the browser (device id, tokens).
export default function HomePage() {
  const t = useTranslations('Home');
  const common = useTranslations('Common');

  return (
    <main className={screen.screen}>
      <AppHeader />
      <section className={screen.stack}>
        <h1 className={blocks.title}>{t('headline')}</h1>
        <p className={blocks.lead}>{t('intro')}</p>
      </section>
      <HomeScreen />
      <footer className={screen.footer}>
        <p className={blocks.notice}>{common('notTimeClock')}</p>
        <p className={screen.tagline}>{common('tagline')}</p>
        <LegalLinks />
      </footer>
    </main>
  );
}
