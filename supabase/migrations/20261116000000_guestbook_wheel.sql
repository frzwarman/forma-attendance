-- E-Vote gets a title and a subtitle, and Undian becomes a spin wheel over a list the admin uploads.
-- E-Vote: a vote carries a title and a subtitle ("Layout Ruangan Rakernas" / "Mau duduk bagaimana?"),
-- shown big on Hasil E-Vote and as the heading of the ballot on /vote; left empty, the pages read as
-- before. guestbook_save_poll takes them as two more arguments with empty defaults, so an older client's
-- call still works. Saving the same options and number of picks only sets the texts (and opens the vote
-- again), so the count under way is kept; Reset hitungan carries them to the new count.
-- Undian: the names on the wheel come from a file the admin uploads (Nama and, if wanted, Kesan &
-- Pesan), not from the check-ins. guestbook_wheel_import replaces the whole list, winners included;
-- guestbook_wheel_spin draws one of the names still on the wheel and records when and for which prize.
-- Kembalikan ke roda is a plain update by an admin clearing won_at and prize, the only two columns a
-- client may change. The draw over the check-ins (guestbook_draw_winner, guestbook_draw_winners) stays
-- for the export.
-- Expand only.
-- Rollback: drop functions public.guestbook_wheel_import(jsonb) and public.guestbook_wheel_spin(text);
-- drop table public.guestbook_wheel_entries (this discards the list and its winners); drop function
-- public.guestbook_save_poll(text[], int, text, text) and re-create guestbook_save_poll(text[], int) with
-- its grants from 20261111000000_guestbook_evote.sql and guestbook_reset_poll() from
-- 20261114000000_guestbook_evote_reset.sql; then alter table public.guestbook_polls drop column title,
-- drop column subtitle.
begin;

alter table public.guestbook_polls
  add column title text not null default '' check (length(title) <= 120),
  add column subtitle text not null default '' check (length(subtitle) <= 200);

-- Two new parameters mean a new signature: replace the function rather than add an overload, so a
-- call without the texts stays unambiguous and gets the defaults.
drop function public.guestbook_save_poll(text[], int);

-- Simpan & buka voting. Options are trimmed; blank or repeated ones (ignoring case) are refused. The
-- title and subtitle are trimmed; with the same options and number of picks as the vote under way they
-- are set on it.
create function public.guestbook_save_poll(p_options text[], p_max_picks int, p_title text default '', p_subtitle text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_options text[];
  v_title text := btrim(coalesce(p_title, ''));
  v_subtitle text := btrim(coalesce(p_subtitle, ''));
  v_poll public.guestbook_polls;
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat mengatur E-Vote'; end if;
  select coalesce(array_agg(btrim(o) order by n), '{}') into v_options from unnest(p_options) with ordinality as u(o, n);
  if cardinality(v_options) not between 2 and 20 then raise exception 'Isi 2 sampai 20 pilihan'; end if;
  if exists (select 1 from unnest(v_options) o where coalesce(o, '') = '') then raise exception 'Pilihan tidak boleh kosong'; end if;
  if exists (select 1 from unnest(v_options) o where length(o) > 120) then raise exception 'Setiap pilihan maksimal 120 karakter'; end if;
  if (select count(distinct lower(o)) from unnest(v_options) o) <> cardinality(v_options) then
    raise exception 'Pilihan tidak boleh sama';
  end if;
  if p_max_picks is null or p_max_picks not between 1 and cardinality(v_options) then
    raise exception 'Jumlah pilihan per orang harus 1 sampai %', cardinality(v_options);
  end if;
  if length(v_title) > 120 then raise exception 'Judul maksimal 120 karakter'; end if;
  if length(v_subtitle) > 200 then raise exception 'Subjudul maksimal 200 karakter'; end if;
  perform pg_advisory_xact_lock(hashtext('guestbook_poll'));
  select * into v_poll from public.guestbook_polls order by created_at desc limit 1;
  if v_poll.id is not null and v_poll.options = v_options and v_poll.max_picks = p_max_picks then
    update public.guestbook_polls set is_open = true, title = v_title, subtitle = v_subtitle where id = v_poll.id returning * into v_poll;
  else
    insert into public.guestbook_polls (options, max_picks, title, subtitle) values (v_options, p_max_picks, v_title, v_subtitle) returning * into v_poll;
  end if;
  return to_jsonb(v_poll);
end
$$;
revoke all on function public.guestbook_save_poll(text[], int, text, text) from public, anon;
grant execute on function public.guestbook_save_poll(text[], int, text, text) to authenticated;

-- As in 20261114000000_guestbook_evote_reset.sql, plus the title and subtitle carried over.
create or replace function public.guestbook_reset_poll() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_poll public.guestbook_polls;
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat mengatur E-Vote'; end if;
  perform pg_advisory_xact_lock(hashtext('guestbook_poll'));
  select * into v_poll from public.guestbook_polls order by created_at desc limit 1;
  if v_poll.id is null then raise exception 'Belum ada voting'; end if;
  insert into public.guestbook_polls (options, max_picks, is_open, title, subtitle)
  values (v_poll.options, v_poll.max_picks, v_poll.is_open, v_poll.title, v_poll.subtitle)
  returning * into v_poll;
  perform private.guestbook_sheet_reset_votes();
  return to_jsonb(v_poll);
end
$$;

-- The uploaded list in file order (position: its row number). won_at is set when the name is drawn;
-- null means it is still on the wheel.
create table public.guestbook_wheel_entries (
  id uuid primary key default gen_random_uuid(),
  position int not null,
  name text not null check (length(name) between 1 and 120),
  note text not null default '' check (length(note) <= 2000),
  prize text not null default '' check (length(prize) <= 120),
  won_at timestamptz
);
alter table public.guestbook_wheel_entries enable row level security;
revoke all on public.guestbook_wheel_entries from anon, authenticated;
grant select on public.guestbook_wheel_entries to authenticated;
-- Kembalikan ke roda: these two columns only; names, messages and the order come from the file.
grant update (won_at, prize) on public.guestbook_wheel_entries to authenticated;
create policy "guestbook wheel admin read" on public.guestbook_wheel_entries
  for select to authenticated using (public.guestbook_is_admin());
create policy "guestbook wheel admin update" on public.guestbook_wheel_entries
  for update to authenticated using (public.guestbook_is_admin()) with check (public.guestbook_is_admin());

-- Unggah daftar peserta: p_entries is the file's rows, [{"name", "note"}] (note optional), and replaces
-- the whole list, winners included. Returns how many were added.
create function public.guestbook_wheel_import(p_entries jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_entry jsonb;
  v_row integer;
  v_name text;
  v_note text;
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat mengatur undian'; end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then raise exception 'Daftar peserta tidak valid'; end if;
  if jsonb_array_length(p_entries) not between 1 and 2000 then raise exception 'Isi 1 sampai 2000 peserta'; end if;
  perform pg_advisory_xact_lock(hashtext('guestbook_wheel'));
  delete from public.guestbook_wheel_entries;
  for v_entry, v_row in select e, n from jsonb_array_elements(p_entries) with ordinality as u(e, n) loop
    v_name := btrim(coalesce(v_entry ->> 'name', ''));
    v_note := btrim(coalesce(v_entry ->> 'note', ''));
    if v_name = '' then raise exception 'Nama di baris % kosong', v_row; end if;
    if length(v_name) > 120 then raise exception 'Nama di baris % terlalu panjang (maksimal 120 karakter)', v_row; end if;
    if length(v_note) > 2000 then raise exception 'Kesan & pesan di baris % terlalu panjang (maksimal 2000 karakter)', v_row; end if;
    insert into public.guestbook_wheel_entries (position, name, note) values (v_row, v_name, v_note);
  end loop;
  return v_row;
end
$$;
revoke all on function public.guestbook_wheel_import(jsonb) from public, anon;
grant execute on function public.guestbook_wheel_import(jsonb) to authenticated;

-- Putar: one random name still on the wheel wins p_prize now. status: drawn (with the entry); empty.
create function public.guestbook_wheel_spin(p_prize text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prize text := btrim(coalesce(p_prize, ''));
  v_entry public.guestbook_wheel_entries;
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat mengatur undian'; end if;
  if length(v_prize) > 120 then raise exception 'Nama hadiah maksimal 120 karakter'; end if;
  perform pg_advisory_xact_lock(hashtext('guestbook_wheel'));
  update public.guestbook_wheel_entries set won_at = now(), prize = v_prize
   where id = (select id from public.guestbook_wheel_entries where won_at is null order by random() limit 1 for update)
  returning * into v_entry;
  if v_entry.id is null then return jsonb_build_object('status', 'empty'); end if;
  return jsonb_build_object('status', 'drawn', 'entry', to_jsonb(v_entry));
end
$$;
revoke all on function public.guestbook_wheel_spin(text) from public, anon;
grant execute on function public.guestbook_wheel_spin(text) to authenticated;

commit;
