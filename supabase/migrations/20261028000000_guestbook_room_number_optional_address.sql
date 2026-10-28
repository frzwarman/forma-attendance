-- The check-in form now asks for the attendee's hotel room number (optional) and no longer
-- asks for an address or a map pin.
-- Expand only: a nullable room_number column, address becomes nullable (existing addresses
-- are kept), and the check-in RPC gains an optional p_room_number and accepts no address.
-- Older clients that send an address and no room keep working. Newer clients that meet a
-- database without this migration retry the old way: no room, address "-".
-- Rollback: drop this guestbook_check_in signature, re-create the one from
-- 20261026200000_guestbook_checkout.sql with its grants, fill empty addresses (for example
-- with '-') and set address not null again, then drop room_number (this discards recorded
-- room numbers).
begin;

alter table public.guestbook_checkins
  add column room_number text check (room_number is null or length(room_number) <= 20);
-- The existing check (1 to 400 characters after trimming) still applies to any address given.
alter table public.guestbook_checkins alter column address drop not null;

-- A new parameter means a new signature: replace the function rather than add an overload,
-- so calls without p_room_number stay unambiguous.
drop function public.guestbook_check_in(text, text, text, text, text, double precision, double precision, text, date, date, text);

create function public.guestbook_check_in(
  p_name text, p_phone text, p_email text, p_jabatan text, p_address text,
  p_latitude double precision, p_longitude double precision, p_file_path text,
  p_check_in_date date, p_check_out_date date, p_honeypot text default null,
  p_room_number text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_key text := public.guestbook_phone_key(coalesce(p_phone, ''));
  v_jabatan text := nullif(btrim(coalesce(p_jabatan, '')), '');
  v_room text := nullif(btrim(coalesce(p_room_number, '')), '');
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
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
  if v_room is not null and length(v_room) > 20 then
    raise exception 'Nomor kamar maksimal 20 karakter';
  end if;
  if v_address is not null and length(v_address) > 400 then
    raise exception 'Alamat maksimal 400 karakter';
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
    (name, phone, email, jabatan, room_number, address, latitude, longitude, file_path, check_in_date, check_out_date, checkout_token_hash)
  values
    (btrim(p_name), btrim(p_phone), btrim(p_email), v_jabatan, v_room, v_address,
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
revoke all on function public.guestbook_check_in(text, text, text, text, text, double precision, double precision, text, date, date, text, text) from public;
grant execute on function public.guestbook_check_in(text, text, text, text, text, double precision, double precision, text, date, date, text, text) to anon, authenticated;

commit;
