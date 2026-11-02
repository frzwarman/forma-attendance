-- Sessions start when an admin says so: Mulai Sesi 1 / Mulai Sesi 2 on the Daftar Check-in page, not
-- at a fixed hour, since the real rundown is hard to predict. Nothing changes on its own, midnight
-- included: a session runs until an admin starts the next one, and nobody is checked out.
-- A check-in belongs to the latest session started at or before it. The sheet gets a Sesi column
-- naming that session's tab ("02-11-2026 Sesi 2": the WIB day it started and its name), and files each
-- visit there (scripts/google-sheet/Code.gs). Phones read the current session and keep a check-in only
-- while its session lasts, so attendees check in again for the next one (src/services/session.ts).
-- Expand only.
-- Rollback: re-create private.guestbook_sheet_row from 20261103000000_guestbook_sheet_sync.sql, then
-- drop function public.guestbook_start_session(text), private.guestbook_session_tab(timestamptz)
-- and table public.guestbook_sessions.
begin;

create table public.guestbook_sessions (
  started_at timestamptz primary key default now(),
  label text not null check (label in ('Sesi 1', 'Sesi 2'))
);
-- Which session is under way is no secret: the public page reads it.
alter table public.guestbook_sessions enable row level security;
revoke all on public.guestbook_sessions from anon, authenticated;
grant select on public.guestbook_sessions to anon, authenticated;
create policy "guestbook sessions public read" on public.guestbook_sessions
  for select to anon, authenticated using (true);

-- Until now every day had Sesi 1 from 00:00 and Sesi 2 from 12:00 WIB. Recorded for each day since the
-- first check-in, up to now, so earlier visits keep their tabs and today's session carries on until an
-- admin starts the next one.
insert into public.guestbook_sessions (started_at, label)
select s.at, s.label
  from generate_series(
         (coalesce((select min(created_at) from public.guestbook_checkins), now()) at time zone 'Asia/Jakarta')::date::timestamp,
         (now() at time zone 'Asia/Jakarta')::date::timestamp,
         interval '1 day'
       ) as d(day)
 cross join lateral (values
         (d.day at time zone 'Asia/Jakarta', 'Sesi 1'),
         ((d.day + interval '12 hours') at time zone 'Asia/Jakarta', 'Sesi 2')
       ) as s(at, label)
 where s.at <= now();

-- Starts p_label now and returns its start. Pressed again while that session is already today's
-- current one (a second admin, a double tap), it keeps the first start, so phones are not sent back
-- to the form twice.
create function public.guestbook_start_session(p_label text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_last public.guestbook_sessions;
  v_at timestamptz;
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat memulai sesi'; end if;
  if coalesce(p_label, '') not in ('Sesi 1', 'Sesi 2') then raise exception 'Sesi tidak dikenal'; end if;
  perform pg_advisory_xact_lock(hashtext('guestbook_session'));
  select * into v_last from public.guestbook_sessions order by started_at desc limit 1;
  if v_last.label = p_label
     and (v_last.started_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date then
    return v_last.started_at;
  end if;
  insert into public.guestbook_sessions (started_at, label) values (now(), p_label) returning started_at into v_at;
  return v_at;
end
$$;
revoke all on function public.guestbook_start_session(text) from public;
grant execute on function public.guestbook_start_session(text) to authenticated;

-- The tab of the session a check-in made at t belongs to, e.g. "02-11-2026 Sesi 2"; empty before the first.
create function private.guestbook_session_tab(t timestamptz) returns text
language sql stable set search_path = public as $$
  select coalesce((
    select to_char(s.started_at at time zone 'Asia/Jakarta', 'DD-MM-YYYY') || ' ' || s.label
      from public.guestbook_sessions s
     where s.started_at <= t
     order by s.started_at desc
     limit 1
  ), '')
$$;

-- As in 20261103000000_guestbook_sheet_sync.sql, plus Sesi: the session of the latest check-in.
create or replace function private.guestbook_sheet_row(c public.guestbook_checkins, w public.guestbook_draw_winners) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', c.id, 'cells',
    jsonb_build_array(
      jsonb_build_array('Waktu Check-in (WIB)', private.guestbook_sheet_wib(c.created_at)),
      jsonb_build_array('Sesi', private.guestbook_session_tab(coalesce(c.last_checked_in_at, c.created_at))),
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

revoke all on all functions in schema private from public, anon, authenticated;

commit;
