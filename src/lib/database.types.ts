// The public ad_* functions the app calls (supabase/migrations). The database is shared with other
// GR1618 apps, so this file lists only Adsum's functions instead of the full generated output.
// Keep it in step with the migrations: `npm run db:types` prints the generated version to compare.

export type Json = string | number | boolean | null | {[key: string]: Json | undefined} | Json[];

type Fn<Args, Returns> = {Args: Args; Returns: Returns};

type ClientArgs = {p_slug: string; p_client_token: string};
type InviteArgs = {p_slug: string; p_invite_token: string};

export type Database = {
  __InternalSupabase: {PostgrestVersion: '14.18'};
  public: {
    Tables: {[_ in never]: never};
    Views: {[_ in never]: never};
    Functions: {
      ad_create_workplace: Fn<
        {
          p_name: string;
          p_terms_version: string;
          p_rate_amount?: number | null;
          p_rate_unit?: string;
          p_wants_daily_notice?: boolean;
          p_locale?: string;
          p_device_id?: string | null;
        },
        Json
      >;
      ad_get_workplace_as_client: Fn<ClientArgs, Json>;
      ad_update_workplace: Fn<
        ClientArgs & {p_name: string; p_rate_amount?: number | null; p_rate_unit?: string; p_wants_daily_notice?: boolean},
        undefined
      >;
      ad_add_invite: Fn<ClientArgs & {p_name: string}, Json>;
      ad_remove_provider: Fn<ClientArgs & {p_provider_id: string}, undefined>;
      ad_review_summary: Fn<ClientArgs & {p_summary_id: string; p_review: string; p_review_note?: string | null}, undefined>;
      ad_delete_workplace: Fn<ClientArgs, undefined>;
      ad_get_invite: Fn<InviteArgs, Json>;
      ad_accept_invite: Fn<InviteArgs & {p_shares_daily_notice?: boolean; p_device_id?: string | null}, undefined>;
      ad_decline_invite: Fn<InviteArgs, undefined>;
      ad_set_sharing: Fn<InviteArgs & {p_is_active: boolean; p_shares_daily_notice?: boolean}, undefined>;
      ad_add_notice: Fn<InviteArgs & {p_kind: string; p_occurred_at?: string}, undefined>;
      ad_send_summary: Fn<
        InviteArgs & {
          p_month: string;
          p_days: number;
          p_items: Json;
          p_hours?: number | null;
          p_amount?: number | null;
          p_late_days?: number;
          p_include_hours?: boolean;
          p_include_notes?: boolean;
        },
        Json
      >;
    };
    Enums: {[_ in never]: never};
    CompositeTypes: {[_ in never]: never};
  };
};
