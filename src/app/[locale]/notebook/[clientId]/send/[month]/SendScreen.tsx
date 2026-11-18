'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {StatusScreen} from '@/components/layout/StatusScreen';
import {Button, buttonClassName} from '@/components/ui/Button';
import {Stat} from '@/components/ui/Stat';
import {Toggle} from '@/components/ui/Toggle';
import {useDeviceStore} from '@/hooks/use-device-store';
import {useRpcErrorMessage} from '@/i18n/errors';
import {formatHours, useFormatDay, useFormatMonth, useFormatMoney} from '@/i18n/format';
import {Link} from '@/i18n/navigation';
import {sendSummary} from '@/lib/api';
import {csvNumber, downloadCsv, fileSlug, toCsv} from '@/lib/csv';
import {markMonthSent, type DeviceStore} from '@/lib/device-store';
import {summarizeMonth, toDateKey, toMonthKey, toSummaryItems, type NotebookClient} from '@/lib/notebook';
import {buildWhatsAppUrl} from '@/lib/share-links';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** /notebook/<clientId>/send/<month>: check the month, choose what goes, send. */
export function SendScreen({clientId, month}: {clientId: string; month: string}) {
  const t = useTranslations('Send');
  const common = useTranslations('Common');
  const store = useDeviceStore();

  if (store === null) return <StatusScreen message={common('loading')} />;
  const client = store.clients.find((item) => item.id === clientId);
  if (!client || !MONTH_PATTERN.test(month)) return <StatusScreen isError message={t('notFound')} />;
  return <SendMonth client={client} store={store} month={month} />;
}

function SendMonth({client, store, month}: {client: NotebookClient; store: DeviceStore; month: string}) {
  const t = useTranslations('Send');
  const locale = useLocale();
  const rpcErrorMessage = useRpcErrorMessage();
  const formatMonth = useFormatMonth();
  const formatMoney = useFormatMoney();
  const formatDay = useFormatDay();
  const [includeHours, setIncludeHours] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const summary = summarizeMonth(store.entries, client, month);
  const isCurrentMonth = month === toMonthKey(toDateKey(new Date()));
  const canSendOnline = client.link?.status === 'active';
  const monthName = formatMonth(month);

  function buildText() {
    const lines = [t('textTitle', {client: client.name, month: monthName}), ''];
    for (const entry of summary.entries) {
      const times = includeHours ? ` ${entry.checkIn ?? ''}–${entry.checkOut ?? ''}` : '';
      const late = entry.isLate ? ` (${t('late')})` : '';
      const note = includeNotes && entry.note.trim() ? ` · ${entry.note.trim()}` : '';
      lines.push(`• ${formatDay(entry.date)}${times}${late}${note}`);
    }
    lines.push('');
    lines.push(t('textDays', {count: summary.days}));
    if (includeHours) lines.push(t('textHours', {hours: formatHours(summary.hours)}));
    if (summary.amount !== null) lines.push(t('textAmount', {amount: formatMoney(summary.amount, client.currency)}));
    lines.push('', t('textFooter'));
    return lines.join('\n');
  }

  function exportCsv() {
    const rows: (string | number | null)[][] = [[t('csvDate'), t('csvCheckIn'), t('csvCheckOut'), t('csvNote'), t('csvLate')]];
    for (const entry of summary.entries) {
      rows.push([
        formatDay(entry.date),
        includeHours ? entry.checkIn : null,
        includeHours ? entry.checkOut : null,
        includeNotes ? entry.note : null,
        entry.isLate ? t('csvYes') : '',
      ]);
    }
    rows.push([]);
    rows.push([t('csvDays'), summary.days]);
    if (includeHours) rows.push([t('csvHours'), csvNumber(summary.hours, locale)]);
    if (summary.amount !== null) rows.push([t('csvAmount'), csvNumber(summary.amount, locale)]);
    downloadCsv(`adsum-${fileSlug(client.name)}-${month}.csv`, toCsv(rows));
  }

  async function handleSend() {
    if (!client.link) return;
    setIsSending(true);
    setError(null);
    try {
      await sendSummary(client.link.slug, client.link.inviteToken, {
        month,
        days: summary.days,
        hours: summary.hours,
        amount: summary.amount,
        lateDays: summary.lateDays,
        items: toSummaryItems(summary, {includeHours, includeNotes}),
        includeHours,
        includeNotes,
      });
      markMonthSent(client.id, month);
      setIsSent(true);
    } catch (failure) {
      setError(rpcErrorMessage(failure));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className={screen.screen}>
      <AppHeader />
      <Link href={`/notebook/${client.id}`} className={blocks.back}>
        {t('back', {client: client.name})}
      </Link>
      <section className={screen.stack}>
        <h1 className={blocks.title}>{t('title')}</h1>
        <p className={blocks.lead}>
          {client.name} · {monthName}
        </p>
      </section>

      {isCurrentMonth && <p className={blocks.notice}>{t('monthNotOver')}</p>}

      <div className={blocks.stats}>
        <Stat value={String(summary.days)} label={t('days', {count: summary.days})} />
        {includeHours && <Stat value={formatHours(summary.hours)} label={t('hours')} />}
        {summary.amount !== null && <Stat value={formatMoney(summary.amount, client.currency)} label={t('amount')} />}
      </div>

      <section className={screen.section}>
        <h2 className={screen.sectionTitle}>{t('choiceTitle')}</h2>
        <Toggle checked={includeHours} onChange={setIncludeHours} title={t('includeHours')} hint={t('includeHoursHint')} />
        <Toggle checked={includeNotes} onChange={setIncludeNotes} title={t('includeNotes')} hint={t('includeNotesHint')} />
        {summary.lateDays > 0 && <p className={blocks.muted}>{t('lateNotice', {count: summary.lateDays})}</p>}
      </section>

      <section className={screen.section}>
        <h2 className={screen.sectionTitle}>{t('previewTitle')}</h2>
        <table className={blocks.table}>
          <tbody>
            {summary.entries.map((entry) => (
              <tr key={entry.date}>
                <td>
                  {formatDay(entry.date)} {entry.isLate && <span className={blocks.late}>{t('late')}</span>}
                  {includeNotes && entry.note.trim() && <div className={blocks.tableNote}>{entry.note.trim()}</div>}
                </td>
                {includeHours && (
                  <td className={blocks.mono}>
                    {entry.checkIn ?? '—'} – {entry.checkOut ?? '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={screen.stack}>
        {isSent ? (
          <p role="status" className={blocks.notice}>
            {t('sent', {client: client.name})}
          </p>
        ) : (
          canSendOnline && (
            <Button size="cta" isFullWidth isLoading={isSending} disabled={summary.days === 0} onClick={() => void handleSend()}>
              {t('sendTo', {client: client.name})}
            </Button>
          )
        )}
        {error && (
          <p role="alert" className={screen.formError}>
            {error}
          </p>
        )}
        {!canSendOnline && <p className={blocks.muted}>{client.link ? t('sharingStoppedHint') : t('notLinkedHint')}</p>}
        <a
          className={buttonClassName({variant: canSendOnline ? 'secondary' : 'primary', isFullWidth: true})}
          href={buildWhatsAppUrl(buildText())}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            if (!canSendOnline) markMonthSent(client.id, month);
          }}
        >
          {t('sendWhatsApp')}
        </a>
        <Button variant="ghost" isFullWidth onClick={exportCsv}>
          {t('downloadCsv')}
        </Button>
      </section>
    </main>
  );
}
