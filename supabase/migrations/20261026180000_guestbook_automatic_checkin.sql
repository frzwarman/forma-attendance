-- The form no longer asks for visit dates: the check-in moment is the server's
-- created_at, and check-in rows get today's Jakarta date when no date is sent.
-- Expand only: check_out_date becomes optional (filled when check-out is designed),
-- existing values are kept, and the RPC keeps its signature so a client that still
-- sends dates keeps working. Rollback, only while every row has a check-out date:
--   alter table public.guestbook_checkins alter column check_out_date set not null;
--   alter table public.guestbook_checkins alter column check_in_date drop default;
--   then re-create guestbook_check_in from 20261026120000_guestbook_optional_jabatan.sql.
begin;

alter table public.guestbook_checkins
  alter column check_in_date set default ((now() at time zone 'Asia/Jakarta')::date);
alter table public.guestbook_checkins alter column check_out_date drop not null;

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
    (name, phone, email, jabatan, address, latitude, longitude, file_path, check_in_date, check_out_date)
  values
    (btrim(p_name), btrim(p_phone), btrim(p_email), v_jabatan, btrim(p_address),
     p_latitude, p_longitude, p_file_path, v_check_in, p_check_out_date)
  on conflict do nothing
  returning created_at into v_created;
  if v_created is not null then
    return jsonb_build_object('status', 'created', 'created_at', v_created);
  end if;
  select created_at into v_created from public.guestbook_checkins
   where phone_key = v_key or email_key = lower(btrim(p_email))
   order by created_at limit 1;
  return jsonb_build_object('status', 'duplicate', 'created_at', v_created);
end
$$;

commit;
