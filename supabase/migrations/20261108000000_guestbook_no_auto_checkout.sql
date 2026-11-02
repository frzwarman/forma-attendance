-- No more automatic check-outs: the 23:59 (20261104000000_guestbook_auto_checkout.sql) and 12:00
-- (20261107000000_guestbook_midday_checkout.sql) jobs are removed, since the real session times vary.
-- A check-out is now recorded only when the attendee taps it or an admin checks them out; a forgotten
-- one stays empty, and the next check-in starts a new visit as before. Sessions are started by an
-- admin instead (20261109000000_guestbook_sessions.sql).
-- Rollback: re-run the cron.schedule lines and functions of those two migrations.
begin;

select cron.unschedule('guestbook-auto-check-out');
select cron.unschedule('guestbook-midday-check-out');
drop function private.guestbook_auto_check_out();
drop function private.guestbook_midday_check_out();

commit;
