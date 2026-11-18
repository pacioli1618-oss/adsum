import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  daysInMonth,
  firstWeekday,
  isTimeKey,
  minutesBetween,
  monthsToSend,
  shiftMonth,
  summarizeMonth,
  toSummaryItems,
  type Entry,
} from '../src/lib/notebook';

const entry = (date: string, checkIn: string | null, checkOut: string | null, extra: Partial<Entry> = {}): Entry => ({
  id: date,
  clientId: 'c1',
  date,
  checkIn,
  checkOut,
  note: '',
  isLate: false,
  updatedAt: '2026-11-18T00:00:00Z',
  ...extra,
});

describe('calendar helpers', () => {
  it('shifts months across years', () => {
    assert.equal(shiftMonth('2026-01', -1), '2025-12');
    assert.equal(shiftMonth('2026-12', 1), '2027-01');
    assert.equal(shiftMonth('2026-11', 0), '2026-11');
  });
  it('knows month lengths and first weekdays', () => {
    assert.equal(daysInMonth('2026-02'), 28);
    assert.equal(daysInMonth('2028-02'), 29);
    assert.equal(daysInMonth('2026-11'), 30);
    assert.equal(firstWeekday('2026-11'), 0); // 1 Nov 2026 is a Sunday
  });
  it('validates times', () => {
    assert.ok(isTimeKey('07:56'));
    assert.ok(!isTimeKey('24:00'));
    assert.ok(!isTimeKey('7:5'));
  });
  it('counts minutes, crossing midnight', () => {
    assert.equal(minutesBetween('08:00', '17:30'), 570);
    assert.equal(minutesBetween('22:00', '06:00'), 480);
  });
});

describe('summarizeMonth', () => {
  const entries = [
    entry('2026-11-03', '08:00', '17:00'),
    entry('2026-11-04', '08:00', '12:30', {isLate: true}),
    entry('2026-11-05', '08:00', null), // forgot to mark leaving: counts as a day, no hours
    entry('2026-11-06', null, null), // nothing written: not a day
    entry('2026-10-30', '08:00', '17:00'), // other month
    entry('2026-11-07', '08:00', '17:00', {clientId: 'c2'}), // other client
  ];

  it('adds days, hours and amount per day', () => {
    const summary = summarizeMonth(entries, {id: 'c1', rateAmount: 150, rateUnit: 'day'}, '2026-11');
    assert.equal(summary.days, 3);
    assert.equal(summary.hours, 13.5);
    assert.equal(summary.amount, 450);
    assert.equal(summary.lateDays, 1);
    assert.deepEqual(
      summary.entries.map((item) => item.date),
      ['2026-11-03', '2026-11-04', '2026-11-05'],
    );
  });

  it('pays per hour and leaves the amount empty without a rate', () => {
    assert.equal(summarizeMonth(entries, {id: 'c1', rateAmount: 25.5, rateUnit: 'hour'}, '2026-11').amount, 344.25);
    assert.equal(summarizeMonth(entries, {id: 'c1', rateAmount: null, rateUnit: 'day'}, '2026-11').amount, null);
  });

  it('builds summary items with only what was chosen', () => {
    const summary = summarizeMonth([entry('2026-11-03', '08:00', '17:00', {note: ' tudo certo ', isLate: true})], {id: 'c1', rateAmount: null, rateUnit: 'day'}, '2026-11');
    assert.deepEqual(toSummaryItems(summary, {includeHours: false, includeNotes: false}), [{date: '2026-11-03', is_late: true}]);
    assert.deepEqual(toSummaryItems(summary, {includeHours: true, includeNotes: true}), [
      {date: '2026-11-03', check_in: '08:00', check_out: '17:00', note: 'tudo certo', is_late: true},
    ]);
  });
});

describe('monthsToSend', () => {
  it('lists ended months with days not sent yet', () => {
    const entries = [entry('2026-09-10', '08:00', null), entry('2026-10-10', '08:00', null), entry('2026-11-10', '08:00', null)];
    assert.deepEqual(monthsToSend(entries, 'c1', '2026-11', []), ['2026-09', '2026-10']);
    assert.deepEqual(monthsToSend(entries, 'c1', '2026-11', ['2026-09']), ['2026-10']);
    assert.deepEqual(monthsToSend(entries, 'c2', '2026-11', []), []);
  });
});
