'use client';

import {useState, type FormEvent} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import blocks from '@/components/layout/Blocks.module.css';
import screen from '@/components/layout/Screen.module.css';
import {StatusScreen} from '@/components/layout/StatusScreen';
import {ClientFields, type ClientDraft} from '@/components/notebook/ClientFields';
import {Button, ButtonLink} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Stat} from '@/components/ui/Stat';
import {TextAreaField} from '@/components/ui/TextAreaField';
import {TextField} from '@/components/ui/TextField';
import {useDeviceStore} from '@/hooks/use-device-store';
import {formatHours, useFormatDay, useFormatMonth, useFormatMoney} from '@/i18n/format';
import {Link, useRouter} from '@/i18n/navigation';
import {amountToInput, parseAmount} from '@/lib/amount';
import {setSharing} from '@/lib/api';
import {deleteEntry, getEntry, removeClient, saveEntry, updateClient, type DeviceStore} from '@/lib/device-store';
import {
  daysInMonth,
  firstWeekday,
  isTimeKey,
  NOTE_MAX_LENGTH,
  shiftMonth,
  summarizeMonth,
  toDateKey,
  toMonthKey,
  type NotebookClient,
} from '@/lib/notebook';
import {SharingSection} from './SharingSection';

/** /notebook/<clientId>: one client's month. */
export function ClientScreen({clientId}: {clientId: string}) {
  const t = useTranslations('ClientMonth');
  const common = useTranslations('Common');
  const store = useDeviceStore();

  if (store === null) return <StatusScreen message={common('loading')} />;
  const client = store.clients.find((item) => item.id === clientId);
  if (!client) return <StatusScreen isError message={t('notFound')} />;
  return <ClientMonth key={client.id} client={client} store={store} />;
}

function ClientMonth({client, store}: {client: NotebookClient; store: DeviceStore}) {
  const t = useTranslations('ClientMonth');
  const formatMonth = useFormatMonth();
  const formatMoney = useFormatMoney();
  const today = toDateKey(new Date());
  const currentMonth = toMonthKey(today);
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(today);
  const summary = summarizeMonth(store.entries, client, month);
  const isPastMonth = month < currentMonth;
  const wasSent = (store.sentMonths[client.id] ?? []).includes(month);

  return (
    <main className={screen.screen}>
      <AppHeader />
      <Link href="/notebook" className={blocks.back}>
        {t('back')}
      </Link>
      <h1 className={blocks.title}>{client.name}</h1>

      <section className={screen.section}>
        <div className={blocks.monthNav}>
          <button type="button" className={blocks.navButton} aria-label={t('previousMonth')} onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <h2 className={blocks.monthName}>{formatMonth(month)}</h2>
          <button
            type="button"
            className={blocks.navButton}
            aria-label={t('nextMonth')}
            disabled={month >= currentMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            ›
          </button>
        </div>
        <Calendar store={store} client={client} month={month} today={today} selectedDate={selectedDate} onSelect={setSelectedDate} />
        <p className={blocks.muted}>{t('calendarHint')}</p>
      </section>

      {selectedDate && toMonthKey(selectedDate) === month && (
        <DayEditor key={selectedDate} store={store} client={client} date={selectedDate} today={today} onClose={() => setSelectedDate(null)} />
      )}

      <section className={screen.section}>
        <div className={blocks.stats}>
          <Stat value={String(summary.days)} label={t('days', {count: summary.days})} />
          <Stat value={formatHours(summary.hours)} label={t('hours')} />
          {summary.amount !== null && <Stat value={formatMoney(summary.amount, client.currency)} label={t('amount')} />}
        </div>
        {summary.lateDays > 0 && <p className={blocks.muted}>{t('lateDays', {count: summary.lateDays})}</p>}
        {summary.days > 0 && (
          <ButtonLink href={`/notebook/${client.id}/send/${month}`} variant={isPastMonth && !wasSent ? 'primary' : 'secondary'}>
            {wasSent ? t('sendAgain') : isPastMonth ? t('send') : t('sendPartial')}
          </ButtonLink>
        )}
      </section>

      {client.link && <SharingSection client={client} />}
      <ClientSettings client={client} />
    </main>
  );
}

function Calendar({
  store,
  client,
  month,
  today,
  selectedDate,
  onSelect,
}: {
  store: DeviceStore;
  client: NotebookClient;
  month: string;
  today: string;
  selectedDate: string | null;
  onSelect: (date: string) => void;
}) {
  const t = useTranslations('ClientMonth');
  const formatDay = useFormatDay();
  const locale = useLocale();
  // Week starts on Sunday, as on Brazilian calendars.
  const weekdayNames = Array.from({length: 7}, (_, index) =>
    new Intl.DateTimeFormat(locale, {weekday: 'narrow', timeZone: 'UTC'}).format(new Date(Date.UTC(2026, 10, 1 + index))),
  );
  const offset = firstWeekday(month);
  const total = daysInMonth(month);

  return (
    <div className={blocks.calendar} role="grid" aria-label={t('calendarLabel')}>
      {weekdayNames.map((name, index) => (
        <span key={index} className={blocks.weekday} aria-hidden="true">
          {name}
        </span>
      ))}
      {Array.from({length: offset}, (_, index) => (
        <span key={`blank-${index}`} />
      ))}
      {Array.from({length: total}, (_, index) => {
        const date = `${month}-${String(index + 1).padStart(2, '0')}`;
        const entry = getEntry(store, client.id, date);
        const isWorked = Boolean(entry?.checkIn);
        const className = [
          isWorked ? blocks.dayWorked : blocks.day,
          date === today && blocks.dayToday,
          date === selectedDate && blocks.daySelected,
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={date}
            type="button"
            className={className}
            disabled={date > today}
            aria-pressed={date === selectedDate}
            aria-label={`${formatDay(date, 'long')}${isWorked ? ` · ${t('worked')}` : ''}${entry?.isLate ? ` · ${t('late')}` : ''}`}
            onClick={() => onSelect(date)}
          >
            {index + 1}
            {entry?.isLate && <span className={blocks.dayLateDot} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

function DayEditor({store, client, date, today, onClose}: {store: DeviceStore; client: NotebookClient; date: string; today: string; onClose: () => void}) {
  const t = useTranslations('ClientMonth');
  const common = useTranslations('Common');
  const formatDay = useFormatDay();
  const entry = getEntry(store, client.id, date);
  const [checkIn, setCheckIn] = useState(entry?.checkIn ?? '');
  const [checkOut, setCheckOut] = useState(entry?.checkOut ?? '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isTimeKey(checkIn)) {
      setError(t('checkInRequired'));
      return;
    }
    if (checkOut && !isTimeKey(checkOut)) {
      setError(t('timeInvalid'));
      return;
    }
    setError(null);
    saveEntry({clientId: client.id, date, checkIn, checkOut: checkOut || null, note});
    setIsSaved(true);
  }

  const willBeLate = date < today;

  return (
    <Card variant="large">
      <form className={screen.stack} onSubmit={handleSubmit} noValidate>
        <div className={blocks.split}>
          <h2 className={screen.sectionTitle}>{formatDay(date, 'long')}</h2>
          {entry?.isLate && <span className={blocks.late}>{t('late')}</span>}
        </div>
        <div className={blocks.timeRow}>
          <TextField
            label={t('checkIn')}
            type="time"
            value={checkIn}
            onChange={(event) => {
              setCheckIn(event.target.value);
              setIsSaved(false);
            }}
          />
          <TextField
            label={t('checkOut')}
            type="time"
            value={checkOut}
            onChange={(event) => {
              setCheckOut(event.target.value);
              setIsSaved(false);
            }}
          />
        </div>
        <TextAreaField
          label={t('note')}
          hint={t('noteHint', {max: NOTE_MAX_LENGTH})}
          value={note}
          maxLength={NOTE_MAX_LENGTH}
          onChange={(event) => {
            setNote(event.target.value);
            setIsSaved(false);
          }}
        />
        {willBeLate && <p className={blocks.muted}>{t('lateHint')}</p>}
        {error && (
          <p role="alert" className={screen.formError}>
            {error}
          </p>
        )}
        {isSaved && (
          <p role="status" className={blocks.muted}>
            {common('saved')}
          </p>
        )}
        <div className={blocks.choice}>
          {entry ? (
            <Button
              variant="secondary"
              onClick={() => {
                if (window.confirm(t('clearConfirm'))) {
                  deleteEntry(client.id, date);
                  onClose();
                }
              }}
            >
              {t('clear')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              {common('cancel')}
            </Button>
          )}
          <Button type="submit">{common('save')}</Button>
        </div>
      </form>
    </Card>
  );
}

function ClientSettings({client}: {client: NotebookClient}) {
  const t = useTranslations('ClientMonth');
  const form = useTranslations('ClientForm');
  const common = useTranslations('Common');
  const locale = useLocale();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ClientDraft>({name: client.name, rateText: amountToInput(client.rateAmount, locale), rateUnit: client.rateUnit});
  const [nameError, setNameError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const name = draft.name.trim().replace(/\s+/g, ' ');
    if (!name) {
      setNameError(form('nameRequired'));
      return;
    }
    updateClient(client.id, {name, rateAmount: parseAmount(draft.rateText), rateUnit: draft.rateUnit});
    setIsEditing(false);
  }

  async function handleRemove() {
    const question = client.link ? t('removeLinkedConfirm', {name: client.name}) : t('removeConfirm', {name: client.name});
    if (!window.confirm(question)) return;
    // Without the notebook entry the token is gone: stop sharing first (best effort, e.g. offline).
    if (client.link?.status === 'active') {
      await setSharing(client.link.slug, client.link.inviteToken, false, false).catch(() => undefined);
    }
    removeClient(client.id);
    router.replace('/notebook');
  }

  return (
    <section className={screen.section}>
      <h2 className={screen.sectionTitle}>{t('settingsTitle')}</h2>
      {isEditing ? (
        <Card variant="large">
          <form className={screen.stack} onSubmit={handleSubmit} noValidate>
            <ClientFields draft={draft} onChange={setDraft} nameError={nameError} />
            {client.link && <p className={blocks.muted}>{t('linkedRateHint')}</p>}
            <div className={blocks.choice}>
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                {common('cancel')}
              </Button>
              <Button type="submit">{common('save')}</Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className={screen.row}>
          <Button variant="secondary" onClick={() => setIsEditing(true)}>
            {t('editClient')}
          </Button>
          <Button variant="ghost" onClick={() => void handleRemove()}>
            {t('removeClient')}
          </Button>
        </div>
      )}
    </section>
  );
}
