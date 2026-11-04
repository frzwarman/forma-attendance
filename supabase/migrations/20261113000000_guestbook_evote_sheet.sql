-- E-Vote votes go to the Google Sheet's E-Vote tab (scripts/google-sheet/Code.gs), a row per vote with its
-- time and picks only: no name, nothing that ties the vote to a phone or an attendee. Each vote is sent
-- as it is cast; private.guestbook_sheet_resend() now sends every vote too, and this migration sends the
-- votes cast so far. The row's ID is the MD5 of the vote and the phone's ID, so a resend updates the row
-- instead of adding it again; the sheet keeps it in a hidden column. A TYPE LAYOUT answer moved from the
-- registration form (20261112000000_guestbook_evote_type_layout.sql) shows when its attendee last
-- checked in rather than when it was moved. Publish the updated Code.gs before applying this: the old
-- script ignores votes (then run select private.guestbook_sheet_resend()).
-- Expand only.
-- Rollback: drop trigger guestbook_sheet_ballot_insert on guestbook_ballots; drop functions
-- private.guestbook_sheet_ballots_added(), private.guestbook_sheet_send_ballots(public.guestbook_ballots[])
-- and private.guestbook_sheet_ballot(public.guestbook_ballots); re-create private.guestbook_sheet_resend()
-- from 20261106000000_guestbook_feedback.sql.
begin;

-- One sheet row: when the vote was cast and its picks, in the vote's order ("Round table, U-shape").
create function private.guestbook_sheet_ballot(b public.guestbook_ballots) returns jsonb
language sql stable set search_path = public, private as $$
  select jsonb_build_object('id', md5(b.poll_id::text || ':' || b.device_id), 'cells', jsonb_build_array(
    jsonb_build_array('Waktu (WIB)', private.guestbook_sheet_wib(coalesce(
      (select coalesce(c.last_checked_in_at, c.created_at) from public.guestbook_checkins c where md5('form:' || c.id::text) = b.device_id),
      b.created_at))),
    jsonb_build_array('Pilihan', coalesce(
      (select string_agg(p.options[i + 1], ', ' order by i) from public.guestbook_polls p, unnest(b.picks) as i where p.id = b.poll_id), ''))
  ))
$$;

-- Sends p_ballots, 100 per request.
create function private.guestbook_sheet_send_ballots(p_ballots public.guestbook_ballots[]) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_sheet private.guestbook_sheet;
  v_rows jsonb;
begin
  select * into v_sheet from private.guestbook_sheet;
  if v_sheet.url is null then return; end if;
  for i in 0 .. coalesce(array_length(p_ballots, 1), 0) - 1 by 100 loop
    select jsonb_agg(private.guestbook_sheet_ballot(b) order by b.created_at) into v_rows from unnest(p_ballots[i + 1 : i + 100]) b;
    if v_rows is not null then
      perform net.http_post(url := v_sheet.url, body := jsonb_build_object('secret', v_sheet.secret, 'votes', v_rows), timeout_milliseconds := 30000);
    end if;
  end loop;
exception when others then
  -- The vote matters more than its copy in the sheet.
  raise warning 'guestbook sheet sync skipped: %', sqlerrm;
end
$$;

create function private.guestbook_sheet_ballots_added() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  -- Read from the table: rows of the transition table are plain records, not guestbook_ballots.
  perform private.guestbook_sheet_send_ballots(array(select b from public.guestbook_ballots b join changed c using (poll_id, device_id)));
  return null;
exception when others then
  -- Whatever goes wrong with the copy, the vote is kept.
  raise warning 'guestbook sheet sync skipped: %', sqlerrm;
  return null;
end
$$;
create trigger guestbook_sheet_ballot_insert after insert on public.guestbook_ballots
  referencing new table as changed for each statement execute function private.guestbook_sheet_ballots_added();

-- Every check-in, message and vote again. Returns the number of check-ins.
create or replace function private.guestbook_sheet_resend() returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  v_ids uuid[] := array(select id from public.guestbook_checkins order by created_at);
begin
  perform private.guestbook_sheet_send(v_ids);
  perform private.guestbook_sheet_send_feedback(array(select id from public.guestbook_feedback order by created_at));
  perform private.guestbook_sheet_send_ballots(array(select b from public.guestbook_ballots b order by b.created_at));
  return coalesce(array_length(v_ids, 1), 0);
end
$$;

revoke all on all functions in schema private from public, anon, authenticated;

-- The votes cast so far.
select private.guestbook_sheet_send_ballots(array(select b from public.guestbook_ballots b order by b.created_at));

commit;
