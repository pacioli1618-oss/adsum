'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {DaysGrid} from '@/components/brand/Logo';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import {ChevronRight} from '@/components/layout/ChevronRight';
import screen from '@/components/layout/Screen.module.css';
import {StatusScreen} from '@/components/layout/StatusScreen';
import {LegalLinks} from '@/components/legal/LegalLinks';
import {ButtonLink} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Stat} from '@/components/ui/Stat';
import {useDeviceStore} from '@/hooks/use-device-store';
import {formatHours, useFormatDay, useFormatMonth, useFormatMoney} from '@/i18n/format';
import {Link} from '@/i18n/navigation';
import {canPersist, getEntry, markNow, type DeviceStore} from '@/lib/device-store';
import {monthsToSend, summarizeMonth, toDateKey, toMonthKey, type NotebookClient} from '@/lib/notebook';
import {flushOutbox, sendNotice, sharesNoticesWith, type NoticeResult} from '@/lib/notices';

/** /notebook: today, one tap to write the arrival and the leaving. */
export function NotebookScreen() {
  const common = useTranslations('Common');
  const store = useDeviceStore();

  useEffect(() => {
    void flushOutbox();
    const handleOnline = () => void flushOutbox();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  if (store === null) return <StatusScreen message={common('loading')} />;
  return <Notebook store={store} />;
}

function Notebook({store}: {store: DeviceStore}) {
  const t = useTranslations('Notebook');
  const common = useTranslations('Common');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const today = toDateKey(new Date());
  const month = toMonthKey(today);

  const clients = store.clients;
  // Default: the client already marked today, else the first one.
  const markedToday = clients.find((client) => getEntry(store, client.id, today));
  const client = clients.find((item) => item.id === chosenId) ?? markedToday ?? clients[0];

  const pending = clients.flatMap((item) =>
    monthsToSend(store.entries, item.id, month, store.sentMonths[item.id] ?? []).map((pendingMonth) => ({client: item, month: pendingMonth})),
  );

  return (
    <main className={screen.screen}>
      <AppHeader />
      <section className={screen.stack}>
        <h1 className={blocks.title}>{t('title')}</h1>
        {!canPersist() && <p className={blocks.warning}>{t('cannotPersist')}</p>}
      </section>

      {!client ? (
        <Card variant="large">
          <div className={blocks.empty}>
            <DaysGrid size={56} />
            <p className={blocks.lead}>{t('empty')}</p>
            <p className={blocks.muted}>{t('emptyHint')}</p>
            <ButtonLink href="/notebook/new-client">{t('addClient')}</ButtonLink>
          </div>
        </Card>
      ) : (
        <>
          {clients.length > 1 && (
            <div className={blocks.chips} role="group" aria-label={t('clientsLabel')}>
              {clients.map((item) => (
                <button key={item.id} type="button" className={blocks.chip} aria-pressed={item.id === client.id} onClick={() => setChosenId(item.id)}>
                  {item.name}
                </button>
              ))}
            </div>
          )}
          <Today key={client.id} client={client} store={store} today={today} />
          <MonthCard client={client} store={store} month={month} />
        </>
      )}

      {pending.length > 0 && (
        <section className={screen.section}>
          <h2 className={screen.sectionTitle}>{t('pendingTitle')}</h2>
          {pending.map(({client: item, month: pendingMonth}) => (
            <PendingLink key={`${item.id}:${pendingMonth}`} client={item} month={pendingMonth} />
          ))}
        </section>
      )}

      {clients.length > 0 && (
        <section className={screen.section}>
          <h2 className={screen.sectionTitle}>{t('clientsTitle')}</h2>
          <Card variant="flush">
            <ul className={blocks.list}>
              {clients.map((item) => (
                <li key={item.id}>
                  <Link href={`/notebook/${item.id}`} className={`${blocks.listItem} ${blocks.listLink}`}>
                    <span className={blocks.listMain}>
                      <span className={blocks.listTitle}>{item.name}</span>
                      <span className={blocks.muted}>
                        {!item.link
                          ? t('onlyHere')
                          : item.link.status === 'stopped'
                            ? t('sharingStopped')
                            : sharesNoticesWith(item)
                              ? t('sharesDailyNotice')
                              : t('sharesSummary')}
                      </span>
                    </span>
                    <ChevronRight />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <ButtonLink href="/notebook/new-client" variant="secondary">
            {t('addClient')}
          </ButtonLink>
        </section>
      )}

      <footer className={screen.footer}>
        <p className={blocks.notice}>{t('deviceOnly')}</p>
        <p className={blocks.notice}>{common('notTimeClock')}</p>
        <LegalLinks />
      </footer>
    </main>
  );
}

function Today({client, store, today}: {client: NotebookClient; store: DeviceStore; today: string}) {
  const t = useTranslations('Notebook');
  const formatDay = useFormatDay();
  const entry = getEntry(store, client.id, today);
  const [noticeResult, setNoticeResult] = useState<NoticeResult | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function mark(kind: 'check_in' | 'check_out') {
    markNow(client.id, kind);
    if (!sharesNoticesWith(client)) return;
    setIsSending(true);
    setNoticeResult(await sendNotice(client, kind));
    setIsSending(false);
  }

  const hasArrived = Boolean(entry?.checkIn);
  const hasLeft = Boolean(entry?.checkOut);

  return (
    <section className={screen.section} aria-labelledby="today-title">
      <div className={blocks.split}>
        <h2 id="today-title" className={screen.sectionTitle}>
          {t('today', {date: formatDay(today, 'long')})}
        </h2>
        <Link href={`/notebook/${client.id}`} className={blocks.back}>
          {t('editDay')}
        </Link>
      </div>
      <div className={blocks.markButtons}>
        <button type="button" className={hasArrived ? blocks.markButton : blocks.markButtonPrimary} disabled={hasArrived} onClick={() => void mark('check_in')}>
          {t('arrived')}
          <span className={blocks.markTime}>{entry?.checkIn ?? '— : —'}</span>
        </button>
        <button
          type="button"
          className={hasArrived && !hasLeft ? blocks.markButtonPrimary : blocks.markButton}
          disabled={!hasArrived}
          onClick={() => void mark('check_out')}
        >
          {t('left')}
          <span className={blocks.markTime}>{entry?.checkOut ?? '— : —'}</span>
        </button>
      </div>
      <p className={blocks.muted} role="status">
        {isSending
          ? t('noticeSending')
          : noticeResult
            ? t('noticeResult', {result: noticeResult, client: client.name})
            : sharesNoticesWith(client)
              ? t('noticeOn', {client: client.name})
              : t('noticeOff')}
      </p>
    </section>
  );
}

function MonthCard({client, store, month}: {client: NotebookClient; store: DeviceStore; month: string}) {
  const t = useTranslations('Notebook');
  const formatMonth = useFormatMonth();
  const formatMoney = useFormatMoney();
  const summary = summarizeMonth(store.entries, client, month);

  return (
    <section className={screen.section}>
      <div className={blocks.split}>
        <h2 className={screen.sectionTitle}>
          {formatMonth(month)}
        </h2>
        <Link href={`/notebook/${client.id}`} className={blocks.back}>
          {t('seeMonth')}
        </Link>
      </div>
      <div className={blocks.stats}>
        <Stat value={String(summary.days)} label={t('days', {count: summary.days})} />
        <Stat value={formatHours(summary.hours)} label={t('hours')} />
        {summary.amount !== null && <Stat value={formatMoney(summary.amount, client.currency)} label={t('amount')} />}
      </div>
    </section>
  );
}

function PendingLink({client, month}: {client: NotebookClient; month: string}) {
  const t = useTranslations('Notebook');
  const formatMonth = useFormatMonth();
  return (
    <Link href={`/notebook/${client.id}/send/${month}`} className={screen.shortcut}>
      <span>{t('pendingItem', {client: client.name, month: formatMonth(month)})}</span>
      <ChevronRight />
    </Link>
  );
}
