'use client';

import {useState, type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {ClientFields, type ClientDraft} from '@/components/notebook/ClientFields';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Link, useRouter} from '@/i18n/navigation';
import {parseAmount} from '@/lib/amount';
import {addClient} from '@/lib/device-store';

/** A client written only in this notebook. Summaries to them go by WhatsApp or spreadsheet. */
export function NewClientScreen() {
  const t = useTranslations('ClientForm');
  const router = useRouter();
  const [draft, setDraft] = useState<ClientDraft>({name: '', rateText: '', rateUnit: 'day'});
  const [nameError, setNameError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = draft.name.trim().replace(/\s+/g, ' ');
    if (!name) {
      setNameError(t('nameRequired'));
      return;
    }
    const client = addClient({name, rateAmount: parseAmount(draft.rateText), rateUnit: draft.rateUnit, currency: 'BRL', link: null});
    router.replace(`/notebook/${client.id}`);
  }

  return (
    <main className={screen.screen}>
      <AppHeader />
      <Link href="/notebook" className={blocks.back}>
        {t('back')}
      </Link>
      <section className={screen.stack}>
        <h1 className={blocks.title}>{t('title')}</h1>
        <p className={blocks.lead}>{t('intro')}</p>
      </section>
      <Card variant="large">
        <form className={screen.stack} onSubmit={handleSubmit} noValidate>
          <ClientFields draft={draft} onChange={setDraft} nameError={nameError} />
          <p className={blocks.muted}>{t('inviteHint')}</p>
          <Button type="submit" size="cta" isFullWidth>
            {t('add')}
          </Button>
        </form>
      </Card>
    </main>
  );
}
