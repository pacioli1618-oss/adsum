import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {toClientWorkplace, toInviteView, type RawClientWorkplace} from '../src/lib/api-mappers';

// Shapes as returned by ad_get_workplace_as_client / ad_get_invite (numeric comes back as number).
const raw: RawClientWorkplace = {
  slug: 'k3v2kw2n',
  name: 'Casa Aurora',
  rate_amount: 150,
  rate_unit: 'day',
  currency: 'BRL',
  wants_daily_notice: true,
  locale: 'pt-BR',
  providers: [
    {id: 'p1', name: 'Ana', status: 'active', shares_daily_notice: true, invite_token: null, accepted_at: '2026-11-01T10:00:00Z', stopped_at: null, today_notices: [{kind: 'check_in', occurred_at: '2026-11-18T10:56:00Z'}]},
    {id: 'p2', name: 'Bia', status: 'invited', shares_daily_notice: false, invite_token: 'tok', accepted_at: null, stopped_at: null, today_notices: null},
  ],
  summaries: [
    {
      id: 's1', provider_id: 'p1', provider_name: 'Ana', month: '2026-10-01', days: 2, hours: null, amount: 300, late_days: 1,
      include_hours: false, include_notes: false, items: [{date: '2026-10-02', is_late: false}, {date: '2026-10-03', is_late: true}],
      sent_at: '2026-11-01T12:00:00Z', review: null, review_note: null, reviewed_at: null, expires_at: '2026-12-31T12:00:00Z',
    },
  ],
};

describe('api mappers', () => {
  it('maps the client panel', () => {
    const view = toClientWorkplace(raw);
    assert.equal(view.rateAmount, 150);
    assert.equal(view.wantsDailyNotice, true);
    assert.deepEqual(view.providers[0].todayNotices, [{kind: 'check_in', occurredAt: '2026-11-18T10:56:00Z'}]);
    assert.deepEqual(view.providers[1].todayNotices, []);
    assert.equal(view.providers[1].inviteToken, 'tok');
    assert.equal(view.summaries[0].month, '2026-10');
    assert.deepEqual(view.summaries[0].items[1], {date: '2026-10-03', checkIn: null, checkOut: null, note: null, isLate: true});
  });

  it('maps the invite', () => {
    const view = toInviteView({
      workplace: raw,
      provider_name: 'Ana',
      status: 'active',
      shares_daily_notice: true,
      summaries: [{month: '2026-10-01', days: 2, amount: 300, sent_at: 'x', review: 'confirmed', review_note: null, reviewed_at: 'y'}],
    });
    assert.equal(view.workplace.name, 'Casa Aurora');
    assert.equal(view.summaries[0].month, '2026-10');
    assert.equal(view.summaries[0].review, 'confirmed');
  });
});
