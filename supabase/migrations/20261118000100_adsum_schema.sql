-- Adsum: schema, tables and RPCs.
--
-- Lives in the QuemLeva Supabase project, in its own schema. The schema is not exposed through
-- the Data API: every read and write goes through the public.ad_* functions below.
--
-- Model (docs/conventions.md):
--   * workplace     — what a client creates: a place and its rate. Managed with the client token.
--   * client token  — only its sha256 is stored.
--   * provider      — a person invited to a workplace. Their token is the invite link; only its
--                     sha256 is stored. The plain copy stays in invite_token while the invite is
--                     pending, so the client can send it again, and is erased once it is answered.
--   * notebook      — the provider's own days, kept on the provider's device. The server never
--                     sees it. It only receives what the provider chooses to share:
--   * notice        — "arrived" / "left" on the day, when the provider allows it. Kept for that
--                     day only.
--   * summary       — the month the provider sends. Kept for 60 days, then deleted.

create schema if not exists adsum;
revoke all on schema adsum from public, anon, authenticated;

------------------------------------------------------------------------
-- 1. Tables
------------------------------------------------------------------------
create table adsum.workplaces (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null check (length(trim(name)) between 1 and 80),
  rate_amount        numeric(10,2) check (rate_amount is null or rate_amount > 0),
  rate_unit          text not null default 'day' check (rate_unit in ('day', 'hour')),
  currency           text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  wants_daily_notice boolean not null default false,
  locale             text not null default 'pt-BR' check (locale in ('pt-BR', 'es', 'en')),
  terms_version      text not null check (length(terms_version) between 1 and 20),
  terms_accepted_at  timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table adsum.client_tokens (
  id           uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references adsum.workplaces(id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);
create index client_tokens_workplace_id_idx on adsum.client_tokens (workplace_id);

create table adsum.providers (
  id                  uuid primary key default gen_random_uuid(),
  workplace_id        uuid not null references adsum.workplaces(id) on delete cascade,
  name                text not null check (length(trim(name)) between 1 and 60),
  token_hash          text not null unique,
  invite_token        text unique,
  status              text not null default 'invited' check (status in ('invited', 'active', 'stopped', 'declined')),
  shares_daily_notice boolean not null default false,
  device_id           uuid,
  accepted_at         timestamptz,
  stopped_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index providers_workplace_id_idx on adsum.providers (workplace_id);
create unique index providers_workplace_id_name_idx on adsum.providers (workplace_id, lower(trim(name)));

create table adsum.notices (
  id          bigint generated always as identity primary key,
  provider_id uuid not null references adsum.providers(id) on delete cascade,
  kind        text not null check (kind in ('check_in', 'check_out')),
  occurred_at timestamptz not null,
  created_at  timestamptz not null default now()
);
create index notices_provider_id_idx on adsum.notices (provider_id, occurred_at);
create index notices_created_at_idx on adsum.notices (created_at);

create table adsum.summaries (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references adsum.providers(id) on delete cascade,
  month         date not null check (extract(day from month) = 1),
  days          int not null check (days between 0 and 31),
  hours         numeric(6,2) check (hours is null or hours between 0 and 744),
  amount        numeric(12,2) check (amount is null or amount >= 0),
  late_days     int not null default 0 check (late_days between 0 and 31),
  items         jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 31),
  include_hours boolean not null default true,
  include_notes boolean not null default false,
  sent_at       timestamptz not null default now(),
  review        text check (review in ('confirmed', 'disputed')),
  review_note   text check (length(review_note) <= 300),
  reviewed_at   timestamptz,
  expires_at    timestamptz not null default now() + interval '60 days',
  unique (provider_id, month)
);
create index summaries_expires_at_idx on adsum.summaries (expires_at);

-- Anti-spam for ad_create_workplace, same rules as the other Sidekicks.
create table adsum.secrets (
  name  text primary key,
  value text not null
);
insert into adsum.secrets (name, value)
values ('ip_salt', encode(extensions.gen_random_bytes(32), 'hex'));

create table adsum.create_workplace_log (
  id         bigint generated always as identity primary key,
  device_id  uuid,
  ip_hash    text,
  created_at timestamptz not null default now()
);
create index create_workplace_log_device_id_idx on adsum.create_workplace_log (device_id, created_at desc) where device_id is not null;
create index create_workplace_log_ip_hash_idx on adsum.create_workplace_log (ip_hash, created_at desc) where ip_hash is not null;
create index create_workplace_log_created_at_idx on adsum.create_workplace_log (created_at);

-- RLS on and no policies: no direct access for anon/authenticated.
alter table adsum.workplaces           enable row level security;
alter table adsum.client_tokens        enable row level security;
alter table adsum.providers            enable row level security;
alter table adsum.notices              enable row level security;
alter table adsum.summaries            enable row level security;
alter table adsum.secrets              enable row level security;
alter table adsum.create_workplace_log enable row level security;
revoke all on all tables in schema adsum from public, anon, authenticated;

------------------------------------------------------------------------
-- 2. Internal helpers (schema adsum, not callable by clients)
------------------------------------------------------------------------
create function adsum.hash_token(p_token text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

create function adsum.random_text(n int)
returns text language sql volatile set search_path = '' as $$
  -- Alphabet without look-alikes (0/o, 1/l/i) so links survive being read aloud.
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', (get_byte(b, i) % 31) + 1, 1), '' order by i)
  from (select extensions.gen_random_bytes(n) as b) x, generate_series(0, n - 1) as i
$$;

-- Start of "today" in Brazil. Notices older than this are never shown and get deleted.
create function adsum.today_start()
returns timestamptz language sql stable set search_path = '' as $$
  select (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'
$$;

-- Deletes what the privacy policy promises to delete. Called lazily by the busiest RPCs
-- (there is no cron in this project): notices after their day, summaries after 60 days,
-- workplaces with no activity for 400 days.
create function adsum.purge_expired()
returns void language sql volatile set search_path = '' as $$
  delete from adsum.notices where occurred_at < adsum.today_start();
  delete from adsum.summaries where expires_at < now();
  delete from adsum.workplaces where updated_at < now() - interval '400 days';
$$;

create function adsum.require_client_workplace(p_slug text, p_client_token text)
returns adsum.workplaces language plpgsql stable set search_path = '' as $$
declare w adsum.workplaces;
begin
  select wp.* into w
  from adsum.workplaces wp
  join adsum.client_tokens c on c.workplace_id = wp.id
  where wp.slug = p_slug
    and c.token_hash = adsum.hash_token(p_client_token)
    and c.revoked_at is null;
  if not found then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return w;
end $$;

create function adsum.require_provider(p_slug text, p_invite_token text)
returns adsum.providers language plpgsql stable set search_path = '' as $$
declare p adsum.providers;
begin
  select pr.* into p
  from adsum.providers pr
  join adsum.workplaces w on w.id = pr.workplace_id
  where w.slug = p_slug and pr.token_hash = adsum.hash_token(p_invite_token);
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  return p;
end $$;

create function adsum.require_active(p adsum.providers)
returns void language plpgsql stable set search_path = '' as $$
begin
  if p.status <> 'active' then
    raise exception 'sharing_not_active' using errcode = 'P0001';
  end if;
end $$;

create function adsum.touch_workplace(p_workplace_id uuid)
returns void language sql volatile set search_path = '' as $$
  update adsum.workplaces set updated_at = now() where id = p_workplace_id;
$$;

create function adsum.request_ip_hash()
returns text language sql stable set search_path = '' as $$
  with h as (select nullif(current_setting('request.headers', true), '')::json as headers),
       ip as (
         select nullif(trim(coalesce(
                  headers->>'cf-connecting-ip',
                  split_part(headers->>'x-forwarded-for', ',', 1))), '') as value
         from h)
  select case when ip.value is null then null
              else adsum.hash_token((select value from adsum.secrets where name = 'ip_salt') || ip.value)
         end
  from ip
$$;

-- Limits: per device 10/hour, 30/day; per IP 30/hour, 100/day. Over → 'rate_limited' (DETAIL hour|day).
create function adsum.check_create_workplace_rate(p_device_id uuid)
returns void language plpgsql volatile set search_path = '' as $$
declare
  v_ip_hash text := adsum.request_ip_hash();
begin
  if p_device_id is not null then perform pg_advisory_xact_lock(hashtext('ad_create:' || p_device_id::text)); end if;
  if v_ip_hash   is not null then perform pg_advisory_xact_lock(hashtext('ad_create:' || v_ip_hash)); end if;

  delete from adsum.create_workplace_log where created_at < now() - interval '1 day';

  if p_device_id is not null then
    if (select count(*) from adsum.create_workplace_log
        where device_id = p_device_id and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'rate_limited' using detail = 'hour';
    end if;
    if (select count(*) from adsum.create_workplace_log where device_id = p_device_id) >= 30 then
      raise exception 'rate_limited' using detail = 'day';
    end if;
  end if;

  if v_ip_hash is not null then
    if (select count(*) from adsum.create_workplace_log
        where ip_hash = v_ip_hash and created_at > now() - interval '1 hour') >= 30 then
      raise exception 'rate_limited' using detail = 'hour';
    end if;
    if (select count(*) from adsum.create_workplace_log where ip_hash = v_ip_hash) >= 100 then
      raise exception 'rate_limited' using detail = 'day';
    end if;
  end if;

  insert into adsum.create_workplace_log (device_id, ip_hash) values (p_device_id, v_ip_hash);
end $$;

create function adsum.workplace_json(w adsum.workplaces)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'slug', w.slug,
    'name', w.name,
    'rate_amount', w.rate_amount,
    'rate_unit', w.rate_unit,
    'currency', w.currency,
    'wants_daily_notice', w.wants_daily_notice,
    'locale', w.locale)
$$;

-- What the client sees of a summary: hours and notes only when the provider chose to include them.
create function adsum.summary_json(s adsum.summaries, p_provider_name text)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id,
    'provider_id', s.provider_id,
    'provider_name', p_provider_name,
    'month', s.month,
    'days', s.days,
    'hours', case when s.include_hours then s.hours end,
    'amount', s.amount,
    'late_days', s.late_days,
    'include_hours', s.include_hours,
    'include_notes', s.include_notes,
    'items', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'date', i->>'date',
               'check_in', case when s.include_hours then i->>'check_in' end,
               'check_out', case when s.include_hours then i->>'check_out' end,
               'note', case when s.include_notes then i->>'note' end,
               'is_late', coalesce((i->>'is_late')::boolean, false)))
             order by i->>'date')
      from jsonb_array_elements(s.items) i), '[]'::jsonb),
    'sent_at', s.sent_at,
    'review', s.review,
    'review_note', s.review_note,
    'reviewed_at', s.reviewed_at,
    'expires_at', s.expires_at)
$$;

revoke execute on all functions in schema adsum from public, anon, authenticated;

------------------------------------------------------------------------
-- 3. Client RPCs (client token)
------------------------------------------------------------------------

-- Returns the client token once. Store it right away.
create function public.ad_create_workplace(
  p_name               text,
  p_terms_version      text,
  p_rate_amount        numeric default null,
  p_rate_unit          text    default 'day',
  p_wants_daily_notice boolean default false,
  p_locale             text    default 'pt-BR',
  p_device_id          uuid    default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_slug         text;
  v_client_token text := adsum.random_text(32);
  v_id           uuid;
begin
  if nullif(trim(p_terms_version), '') is null then
    raise exception 'terms_not_accepted' using errcode = '22023';
  end if;
  perform adsum.check_create_workplace_rate(p_device_id);

  loop
    v_slug := adsum.random_text(12);
    exit when not exists (select 1 from adsum.workplaces where slug = v_slug);
  end loop;

  insert into adsum.workplaces (slug, name, rate_amount, rate_unit, wants_daily_notice, locale, terms_version)
  values (v_slug, trim(p_name), p_rate_amount, coalesce(p_rate_unit, 'day'), coalesce(p_wants_daily_notice, false),
          coalesce(p_locale, 'pt-BR'), trim(p_terms_version))
  returning id into v_id;

  insert into adsum.client_tokens (workplace_id, token_hash) values (v_id, adsum.hash_token(v_client_token));

  return jsonb_build_object('slug', v_slug, 'client_token', v_client_token);
end $$;

-- Client panel: workplace, people and the summaries still kept.
create function public.ad_get_workplace_as_client(p_slug text, p_client_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w adsum.workplaces := adsum.require_client_workplace(p_slug, p_client_token);
begin
  perform adsum.purge_expired();
  return adsum.workplace_json(w) || jsonb_build_object(
    'providers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'name', p.name,
               'status', p.status,
               'shares_daily_notice', p.shares_daily_notice and p.status = 'active',
               'invite_token', case when p.status = 'invited' then p.invite_token end,
               'accepted_at', p.accepted_at,
               'stopped_at', p.stopped_at,
               'today_notices', case when p.status = 'active' and p.shares_daily_notice then coalesce((
                   select jsonb_agg(jsonb_build_object('kind', n.kind, 'occurred_at', n.occurred_at) order by n.occurred_at)
                   from adsum.notices n
                   where n.provider_id = p.id and n.occurred_at >= adsum.today_start()), '[]'::jsonb)
                 else '[]'::jsonb end)
             order by p.created_at, p.id)
      from adsum.providers p where p.workplace_id = w.id), '[]'::jsonb),
    'summaries', coalesce((
      select jsonb_agg(adsum.summary_json(s, p.name) order by s.month desc, p.name)
      from adsum.summaries s join adsum.providers p on p.id = s.provider_id
      where p.workplace_id = w.id), '[]'::jsonb));
end $$;

create function public.ad_update_workplace(
  p_slug text, p_client_token text, p_name text,
  p_rate_amount numeric default null, p_rate_unit text default 'day', p_wants_daily_notice boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  w adsum.workplaces := adsum.require_client_workplace(p_slug, p_client_token);
begin
  update adsum.workplaces
  set name = trim(p_name), rate_amount = p_rate_amount, rate_unit = coalesce(p_rate_unit, 'day'),
      wants_daily_notice = coalesce(p_wants_daily_notice, false), updated_at = now()
  where id = w.id;
end $$;

-- Returns the invite token: the client sends it to the person (WhatsApp).
create function public.ad_add_invite(p_slug text, p_client_token text, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w       adsum.workplaces := adsum.require_client_workplace(p_slug, p_client_token);
  v_name  text := trim(coalesce(p_name, ''));
  v_token text := adsum.random_text(24);
  v_id    uuid;
begin
  if v_name = '' then
    raise exception 'provider_name_required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('ad_workplace:' || w.id::text));
  if (select count(*) from adsum.providers where workplace_id = w.id) >= 100 then
    raise exception 'workplace_full' using errcode = 'P0001';
  end if;
  if exists (select 1 from adsum.providers where workplace_id = w.id and lower(trim(name)) = lower(v_name)) then
    raise exception 'provider_name_taken' using errcode = '23505', detail = v_name;
  end if;

  insert into adsum.providers (workplace_id, name, token_hash, invite_token)
  values (w.id, v_name, adsum.hash_token(v_token), v_token)
  returning id into v_id;
  perform adsum.touch_workplace(w.id);

  return jsonb_build_object('id', v_id, 'name', v_name, 'invite_token', v_token);
end $$;

-- Cancels a pending invite or removes the person (and the summaries they sent).
create function public.ad_remove_provider(p_slug text, p_client_token text, p_provider_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  w adsum.workplaces := adsum.require_client_workplace(p_slug, p_client_token);
begin
  delete from adsum.providers where id = p_provider_id and workplace_id = w.id;
  if not found then
    raise exception 'provider_not_found' using errcode = 'P0002';
  end if;
end $$;

create function public.ad_review_summary(
  p_slug text, p_client_token text, p_summary_id uuid, p_review text, p_review_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  w adsum.workplaces := adsum.require_client_workplace(p_slug, p_client_token);
begin
  if p_review not in ('confirmed', 'disputed') then
    raise exception 'review_invalid' using errcode = '22023';
  end if;
  update adsum.summaries s
  set review = p_review, review_note = nullif(trim(p_review_note), ''), reviewed_at = now()
  from adsum.providers p
  where s.id = p_summary_id and p.id = s.provider_id and p.workplace_id = w.id;
  if not found then
    raise exception 'summary_not_found' using errcode = 'P0002';
  end if;
  perform adsum.touch_workplace(w.id);
end $$;

create function public.ad_delete_workplace(p_slug text, p_client_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  w adsum.workplaces := adsum.require_client_workplace(p_slug, p_client_token);
begin
  delete from adsum.workplaces where id = w.id;
end $$;

------------------------------------------------------------------------
-- 4. Provider RPCs (invite token)
------------------------------------------------------------------------

-- Invite screen and the provider's sharing status. Works before and after answering.
create function public.ad_get_invite(p_slug text, p_invite_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p adsum.providers := adsum.require_provider(p_slug, p_invite_token);
  w adsum.workplaces;
begin
  select * into w from adsum.workplaces where id = p.workplace_id;
  return jsonb_build_object(
    'workplace', adsum.workplace_json(w),
    'provider_name', p.name,
    'status', p.status,
    'shares_daily_notice', p.shares_daily_notice,
    'summaries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'month', s.month, 'days', s.days, 'amount', s.amount, 'sent_at', s.sent_at,
               'review', s.review, 'review_note', s.review_note, 'reviewed_at', s.reviewed_at)
             order by s.month desc)
      from adsum.summaries s where s.provider_id = p.id and s.expires_at >= now()), '[]'::jsonb));
end $$;

create function public.ad_accept_invite(p_slug text, p_invite_token text, p_shares_daily_notice boolean default false, p_device_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p adsum.providers := adsum.require_provider(p_slug, p_invite_token);
  w adsum.workplaces;
begin
  select * into w from adsum.workplaces where id = p.workplace_id;
  update adsum.providers
  set status = 'active',
      shares_daily_notice = coalesce(p_shares_daily_notice, false) and w.wants_daily_notice,
      device_id = coalesce(p_device_id, device_id),
      accepted_at = coalesce(accepted_at, now()),
      stopped_at = null,
      invite_token = null
  where id = p.id;
  perform adsum.touch_workplace(p.workplace_id);
end $$;

create function public.ad_decline_invite(p_slug text, p_invite_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p adsum.providers := adsum.require_provider(p_slug, p_invite_token);
begin
  update adsum.providers set status = 'declined', invite_token = null, shares_daily_notice = false where id = p.id;
end $$;

-- Stop or resume sharing, and switch the daily notice. Stopping deletes today's notices.
create function public.ad_set_sharing(p_slug text, p_invite_token text, p_is_active boolean, p_shares_daily_notice boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p adsum.providers := adsum.require_provider(p_slug, p_invite_token);
  w adsum.workplaces;
begin
  if p.status = 'invited' then
    raise exception 'invite_not_answered' using errcode = 'P0001';
  end if;
  select * into w from adsum.workplaces where id = p.workplace_id;
  if p_is_active then
    update adsum.providers
    set status = 'active', stopped_at = null,
        shares_daily_notice = coalesce(p_shares_daily_notice, false) and w.wants_daily_notice,
        accepted_at = coalesce(accepted_at, now())
    where id = p.id;
  else
    update adsum.providers set status = 'stopped', stopped_at = now(), shares_daily_notice = false where id = p.id;
    delete from adsum.notices where provider_id = p.id;
  end if;
  if not coalesce(p_shares_daily_notice, false) then
    delete from adsum.notices where provider_id = p.id;
  end if;
  perform adsum.touch_workplace(p.workplace_id);
end $$;

-- "Arrived" / "left" on the day. Only today's, only when the provider shares them.
create function public.ad_add_notice(p_slug text, p_invite_token text, p_kind text, p_occurred_at timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
declare
  p adsum.providers := adsum.require_provider(p_slug, p_invite_token);
begin
  perform adsum.require_active(p);
  if not p.shares_daily_notice then
    raise exception 'daily_notice_off' using errcode = 'P0001';
  end if;
  if p_kind not in ('check_in', 'check_out') then
    raise exception 'notice_invalid' using errcode = '22023';
  end if;
  -- A notice sent late (offline) still counts on its day; past days are not shared.
  if p_occurred_at < adsum.today_start() or p_occurred_at > now() + interval '5 minutes' then
    raise exception 'notice_out_of_day' using errcode = '22023';
  end if;
  if (select count(*) from adsum.notices where provider_id = p.id and occurred_at >= adsum.today_start()) >= 20 then
    raise exception 'rate_limited' using detail = 'day';
  end if;
  insert into adsum.notices (provider_id, kind, occurred_at) values (p.id, p_kind, p_occurred_at);
end $$;

-- The month the provider sends, as they wrote it. Sending again replaces it and clears the review.
create function public.ad_send_summary(
  p_slug          text,
  p_invite_token  text,
  p_month         date,
  p_days          int,
  p_items         jsonb,
  p_hours         numeric default null,
  p_amount        numeric default null,
  p_late_days     int     default 0,
  p_include_hours boolean default true,
  p_include_notes boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p adsum.providers := adsum.require_provider(p_slug, p_invite_token);
  v_month date := date_trunc('month', p_month)::date;
  v_id uuid;
begin
  perform adsum.require_active(p);
  perform adsum.purge_expired();
  if v_month > date_trunc('month', now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'month_in_future' using errcode = '22023';
  end if;

  insert into adsum.summaries (provider_id, month, days, hours, amount, late_days, items, include_hours, include_notes)
  values (p.id, v_month, p_days, p_hours, p_amount, coalesce(p_late_days, 0), coalesce(p_items, '[]'::jsonb),
          coalesce(p_include_hours, true), coalesce(p_include_notes, false))
  on conflict (provider_id, month) do update
  set days = excluded.days, hours = excluded.hours, amount = excluded.amount, late_days = excluded.late_days,
      items = excluded.items, include_hours = excluded.include_hours, include_notes = excluded.include_notes,
      sent_at = now(), review = null, review_note = null, reviewed_at = null,
      expires_at = now() + interval '60 days'
  returning id into v_id;
  perform adsum.touch_workplace(p.workplace_id);

  return jsonb_build_object('id', v_id, 'month', v_month);
end $$;

------------------------------------------------------------------------
-- 5. Grants: only the public RPCs, for the browser (anon) role
------------------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname like 'ad\_%'
  loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
