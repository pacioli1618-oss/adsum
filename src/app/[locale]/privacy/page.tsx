import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {LegalPage} from '@/components/legal/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Privacy');
  return {title: `${t('title')} · Adsum`, description: t('intro')};
}

// /privacy · Plain-language privacy policy. Keep it in step with what the database stores
// (docs/conventions.md, supabase migrations) and bump site.legalUpdatedAt when the text changes.
export default function PrivacyPage() {
  return (
    <LegalPage
      namespace="Privacy"
      sections={['collect', 'notebook', 'visibility', 'retention', 'providers', 'rights', 'controller']}
      showUpdatedAt
    />
  );
}
