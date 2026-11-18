// snake_case JSON from the ad_* RPCs → camelCase view types used by the screens.
// The only place (with api.ts) that knows the database's naming (docs/conventions.md).

import type {RateUnit} from './notebook';

export type RawWorkplace = {
  slug: string;
  name: string;
  rate_amount: number | null;
  rate_unit: RateUnit;
  currency: string;
  wants_daily_notice: boolean;
  locale: string;
};

export type RawNotice = {kind: 'check_in' | 'check_out'; occurred_at: string};

export type ProviderStatus = 'invited' | 'active' | 'stopped' | 'declined';

export type RawProvider = {
  id: string;
  name: string;
  status: ProviderStatus;
  shares_daily_notice: boolean;
  invite_token: string | null;
  accepted_at: string | null;
  stopped_at: string | null;
  today_notices: RawNotice[] | null;
};

export type RawSummaryItem = {date: string; check_in?: string; check_out?: string; note?: string; is_late: boolean};

export type Review = 'confirmed' | 'disputed';

export type RawSummary = {
  id: string;
  provider_id: string;
  provider_name: string;
  month: string;
  days: number;
  hours: number | null;
  amount: number | null;
  late_days: number;
  include_hours: boolean;
  include_notes: boolean;
  items: RawSummaryItem[];
  sent_at: string;
  review: Review | null;
  review_note: string | null;
  reviewed_at: string | null;
  expires_at: string;
};

export type RawClientWorkplace = RawWorkplace & {providers: RawProvider[]; summaries: RawSummary[]};

export type RawCreatedWorkplace = {slug: string; client_token: string};
export type RawAddedInvite = {id: string; name: string; invite_token: string};

export type RawInviteSummary = Pick<RawSummary, 'month' | 'days' | 'amount' | 'sent_at' | 'review' | 'review_note' | 'reviewed_at'>;

export type RawInviteView = {
  workplace: RawWorkplace;
  provider_name: string;
  status: ProviderStatus;
  shares_daily_notice: boolean;
  summaries: RawInviteSummary[];
};

// ---------------------------------------------------------------------------

export type Workplace = {
  slug: string;
  name: string;
  rateAmount: number | null;
  rateUnit: RateUnit;
  currency: string;
  wantsDailyNotice: boolean;
  locale: string;
};

export type Notice = {kind: 'check_in' | 'check_out'; occurredAt: string};

export type Provider = {
  id: string;
  name: string;
  status: ProviderStatus;
  sharesDailyNotice: boolean;
  inviteToken: string | null;
  acceptedAt: string | null;
  stoppedAt: string | null;
  todayNotices: Notice[];
};

export type SummaryItem = {date: string; checkIn: string | null; checkOut: string | null; note: string | null; isLate: boolean};

export type Summary = {
  id: string;
  providerId: string;
  providerName: string;
  /** "YYYY-MM" */
  month: string;
  days: number;
  hours: number | null;
  amount: number | null;
  lateDays: number;
  includeHours: boolean;
  includeNotes: boolean;
  items: SummaryItem[];
  sentAt: string;
  review: Review | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  expiresAt: string;
};

export type ClientWorkplace = Workplace & {providers: Provider[]; summaries: Summary[]};

export type CreatedWorkplace = {slug: string; clientToken: string};
export type AddedInvite = {id: string; name: string; inviteToken: string};

export type InviteSummary = {
  month: string;
  days: number;
  amount: number | null;
  sentAt: string;
  review: Review | null;
  reviewNote: string | null;
  reviewedAt: string | null;
};

export type InviteView = {
  workplace: Workplace;
  providerName: string;
  status: ProviderStatus;
  sharesDailyNotice: boolean;
  summaries: InviteSummary[];
};

// ---------------------------------------------------------------------------

/** "2026-11-01" (date) → "2026-11". */
const toMonth = (value: string) => value.slice(0, 7);
const toNumber = (value: number | string | null) => (value === null ? null : Number(value));

export function toWorkplace(raw: RawWorkplace): Workplace {
  return {
    slug: raw.slug,
    name: raw.name,
    rateAmount: toNumber(raw.rate_amount),
    rateUnit: raw.rate_unit,
    currency: raw.currency,
    wantsDailyNotice: raw.wants_daily_notice,
    locale: raw.locale,
  };
}

export function toProvider(raw: RawProvider): Provider {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    sharesDailyNotice: raw.shares_daily_notice,
    inviteToken: raw.invite_token,
    acceptedAt: raw.accepted_at,
    stoppedAt: raw.stopped_at,
    todayNotices: (raw.today_notices ?? []).map((notice) => ({kind: notice.kind, occurredAt: notice.occurred_at})),
  };
}

export function toSummary(raw: RawSummary): Summary {
  return {
    id: raw.id,
    providerId: raw.provider_id,
    providerName: raw.provider_name,
    month: toMonth(raw.month),
    days: raw.days,
    hours: toNumber(raw.hours),
    amount: toNumber(raw.amount),
    lateDays: raw.late_days,
    includeHours: raw.include_hours,
    includeNotes: raw.include_notes,
    items: (raw.items ?? []).map((item) => ({
      date: item.date,
      checkIn: item.check_in ?? null,
      checkOut: item.check_out ?? null,
      note: item.note ?? null,
      isLate: Boolean(item.is_late),
    })),
    sentAt: raw.sent_at,
    review: raw.review,
    reviewNote: raw.review_note,
    reviewedAt: raw.reviewed_at,
    expiresAt: raw.expires_at,
  };
}

export function toClientWorkplace(raw: RawClientWorkplace): ClientWorkplace {
  return {
    ...toWorkplace(raw),
    providers: (raw.providers ?? []).map(toProvider),
    summaries: (raw.summaries ?? []).map(toSummary),
  };
}

export function toCreatedWorkplace(raw: RawCreatedWorkplace): CreatedWorkplace {
  return {slug: raw.slug, clientToken: raw.client_token};
}

export function toAddedInvite(raw: RawAddedInvite): AddedInvite {
  return {id: raw.id, name: raw.name, inviteToken: raw.invite_token};
}

export function toInviteView(raw: RawInviteView): InviteView {
  return {
    workplace: toWorkplace(raw.workplace),
    providerName: raw.provider_name,
    status: raw.status,
    sharesDailyNotice: raw.shares_daily_notice,
    summaries: (raw.summaries ?? []).map((summary) => ({
      month: toMonth(summary.month),
      days: summary.days,
      amount: toNumber(summary.amount),
      sentAt: summary.sent_at,
      review: summary.review,
      reviewNote: summary.review_note,
      reviewedAt: summary.reviewed_at,
    })),
  };
}
