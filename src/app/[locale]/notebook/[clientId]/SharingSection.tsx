'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Tag} from '@/components/ui/Tag';
import {Toggle} from '@/components/ui/Toggle';
import {useLoader} from '@/hooks/use-loader';
import {useRpcErrorMessage} from '@/i18n/errors';
import {useFormatMonth} from '@/i18n/format';
import {getInvite, setSharing} from '@/lib/api';
import {updateClient} from '@/lib/device-store';
import type {NotebookClient} from '@/lib/notebook';

/**
 * What this client sees, and the switches: daily notice on/off, stop or resume sharing.
 * Also the client's answer to each month sent (confere / não confere).
 */
export function SharingSection({client}: {client: NotebookClient}) {
  const t = useTranslations('Sharing');
  const formatMonth = useFormatMonth();
  const rpcErrorMessage = useRpcErrorMessage();
  const link = client.link!;
  const {data: invite, error: loadError, refresh} = useLoader(`${link.slug}:${link.inviteToken}`, () => getInvite(link.slug, link.inviteToken));
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The client may have changed the wish for daily notices since the invite.
  const clientWantsDailyNotice = invite?.workplace.wantsDailyNotice ?? link.clientWantsDailyNotice;
  const isActive = link.status === 'active';

  async function apply(nextActive: boolean, nextShares: boolean) {
    setIsBusy(true);
    setError(null);
    try {
      const shares = nextActive && nextShares && clientWantsDailyNotice;
      await setSharing(link.slug, link.inviteToken, nextActive, shares);
      updateClient(client.id, {link: {...link, status: nextActive ? 'active' : 'stopped', sharesDailyNotice: shares, clientWantsDailyNotice}});
      await refresh();
    } catch (failure) {
      setError(rpcErrorMessage(failure));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className={screen.section}>
      <h2 className={screen.sectionTitle}>{t('title')}</h2>
      <p className={screen.sectionHint}>{isActive ? t('activeHint', {client: client.name}) : t('stoppedHint', {client: client.name})}</p>

      {isActive && clientWantsDailyNotice && (
        <Toggle
          checked={link.sharesDailyNotice}
          disabled={isBusy}
          onChange={(checked) => void apply(true, checked)}
          title={t('dailyNotice')}
          hint={t('dailyNoticeHint', {client: client.name})}
        />
      )}
      {isActive && !clientWantsDailyNotice && <p className={blocks.muted}>{t('clientNoDailyNotice')}</p>}

      {invite && invite.summaries.length > 0 && (
        <Card variant="flush">
          <ul className={blocks.list}>
            {invite.summaries.map((summary) => (
              <li key={summary.month} className={blocks.listItem}>
                <span className={blocks.listMain}>
                  <span className={blocks.listTitle}>
                    {formatMonth(summary.month)}
                  </span>
                  {summary.reviewNote && <span className={blocks.tableNote}>{summary.reviewNote}</span>}
                </span>
                <Tag tone={summary.review === 'confirmed' ? 'brand' : summary.review === 'disputed' ? 'ember' : 'neutral'}>
                  {t('review', {review: summary.review ?? 'none'})}
                </Tag>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {loadError !== null && !invite && <p className={blocks.muted}>{rpcErrorMessage(loadError)}</p>}

      <Button variant={isActive ? 'ghost' : 'secondary'} isLoading={isBusy} onClick={() => {
          if (isActive && !window.confirm(t('stopConfirm', {client: client.name}))) return;
          void apply(!isActive, false);
        }}
      >
        {isActive ? t('stop') : t('resume')}
      </Button>
      {error && (
        <p role="alert" className={screen.formError}>
          {error}
        </p>
      )}
    </section>
  );
}
