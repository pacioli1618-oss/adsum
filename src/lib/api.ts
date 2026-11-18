// The only door between the app and the database.
//
// - Calls the public.ad_* RPCs with typed arguments (database.types.ts).
// - Converts snake_case responses into camelCase view types (api-mappers.ts).
// - Throws RpcError with the fixed error code; translate it with useRpcErrorMessage().

import type {Locale} from '@/i18n/locales';
import {
  toAddedInvite,
  toClientWorkplace,
  toCreatedWorkplace,
  toInviteView,
  type RawAddedInvite,
  type RawClientWorkplace,
  type RawCreatedWorkplace,
  type RawInviteView,
  type Review,
} from './api-mappers';
import type {Database, Json} from './database.types';
import type {RateUnit} from './notebook';
import {supabase} from './supabase';

export type * from './api-mappers';

type Functions = Database['public']['Functions'];

/** message = the fixed error code (e.g. "invite_not_found"); details = DETAIL, when set. */
export class RpcError extends Error {
  constructor(
    message: string,
    public readonly details: string | null = null,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

async function call<F extends keyof Functions>(fn: F, args: Functions[F]['Args']): Promise<Functions[F]['Returns']> {
  const {data, error} = await supabase.rpc(fn, args as never);
  if (error) throw new RpcError(error.message, error.details || null);
  return data as Functions[F]['Returns'];
}

// ---------------------------------------------------------------------------
// Client (whoever holds the client token of a workplace)
// ---------------------------------------------------------------------------

export type WorkplaceInput = {
  name: string;
  rateAmount: number | null;
  rateUnit: RateUnit;
  wantsDailyNotice: boolean;
};

export async function createWorkplace(input: WorkplaceInput & {termsVersion: string; locale: Locale; deviceId?: string}) {
  const raw = await call('ad_create_workplace', {
    p_name: input.name,
    p_terms_version: input.termsVersion,
    p_rate_amount: input.rateAmount,
    p_rate_unit: input.rateUnit,
    p_wants_daily_notice: input.wantsDailyNotice,
    p_locale: input.locale,
    p_device_id: input.deviceId ?? null,
  });
  return toCreatedWorkplace(raw as RawCreatedWorkplace);
}

export async function getWorkplaceAsClient(slug: string, clientToken: string) {
  const raw = await call('ad_get_workplace_as_client', {p_slug: slug, p_client_token: clientToken});
  return toClientWorkplace(raw as RawClientWorkplace);
}

export async function updateWorkplace(slug: string, clientToken: string, input: WorkplaceInput) {
  await call('ad_update_workplace', {
    p_slug: slug,
    p_client_token: clientToken,
    p_name: input.name,
    p_rate_amount: input.rateAmount,
    p_rate_unit: input.rateUnit,
    p_wants_daily_notice: input.wantsDailyNotice,
  });
}

export async function addInvite(slug: string, clientToken: string, name: string) {
  const raw = await call('ad_add_invite', {p_slug: slug, p_client_token: clientToken, p_name: name});
  return toAddedInvite(raw as RawAddedInvite);
}

export async function removeProvider(slug: string, clientToken: string, providerId: string) {
  await call('ad_remove_provider', {p_slug: slug, p_client_token: clientToken, p_provider_id: providerId});
}

export async function reviewSummary(slug: string, clientToken: string, summaryId: string, review: Review, note: string) {
  await call('ad_review_summary', {
    p_slug: slug,
    p_client_token: clientToken,
    p_summary_id: summaryId,
    p_review: review,
    p_review_note: note.trim() || null,
  });
}

export async function deleteWorkplace(slug: string, clientToken: string) {
  await call('ad_delete_workplace', {p_slug: slug, p_client_token: clientToken});
}

// ---------------------------------------------------------------------------
// Provider (whoever holds an invite token)
// ---------------------------------------------------------------------------

export async function getInvite(slug: string, inviteToken: string) {
  const raw = await call('ad_get_invite', {p_slug: slug, p_invite_token: inviteToken});
  return toInviteView(raw as RawInviteView);
}

export async function acceptInvite(slug: string, inviteToken: string, sharesDailyNotice: boolean, deviceId?: string) {
  await call('ad_accept_invite', {
    p_slug: slug,
    p_invite_token: inviteToken,
    p_shares_daily_notice: sharesDailyNotice,
    p_device_id: deviceId ?? null,
  });
}

export async function declineInvite(slug: string, inviteToken: string) {
  await call('ad_decline_invite', {p_slug: slug, p_invite_token: inviteToken});
}

export async function setSharing(slug: string, inviteToken: string, isActive: boolean, sharesDailyNotice: boolean) {
  await call('ad_set_sharing', {
    p_slug: slug,
    p_invite_token: inviteToken,
    p_is_active: isActive,
    p_shares_daily_notice: sharesDailyNotice,
  });
}

export async function addNotice(slug: string, inviteToken: string, kind: 'check_in' | 'check_out', occurredAt: string) {
  await call('ad_add_notice', {p_slug: slug, p_invite_token: inviteToken, p_kind: kind, p_occurred_at: occurredAt});
}

export type SendSummaryInput = {
  /** "YYYY-MM" */
  month: string;
  days: number;
  hours: number | null;
  amount: number | null;
  lateDays: number;
  items: Json;
  includeHours: boolean;
  includeNotes: boolean;
};

export async function sendSummary(slug: string, inviteToken: string, input: SendSummaryInput) {
  await call('ad_send_summary', {
    p_slug: slug,
    p_invite_token: inviteToken,
    p_month: `${input.month}-01`,
    p_days: input.days,
    p_items: input.items,
    p_hours: input.includeHours ? input.hours : null,
    p_amount: input.amount,
    p_late_days: input.lateDays,
    p_include_hours: input.includeHours,
    p_include_notes: input.includeNotes,
  });
}
