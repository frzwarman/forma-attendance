-- Everyone still checked in is checked out at 23:59 WIB every day, in case they forgot, so each day
-- starts fresh: the next check-in (same phone or e-mail) is a new visit with its own check-out.
-- The phone forgets a check-in from an earlier day too (src/services/checkout.ts). pg_cron runs the
-- job; the sheet copy (20261103000000_guestbook_sheet_sync.sql) picks up the check-outs as usual.
-- Rollback: select cron.unschedule('guestbook-auto-check-out'); drop function private.guestbook_auto_check_out().
begin;

create extension if not exists pg_cron with schema pg_catalog;

-- Returns how many were checked out.
create function private.guestbook_auto_check_out() returns integer
language sql security definer set search_path = public as $$
  with done as (update public.guestbook_checkins set checked_out_at = now() where checked_out_at is null returning 1)
  select count(*)::int from done
$$;
revoke all on function private.guestbook_auto_check_out() from public, anon, authenticated;

-- pg_cron runs in UTC: 16:59 UTC is 23:59 WIB.
select cron.schedule('guestbook-auto-check-out', '59 16 * * *', 'select private.guestbook_auto_check_out()');

commit;
