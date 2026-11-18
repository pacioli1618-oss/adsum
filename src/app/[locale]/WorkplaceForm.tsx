'use client';

import {useState, type FormEvent} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import screen from '@/components/layout/Screen.module.css';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Toggle} from '@/components/ui/Toggle';
import {readDraft, WorkplaceFields, type WorkplaceDraft} from '@/components/workplace/WorkplaceFields';
import {useRpcErrorMessage} from '@/i18n/errors';
import type {Locale} from '@/i18n/locales';
import {Link, useRouter} from '@/i18n/navigation';
import {createWorkplace} from '@/lib/api';
import {getDeviceId, rememberWorkplace} from '@/lib/device-store';
import {site} from '@/lib/site';

/** Creates a workplace. Its client token is kept on this device; the panel shows the admin link. */
export function WorkplaceForm() {
  const t = useTranslations('WorkplaceForm');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const rpcErrorMessage = useRpcErrorMessage();
  const [draft, setDraft] = useState<WorkplaceDraft>({name: '', rateText: '', rateUnit: 'day', wantsDailyNotice: false});
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const values = readDraft(draft);
    setNameError(values.name ? null : t('nameRequired'));
    if (!values.name) return;
    if (!acceptsTerms) {
      setFormError(t('termsRequired'));
      return;
    }
    setFormError(null);
    setIsSaving(true);
    try {
      const created = await createWorkplace({
        ...values,
        name: values.name,
        termsVersion: site.termsVersion,
        locale,
        deviceId: getDeviceId(),
      });
      rememberWorkplace({slug: created.slug, name: values.name, clientToken: created.clientToken});
      router.push(`/w/${created.slug}`);
    } catch (error) {
      setFormError(rpcErrorMessage(error));
      setIsSaving(false);
    }
  }

  return (
    <Card variant="large">
      <form className={screen.stack} onSubmit={handleSubmit} noValidate>
        <WorkplaceFields draft={draft} onChange={setDraft} nameError={nameError} />
        <Toggle
          checked={acceptsTerms}
          onChange={setAcceptsTerms}
          title={t.rich('acceptTerms', {
            terms: (chunks) => (
              <Link href="/terms" target="_blank">
                {chunks}
              </Link>
            ),
          })}
          hint={t('acceptTermsHint')}
        />
        {formError && (
          <p role="alert" className={screen.formError}>
            {formError}
          </p>
        )}
        <Button type="submit" size="cta" isFullWidth isLoading={isSaving}>
          {t('create')}
        </Button>
      </form>
    </Card>
  );
}
