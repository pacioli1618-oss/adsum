import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {LegalPage} from '@/components/legal/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('About');
  return {title: `${t('title')} · Adsum`, description: t('intro')};
}

// /about · What Adsum is, how to tell a real link from a scam, where the notebook lives, who makes it, the code.
export default function AboutPage() {
  return <LegalPage namespace="About" sections={['what', 'safety', 'notebook', 'who', 'code']} />;
}
