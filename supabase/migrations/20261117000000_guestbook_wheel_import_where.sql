-- Unggah daftar peserta failed in production with "DELETE requires a WHERE clause": Supabase's API
-- sessions load safeupdate, which refuses a DELETE or UPDATE without one, inside a function too (the
-- embedded-Postgres tests have no such guard). guestbook_wheel_import now empties the list with
-- "where true"; nothing else changes.
-- Expand only.
-- Rollback: re-create public.guestbook_wheel_import(jsonb) from 20261116000000_guestbook_wheel.sql.
begin;

create or replace function public.guestbook_wheel_import(p_entries jsonb) returns integer
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
  -- The whole list goes; "where true" satisfies safeupdate.
  delete from public.guestbook_wheel_entries where true;
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

commit;
