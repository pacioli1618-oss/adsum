import {useTranslations} from 'next-intl';

// ad_* RPCs raise errors whose message is a fixed code (docs/conventions.md, section 5).
// Messages → Errors uses the same codes as keys.
export const rpcErrorCodes = [
  'not_authorized',
  'terms_not_accepted',
  'provider_name_required',
  'provider_name_taken',
  'provider_not_found',
  'workplace_full',
  'review_invalid',
  'summary_not_found',
  'invite_not_found',
  'invite_not_answered',
  'sharing_not_active',
  'daily_notice_off',
  'notice_invalid',
  'notice_out_of_day',
  'month_in_future',
  'rate_limited',
] as const;
export type RpcErrorCode = (typeof rpcErrorCodes)[number];

type RpcError = {message?: string; details?: string | null} | null | undefined;

export function getRpcErrorCode(error: unknown): RpcErrorCode | 'network' | 'unknown' {
  const failure = error as RpcError;
  if (!failure) return 'unknown';
  const code = failure.message?.trim();
  if ((rpcErrorCodes as readonly string[]).includes(code ?? '')) return code as RpcErrorCode;
  if (code && /fetch|network|failed to fetch/i.test(code)) return 'network';
  return 'unknown';
}

/** Turns an RPC error into a message for the person. */
export function useRpcErrorMessage() {
  const t = useTranslations('Errors');

  return (error: unknown) => {
    const failure = error as RpcError;
    const code = getRpcErrorCode(error);
    if (code === 'rate_limited') {
      // DETAIL says which window is full: 'hour' or 'day'.
      return t('rate_limited', {period: failure?.details === 'day' ? 'day' : 'hour'});
    }
    if (code === 'provider_name_taken') {
      return t('provider_name_taken', {name: failure?.details ?? ''});
    }
    return t(code);
  };
}
