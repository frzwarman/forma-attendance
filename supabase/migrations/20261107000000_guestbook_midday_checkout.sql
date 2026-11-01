-- Sesi 2 starts at 12:00 WIB every day (the sheet's session tabs split there too), so at 12:00 everyone
-- still checked in from Sesi 1 is checked out and checks in again for Sesi 2, a new visit in the
-- sheet's Sesi 2 tab. Only check-ins from before today's 12:00 are touched, so one made at 12:00 or
-- later stays checked in even if the job runs late. Phones forget a Sesi 1 check-in after 12:00 as well
-- (src/services/checkout.ts). The 23:59 check-out (20261104000000_guestbook_auto_checkout.sql) stays.
-- Rollback: select cron.unschedule('guestbook-midday-check-out'); drop function private.guestbook_midday_check_out().
begin;

-- Returns how many were checked out.
create function private.guestbook_midday_check_out() returns integer
language sql security definer set search_path = public as $$
  with done as (
    update public.guestbook_checkins set checked_out_at = now()
     where checked_out_at is null
       and coalesce(last_checked_in_at, created_at)
           < (date_trunc('day', now() at time zone 'Asia/Jakarta') + interval '12 hours') at time zone 'Asia/Jakarta'
    returning 1
  )
  select count(*)::int from done
$$;
revoke all on function private.guestbook_midday_check_out() from public, anon, authenticated;

-- pg_cron runs in UTC: 05:00 UTC is 12:00 WIB.
select cron.schedule('guestbook-midday-check-out', '0 5 * * *', 'select private.guestbook_midday_check_out()');

commit;
