'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {SelectField} from '@/components/ui/SelectField';
import {Stat} from '@/components/ui/Stat';
import {Tag} from '@/components/ui/Tag';
import {TextAreaField} from '@/components/ui/TextAreaField';
import {formatHours, useFormatDay, useFormatMoment, useFormatMonth, useFormatMoney} from '@/i18n/format';
import {reviewSummary, type ClientWorkplace, type Review, type Summary} from '@/lib/api';
import {csvNumber, downloadCsv, fileSlug, toCsv} from '@/lib/csv';
import type {ActionRunner} from './WorkplaceScreen';

const REVIEW_NOTE_MAX_LENGTH = 300;

/** Month summaries sent by each person: open, review (confere / não confere), export. */
export function SummariesSection({
  workplace,
  slug,
  clientToken,
  run,
  busyKey,
  errorFor,
}: {
  workplace: ClientWorkplace;
  slug: string;
  clientToken: string;
  run: ActionRunner;
  busyKey: string | null;
  errorFor: (key: string) => string | null;
}) {
  const t = useTranslations('Summaries');
  const locale = useLocale();
  const formatMonth = useFormatMonth();
  const formatDay = useFormatDay();
  const months = [...new Set(workplace.summaries.map((summary) => summary.month))].sort().reverse();
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const month = chosenMonth && months.includes(chosenMonth) ? chosenMonth : (months[0] ?? null);
  const summaries = workplace.summaries.filter((summary) => summary.month === month);

  function exportMonth() {
    if (!month) return;
    const rows: (string | number | null)[][] = [
      [t('csvPerson'), t('csvDate'), t('csvCheckIn'), t('csvCheckOut'), t('csvNote'), t('csvLate')],
    ];
    for (const summary of summaries) {
      for (const item of summary.items) {
        rows.push([summary.providerName, formatDay(item.date, 'short'), item.checkIn, item.checkOut, item.note, item.isLate ? t('csvYes') : '']);
      }
    }
    rows.push([]);
    rows.push([t('csvPerson'), t('csvDays'), t('csvHours'), t('csvAmount'), t('csvReview')]);
    for (const summary of summaries) {
      rows.push([
        summary.providerName,
        summary.days,
        csvNumber(summary.hours, locale),
        csvNumber(summary.amount, locale),
        summary.review ? t('review', {review: summary.review}) : t('notReviewed'),
      ]);
    }
    downloadCsv(`adsum-${fileSlug(workplace.name)}-${month}.csv`, toCsv(rows));
  }

  return (
    <section className={screen.section}>
      <h2 className={screen.sectionTitle}>{t('title')}</h2>
      {!month ? (
        <p className={screen.sectionHint}>{t('empty')}</p>
      ) : (
        <>
          {months.length > 1 && (
            <SelectField
              label={t('month')}
              value={month}
              onChange={(event) => setChosenMonth(event.target.value)}
              options={months.map((value) => ({value, label: formatMonth(value)}))}
            />
          )}
          {months.length === 1 && <p className={screen.sectionHint}>{formatMonth(month)}</p>}
          {summaries.map((summary) => (
            <SummaryCard
              key={summary.id}
              summary={summary}
              currency={workplace.currency}
              isBusy={busyKey === `review:${summary.id}`}
              error={errorFor(`review:${summary.id}`)}
              onReview={(review, note) => run(`review:${summary.id}`, () => reviewSummary(slug, clientToken, summary.id, review, note))}
            />
          ))}
          <Button variant="secondary" onClick={exportMonth}>
            {t('export')}
          </Button>
        </>
      )}
      <p className={blocks.muted}>{t('retentionHint')}</p>
    </section>
  );
}

function SummaryCard({
  summary,
  currency,
  isBusy,
  error,
  onReview,
}: {
  summary: Summary;
  currency: string;
  isBusy: boolean;
  error: string | null;
  onReview: (review: Review, note: string) => Promise<boolean>;
}) {
  const t = useTranslations('Summaries');
  const formatMoney = useFormatMoney();
  const formatDay = useFormatDay();
  const formatMoment = useFormatMoment();
  const [isOpen, setIsOpen] = useState(false);
  const [isDisputing, setIsDisputing] = useState(false);
  const [note, setNote] = useState('');

  return (
    <Card variant="large">
      <div className={screen.stack}>
        <div className={blocks.split}>
          <span className={blocks.listTitle}>{summary.providerName}</span>
          {summary.review ? (
            <Tag tone={summary.review === 'confirmed' ? 'brand' : 'ember'}>{t('review', {review: summary.review})}</Tag>
          ) : (
            <Tag>{t('notReviewed')}</Tag>
          )}
        </div>
        <div className={blocks.stats}>
          <Stat value={String(summary.days)} label={t('days', {count: summary.days})} />
          {summary.hours !== null && <Stat value={formatHours(summary.hours)} label={t('hours')} />}
          {summary.amount !== null && <Stat value={formatMoney(summary.amount, currency)} label={t('amount')} />}
        </div>
        <p className={blocks.muted}>
          {t('sentAt', {when: formatMoment(summary.sentAt)})}
          {summary.lateDays > 0 && ` · ${t('lateDays', {count: summary.lateDays})}`}
        </p>
        {summary.reviewNote && <p className={blocks.notice}>{summary.reviewNote}</p>}

        <Button variant="ghost" onClick={() => setIsOpen((value) => !value)} aria-expanded={isOpen}>
          {isOpen ? t('hideDays') : t('showDays')}
        </Button>
        {isOpen && (
          <table className={blocks.table}>
            <thead>
              <tr>
                <th>{t('csvDate')}</th>
                {summary.includeHours && <th>{t('times')}</th>}
              </tr>
            </thead>
            <tbody>
              {summary.items.map((item) => (
                <tr key={item.date}>
                  <td>
                    {formatDay(item.date)} {item.isLate && <span className={blocks.late}>{t('late')}</span>}
                    {item.note && <div className={blocks.tableNote}>{item.note}</div>}
                  </td>
                  {summary.includeHours && (
                    <td className={blocks.mono}>
                      {item.checkIn ?? '—'} – {item.checkOut ?? '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {isDisputing ? (
          <div className={screen.stack}>
            <TextAreaField
              label={t('disputeNote')}
              hint={t('disputeNoteHint')}
              value={note}
              maxLength={REVIEW_NOTE_MAX_LENGTH}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className={blocks.choice}>
              <Button variant="secondary" onClick={() => setIsDisputing(false)}>
                {t('cancel')}
              </Button>
              <Button
                isLoading={isBusy}
                onClick={async () => {
                  if (await onReview('disputed', note)) setIsDisputing(false);
                }}
              >
                {t('sendDispute')}
              </Button>
            </div>
          </div>
        ) : (
          <div className={blocks.choice}>
            <Button variant={summary.review === 'confirmed' ? 'secondary' : 'primary'} isLoading={isBusy} onClick={() => void onReview('confirmed', '')}>
              {t('confirm')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setNote(summary.review === 'disputed' ? (summary.reviewNote ?? '') : '');
                setIsDisputing(true);
              }}
            >
              {t('dispute')}
            </Button>
          </div>
        )}
        {error && <p className={screen.formError}>{error}</p>}
      </div>
    </Card>
  );
}
