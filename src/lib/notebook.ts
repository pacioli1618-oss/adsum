// The provider's notebook: types and the arithmetic of a month. Framework-free and unit-tested:
// the total someone gets paid comes from here.
//
// Dates are wall-clock values on the provider's phone: "2026-11-17" and "07:56". The notebook
// never deals with time zones; only notices sent to the server carry a real timestamp.

export const rateUnits = ['day', 'hour'] as const;
export type RateUnit = (typeof rateUnits)[number];

/** Link to a client's workplace, when the client invited this person. */
export type ClientLink = {
  slug: string;
  inviteToken: string;
  /** What the provider agreed to share on the day ("arrived" / "left"). */
  sharesDailyNotice: boolean;
  /** Whether the client wants daily notices at all (the provider can only turn it on if so). */
  clientWantsDailyNotice: boolean;
  status: 'active' | 'stopped';
};

export type NotebookClient = {
  id: string;
  name: string;
  rateAmount: number | null;
  rateUnit: RateUnit;
  currency: string;
  link: ClientLink | null;
  createdAt: string;
};

export type Entry = {
  id: string;
  clientId: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  checkIn: string | null;
  checkOut: string | null;
  note: string;
  /** Written or changed after the day itself: shown as "anotado depois" in summaries. */
  isLate: boolean;
  updatedAt: string;
};

export type MonthSummary = {
  /** "YYYY-MM" */
  month: string;
  days: number;
  /** Hours with both times written, rounded to 2 decimals. */
  hours: number;
  /** Rate × days or × hours; null when the client has no rate. */
  amount: number | null;
  lateDays: number;
  entries: Entry[];
};

export const NOTE_MAX_LENGTH = 500;

const pad = (value: number) => String(value).padStart(2, '0');

/** "YYYY-MM-DD" of a Date, in the phone's local time. */
export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "HH:MM" of a Date, in the phone's local time. */
export function toTimeKey(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "YYYY-MM" of a date key or a Date. */
export function toMonthKey(value: string | Date) {
  return typeof value === 'string' ? value.slice(0, 7) : `${value.getFullYear()}-${pad(value.getMonth() + 1)}`;
}

/** "2026-11" → "2026-10"; months wrap across years. */
export function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const total = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Number of days in "YYYY-MM". */
export function daysInMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday, for the first day of "YYYY-MM" (calendar grid offset). */
export function firstWeekday(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
}

/** Minutes worked between two "HH:MM"; a check-out earlier than the check-in crosses midnight. */
export function minutesBetween(checkIn: string, checkOut: string) {
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const difference = toMinutes(checkOut) - toMinutes(checkIn);
  return difference >= 0 ? difference : difference + 24 * 60;
}

/** A valid "HH:MM" (00:00–23:59). */
export function isTimeKey(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Entries are late when written about a day that is already over. */
export function isLateFor(date: string, today: string) {
  return date < today;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Days, hours and amount of one client's month. Only days with a check-in count as worked. */
export function summarizeMonth(entries: Entry[], client: Pick<NotebookClient, 'id' | 'rateAmount' | 'rateUnit'>, month: string): MonthSummary {
  const monthEntries = entries
    .filter((entry) => entry.clientId === client.id && toMonthKey(entry.date) === month && entry.checkIn)
    .sort((a, b) => a.date.localeCompare(b.date));

  const minutes = monthEntries.reduce(
    (total, entry) => total + (entry.checkIn && entry.checkOut ? minutesBetween(entry.checkIn, entry.checkOut) : 0),
    0,
  );
  const hours = round2(minutes / 60);
  const days = monthEntries.length;
  const amount =
    client.rateAmount === null ? null : round2(client.rateUnit === 'day' ? days * client.rateAmount : hours * client.rateAmount);

  return {month, days, hours, amount, lateDays: monthEntries.filter((entry) => entry.isLate).length, entries: monthEntries};
}

/** What goes to the server in ad_send_summary: one item per day, hours and notes only if chosen. */
export function toSummaryItems(summary: MonthSummary, options: {includeHours: boolean; includeNotes: boolean}) {
  return summary.entries.map((entry) => ({
    date: entry.date,
    ...(options.includeHours && entry.checkIn ? {check_in: entry.checkIn} : {}),
    ...(options.includeHours && entry.checkOut ? {check_out: entry.checkOut} : {}),
    ...(options.includeNotes && entry.note.trim() ? {note: entry.note.trim().slice(0, NOTE_MAX_LENGTH)} : {}),
    ...(entry.isLate ? {is_late: true} : {}),
  }));
}

/** Months that ended and still have days not sent to this client (oldest first), for the reminder. */
export function monthsToSend(entries: Entry[], clientId: string, currentMonth: string, sentMonths: readonly string[]) {
  const months = new Set(
    entries.filter((entry) => entry.clientId === clientId && entry.checkIn).map((entry) => toMonthKey(entry.date)),
  );
  return [...months].filter((month) => month < currentMonth && !sentMonths.includes(month)).sort();
}
