-- Check-out, once per event. A check-in now returns a random check-out code that the
-- attendee's phone keeps; opening the page again checks out with one tap. Admins can
-- check out (or undo) one attendee, or everyone still present at closing time.
-- Expand only: two nullable columns, a new return field on the check-in RPC (older
-- clients ignore it) and three new functions. Only a SHA-256 hash of the code is stored.
-- Rollback: drop the three functions, re-create guestbook_check_in from
-- 20261026180000_guestbook_automatic_checkin.sql, then drop the two columns (this
-- discards recorded check-out times).
begin;

alter table public.guestbook_checkins
  add column checked_out_at timestamptz,
  add column checkout_token_hash text;
alter table public.guestbook_checkins
  add constraint guestbook_checkins_checkout_after_checkin check (checked_out_at is null or checked_out_at >= created_at);
create unique index guestbook_checkins_checkout_token_idx
  on public.guestbook_checkins (checkout_token_hash) where checkout_token_hash is not null;

create or replace function public.guestbook_check_in(
  p_name text, p_phone text, p_email text, p_jabatan text, p_address text,
  p_latitude double precision, p_longitude double precision, p_file_path text,
  p_check_in_date date, p_check_out_date date, p_honeypot text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_key text := public.guestbook_phone_key(coalesce(p_phone, ''));
  v_jabatan text := nullif(btrim(coalesce(p_jabatan, '')), '');
  v_check_in date := coalesce(p_check_in_date, (now() at time zone 'Asia/Jakarta')::date);
  v_token text := gen_random_uuid()::text;
  v_created timestamptz;
begin
  if coalesce(p_honeypot, '') <> '' then raise exception 'spam'; end if;
  if p_name is null or length(btrim(p_name)) not between 2 and 120 then
    raise exception 'Nama wajib diisi (2–120 karakter)';
  end if;
  if p_phone is null or length(p_phone) > 32 or length(v_key) not between 8 and 15 then
    raise exception 'Nomor telepon tidak valid';
  end if;
  if p_email is null or length(p_email) > 160 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail tidak valid';
  end if;
  if v_jabatan is not null and length(v_jabatan) > 120 then
    raise exception 'Jabatan maksimal 120 karakter';
  end if;
  if p_address is null or length(btrim(p_address)) not between 1 and 400 then
    raise exception 'Alamat wajib diisi';
  end if;
  if p_check_out_date is not null and p_check_out_date < v_check_in then
    raise exception 'Tanggal check out tidak boleh sebelum tanggal check in';
  end if;
  if p_file_path is not null and p_file_path !~ '^checkins/[A-Za-z0-9._-]+$' then
    raise exception 'Berkas tidak valid';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Lokasi tidak valid';
  end if;
  insert into public.guestbook_checkins
    (name, phone, email, jabatan, address, latitude, longitude, file_path, check_in_date, check_out_date, checkout_token_hash)
  values
    (btrim(p_name), btrim(p_phone), btrim(p_email), v_jabatan, btrim(p_address),
     p_latitude, p_longitude, p_file_path, v_check_in, p_check_out_date,
     encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  on conflict do nothing
  returning created_at into v_created;
  if v_created is not null then
    return jsonb_build_object('status', 'created', 'created_at', v_created, 'checkout_token', v_token);
  end if;
  select created_at into v_created from public.guestbook_checkins
   where phone_key = v_key or email_key = lower(btrim(p_email))
   order by created_at limit 1;
  return jsonb_build_object('status', 'duplicate', 'created_at', v_created);
end
$$;

-- Attendee check-out with the code kept on their phone. Repeating it is harmless.
create function public.guestbook_check_out(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hash text := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  v_name text;
  v_out timestamptz;
begin
  if p_token is null or length(p_token) > 64 then raise exception 'Kode check-out tidak dikenal'; end if;
  update public.guestbook_checkins set checked_out_at = now()
   where checkout_token_hash = v_hash and checked_out_at is null
   returning name, checked_out_at into v_name, v_out;
  if v_out is not null then
    return jsonb_build_object('status', 'checked_out', 'name', v_name, 'checked_out_at', v_out);
  end if;
  select name, checked_out_at into v_name, v_out from public.guestbook_checkins where checkout_token_hash = v_hash;
  if v_name is null then raise exception 'Kode check-out tidak dikenal'; end if;
  return jsonb_build_object('status', 'already', 'name', v_name, 'checked_out_at', v_out);
end
$$;
revoke all on function public.guestbook_check_out(text) from public;
grant execute on function public.guestbook_check_out(text) to anon, authenticated;

-- Admin: check one attendee out now, or undo a check-out.
create function public.guestbook_admin_check_out(p_checkin_id uuid, p_undo boolean default false) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_out timestamptz;
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat mengubah check-out'; end if;
  update public.guestbook_checkins
     set checked_out_at = case when p_undo then null else coalesce(checked_out_at, now()) end
   where id = p_checkin_id
   returning checked_out_at into v_out;
  if not found then raise exception 'Peserta tidak ditemukan'; end if;
  return v_out;
end
$$;
revoke all on function public.guestbook_admin_check_out(uuid, boolean) from public;
grant execute on function public.guestbook_admin_check_out(uuid, boolean) to authenticated;

-- Admin: at closing time, check out everyone still present. Returns how many.
create function public.guestbook_check_out_all() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat mengubah check-out'; end if;
  update public.guestbook_checkins set checked_out_at = now() where checked_out_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;
revoke all on function public.guestbook_check_out_all() from public;
grant execute on function public.guestbook_check_out_all() to authenticated;

commit;
