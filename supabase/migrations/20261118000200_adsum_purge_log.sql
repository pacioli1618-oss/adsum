-- The rate-limit log (device id and network-address hash of each workplace creation) is only
-- needed for the last day's limit: purge it after 2 days, with the rest of the expired data.
create or replace function adsum.purge_expired()
returns void language sql volatile set search_path = '' as $$
  delete from adsum.notices where occurred_at < adsum.today_start();
  delete from adsum.summaries where expires_at < now();
  delete from adsum.workplaces where updated_at < now() - interval '400 days';
  delete from adsum.create_workplace_log where created_at < now() - interval '2 days';
$$;
