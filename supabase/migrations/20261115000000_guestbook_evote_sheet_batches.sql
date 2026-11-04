-- E-Vote votes reach the Google Sheet in batches. Until now each vote sent its own request to the sheet's
-- Apps Script, and Google runs at most 30 requests of an account at once: a room voting together (100+
-- votes within seconds) would lose rows. Now a vote only joins a waiting list (no call to Google while the
-- attendee votes), and every 10 seconds pg_cron sends the waiting votes, 100 per request, so a burst is a
-- request or two. Votes of an earlier count (before Reset hitungan) are dropped from the list, so the emptied
-- tab stays empty; without a sheet set up the list is emptied all the same. A resend still sends every vote
-- of the count under way (20261114000000_guestbook_evote_reset.sql).
-- Expand only.
-- Rollback: select cron.unschedule('guestbook-sheet-votes'); re-create private.guestbook_sheet_ballots_added()
-- from 20261113000000_guestbook_evote_sheet.sql; drop function private.guestbook_sheet_send_queued_votes();
-- drop table private.guestbook_sheet_vote_queue.
begin;

create extension if not exists pg_cron with schema pg_catalog;

-- Votes cast since the last batch. Deleting a ballot takes it off the list.
create table private.guestbook_sheet_vote_queue (
  poll_id uuid not null,
  device_id text not null,
  primary key (poll_id, device_id),
  foreign key (poll_id, device_id) references public.guestbook_ballots (poll_id, device_id) on delete cascade
);

-- After each vote: onto the list, nothing else.
create or replace function private.guestbook_sheet_ballots_added() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  insert into private.guestbook_sheet_vote_queue (poll_id, device_id)
  select poll_id, device_id from changed
  on conflict do nothing;
  return null;
exception when others then
  -- Whatever goes wrong with the copy, the vote is kept.
  raise warning 'guestbook sheet sync skipped: %', sqlerrm;
  return null;
end
$$;

-- Every 10 seconds: takes the waiting votes off the list and sends those of the count under way. Returns
-- how many were sent (0 without a sheet).
create function private.guestbook_sheet_send_queued_votes() returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  v_ballots public.guestbook_ballots[];
begin
  with taken as (
    delete from private.guestbook_sheet_vote_queue returning poll_id, device_id
  )
  select coalesce(array_agg(b order by b.created_at), '{}') into v_ballots
    from public.guestbook_ballots b
    join taken t using (poll_id, device_id)
   where b.poll_id = (select id from public.guestbook_polls order by created_at desc limit 1);
  if not exists (select 1 from private.guestbook_sheet) then return 0; end if;
  perform private.guestbook_sheet_send_ballots(v_ballots);
  return coalesce(array_length(v_ballots, 1), 0);
end
$$;

revoke all on all functions in schema private from public, anon, authenticated;

select cron.schedule('guestbook-sheet-votes', '10 seconds', 'select private.guestbook_sheet_send_queued_votes()');

commit;
