-- On 02-11-2026 Sesi 1 ran past 12:00: from that day on Sesi 2 starts only when an admin presses Mulai
-- Sesi 2. 20261109000000_guestbook_sessions.sql was applied that afternoon and recorded the old split for the
-- day, Sesi 2 from 12:00 WIB. That start is removed (any recorded on the dot at 12:00:00 from that day on; an
-- admin's press never is), so the day's check-ins belong to Sesi 1 until an admin presses Mulai Sesi 2.
-- The 12:00 check-out job (20261107000000, removed by 20261108000000) had also run that day, checking out
-- everyone still there from the morning as if Sesi 1 had ended. Undone for those who have not checked in
-- since: they are present again, their phones show them checked in, and they check out themselves. The job's
-- check-outs share one time in the first seconds after 12:00 (anyone's own check-out has a time of its own).
-- The undone times are kept in private.guestbook_midday_check_out_undone. The sheet is put right by
-- repairSesi1On02Nov in scripts/google-sheet/Code.gs (see the README).
-- Rollback: update public.guestbook_checkins c set checked_out_at = u.checked_out_at
--   from private.guestbook_midday_check_out_undone u where c.id = u.id and c.checked_out_at is null;
-- the removed 12:00 start is not restored (an admin can press Mulai Sesi 2).
begin;

delete from public.guestbook_sessions
 where label = 'Sesi 2'
   and started_at >= timestamptz '2026-11-02 12:00:00+07'
   and (started_at at time zone 'Asia/Jakarta')::time = time '12:00';

create table private.guestbook_midday_check_out_undone as
select id, checked_out_at
  from public.guestbook_checkins
 where checked_out_at = (
         select checked_out_at
           from public.guestbook_checkins
          where checked_out_at >= timestamptz '2026-11-02 12:00:00+07'
            and checked_out_at < timestamptz '2026-11-02 12:00:10+07'
          group by checked_out_at
         having count(*) >= 2
          order by count(*) desc
          limit 1)
   and coalesce(last_checked_in_at, created_at) < timestamptz '2026-11-02 12:00:00+07';

update public.guestbook_checkins c
   set checked_out_at = null
  from private.guestbook_midday_check_out_undone u
 where c.id = u.id;

commit;
