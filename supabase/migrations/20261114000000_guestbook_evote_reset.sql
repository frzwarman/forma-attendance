-- Reset hitungan (E-Vote page): the vote under way starts again from zero with the same options, number
-- of picks and open or closed state. It is a new poll, so every phone can vote again, also one that voted;
-- the earlier votes stay in the database but no longer count (a ballot still meant for them is answered
-- "changed"). The Google Sheet's E-Vote tab is emptied too (scripts/google-sheet/Code.gs keeps the
-- header), and private.guestbook_sheet_resend() now sends only the votes of the count under way, so a
-- resend does not bring the earlier ones back.
-- Expand only.
-- Rollback: drop functions public.guestbook_reset_poll() and private.guestbook_sheet_reset_votes(); re-create
-- private.guestbook_sheet_resend() from 20261113000000_guestbook_evote_sheet.sql.
begin;

-- Tells the sheet to empty its E-Vote tab.
create function private.guestbook_sheet_reset_votes() returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_sheet private.guestbook_sheet;
begin
  select * into v_sheet from private.guestbook_sheet;
  if v_sheet.url is null then return; end if;
  perform net.http_post(url := v_sheet.url, body := jsonb_build_object('secret', v_sheet.secret, 'votes_reset', true), timeout_milliseconds := 30000);
exception when others then
  -- The reset matters more than the sheet.
  raise warning 'guestbook sheet sync skipped: %', sqlerrm;
end
$$;

create function public.guestbook_reset_poll() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_poll public.guestbook_polls;
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat mengatur E-Vote'; end if;
  perform pg_advisory_xact_lock(hashtext('guestbook_poll'));
  select * into v_poll from public.guestbook_polls order by created_at desc limit 1;
  if v_poll.id is null then raise exception 'Belum ada voting'; end if;
  insert into public.guestbook_polls (options, max_picks, is_open) values (v_poll.options, v_poll.max_picks, v_poll.is_open)
  returning * into v_poll;
  perform private.guestbook_sheet_reset_votes();
  return to_jsonb(v_poll);
end
$$;
revoke all on function public.guestbook_reset_poll() from public, anon;
grant execute on function public.guestbook_reset_poll() to authenticated;

-- Every check-in and message again, and the votes of the count under way. Returns the number of check-ins.
create or replace function private.guestbook_sheet_resend() returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  v_ids uuid[] := array(select id from public.guestbook_checkins order by created_at);
begin
  perform private.guestbook_sheet_send(v_ids);
  perform private.guestbook_sheet_send_feedback(array(select id from public.guestbook_feedback order by created_at));
  perform private.guestbook_sheet_send_ballots(array(
    select b from public.guestbook_ballots b
     where b.poll_id = (select id from public.guestbook_polls order by created_at desc limit 1)
     order by b.created_at));
  return coalesce(array_length(v_ids, 1), 0);
end
$$;

revoke all on all functions in schema private from public, anon, authenticated;

commit;
