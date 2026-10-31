-- Copies every check-in to a Google Spreadsheet within seconds: after each statement that changes
-- check-ins or draw winners, the changed rows go to the sheet's Apps Script web app
-- (scripts/google-sheet/Code.gs) through pg_net, which sends after commit, in the background.
-- A row per person, matched by ID: a new check-in adds one, a repeat check-in, check-out or prize
-- updates it, a deleted check-in removes it. Same columns as the admin export, plus ID.
-- Nothing is sent until private.guestbook_sheet holds the web app's URL and secret (see the README).
-- The database does not retry: a send that fails is lost, and select private.guestbook_sheet_resend()
-- sends every row again. A sheet problem never blocks a check-in.
-- Rollback: drop the six guestbook_sheet_ triggers, then drop schema private cascade (this drops
-- the saved URL and secret). pg_net can stay.
begin;

create extension if not exists pg_net with schema extensions;

-- Not exposed by the API, and closed to the attendee and admin roles.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.guestbook_sheet (
  id smallint primary key default 1 check (id = 1),
  -- A Google Workspace account's web app URL has /a/macros/<domain>/ in place of /macros/.
  url text not null check (url ~ '^https://script\.google\.com/(a/macros/[A-Za-z0-9.-]+|macros)/s/[A-Za-z0-9_-]+/exec$'),
  -- Also saved in the script's properties; the script refuses requests without it.
  secret text not null check (length(secret) >= 24)
);

-- As the admin export writes times: 26/10/2026 10:05 WIB.
create function private.guestbook_sheet_wib(t timestamptz) returns text
language sql immutable as $$
  select case when t is null then '' else to_char(t at time zone 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI') || ' WIB' end
$$;

-- One sheet row as [header, value] pairs, in the export's order (jsonb objects would sort the keys).
create function private.guestbook_sheet_row(c public.guestbook_checkins, w public.guestbook_draw_winners) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', c.id, 'cells',
    jsonb_build_array(
      jsonb_build_array('Waktu Check-in (WIB)', private.guestbook_sheet_wib(c.created_at)),
      jsonb_build_array('Check-in Terakhir (WIB)', private.guestbook_sheet_wib(c.last_checked_in_at)),
      jsonb_build_array('Jumlah Check-in', c.checkin_count::text),
      jsonb_build_array('Waktu Check-out (WIB)', private.guestbook_sheet_wib(c.checked_out_at)),
      jsonb_build_array('Nama', c.name),
      jsonb_build_array('Nomor Telepon', c.phone),
      jsonb_build_array('E-mail', c.email),
      jsonb_build_array('Divisi', coalesce(c.divisi, '')),
      jsonb_build_array('Nomor Kamar Hotel', coalesce(c.room_number, ''))
    )
    || coalesce((select jsonb_agg(jsonb_build_array(a.key, a.value) order by a.key) from jsonb_each_text(c.answers) a), '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_array('Berkas', coalesce(c.file_path, '')),
      jsonb_build_array('Hadiah', coalesce(w.prize, '')),
      jsonb_build_array('Waktu Undian (WIB)', private.guestbook_sheet_wib(w.drawn_at))
    ))
$$;

-- Sends the current state of p_upsert's check-ins (100 per request) and the IDs in p_delete.
create function private.guestbook_sheet_send(p_upsert uuid[], p_delete uuid[] default '{}') returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_sheet private.guestbook_sheet;
  v_rows jsonb;
begin
  select * into v_sheet from private.guestbook_sheet;
  if v_sheet.url is null then return; end if;
  for i in 0 .. coalesce(array_length(p_upsert, 1), 0) - 1 by 100 loop
    select jsonb_agg(private.guestbook_sheet_row(c, w) order by c.created_at) into v_rows
      from public.guestbook_checkins c left join public.guestbook_draw_winners w on w.checkin_id = c.id
     where c.id = any (p_upsert[i + 1 : i + 100]);
    if v_rows is not null then
      perform net.http_post(url := v_sheet.url, body := jsonb_build_object('secret', v_sheet.secret, 'rows', v_rows), timeout_milliseconds := 30000);
    end if;
  end loop;
  if coalesce(array_length(p_delete, 1), 0) > 0 then
    perform net.http_post(url := v_sheet.url, body := jsonb_build_object('secret', v_sheet.secret, 'delete', to_jsonb(p_delete)), timeout_milliseconds := 30000);
  end if;
exception when others then
  -- The check-in matters more than its copy in the sheet.
  raise warning 'guestbook sheet sync skipped: %', sqlerrm;
end
$$;

-- Every trigger names its transition table "changed": the new rows, or the old ones on delete.
create function private.guestbook_sheet_changed() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if tg_table_name = 'guestbook_draw_winners' then
    perform private.guestbook_sheet_send(array(select distinct checkin_id from changed));
  elsif tg_op = 'DELETE' then
    perform private.guestbook_sheet_send('{}', array(select id from changed));
  else
    perform private.guestbook_sheet_send(array(select id from changed));
  end if;
  return null;
end
$$;

-- Per statement, so Check out semua sends a few requests rather than one per attendee.
create trigger guestbook_sheet_checkins_insert after insert on public.guestbook_checkins
  referencing new table as changed for each statement execute function private.guestbook_sheet_changed();
create trigger guestbook_sheet_checkins_update after update on public.guestbook_checkins
  referencing new table as changed for each statement execute function private.guestbook_sheet_changed();
create trigger guestbook_sheet_checkins_delete after delete on public.guestbook_checkins
  referencing old table as changed for each statement execute function private.guestbook_sheet_changed();
create trigger guestbook_sheet_winners_insert after insert on public.guestbook_draw_winners
  referencing new table as changed for each statement execute function private.guestbook_sheet_changed();
create trigger guestbook_sheet_winners_update after update on public.guestbook_draw_winners
  referencing new table as changed for each statement execute function private.guestbook_sheet_changed();
create trigger guestbook_sheet_winners_delete after delete on public.guestbook_draw_winners
  referencing old table as changed for each statement execute function private.guestbook_sheet_changed();

-- Every check-in again, e.g. after setting up the sheet or when Google was down. Returns the count.
create function private.guestbook_sheet_resend() returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  v_ids uuid[] := array(select id from public.guestbook_checkins order by created_at);
begin
  perform private.guestbook_sheet_send(v_ids);
  return coalesce(array_length(v_ids, 1), 0);
end
$$;

revoke all on all functions in schema private from public, anon, authenticated;

commit;
