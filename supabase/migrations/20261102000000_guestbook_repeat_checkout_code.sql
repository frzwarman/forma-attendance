-- Attendees check out again: a repeat check-in (next session) now also gets a check-out code, so the
-- phone can check that visit out. The code replaces the person's earlier one, and comes back only
-- when the name typed matches the stored one (check-out answers with the name).
-- Same signature as 20261101000000_guestbook_repeat_checkin.sql, so the grants stay; older clients
-- ignore or keep the code as before.
-- Rollback: re-create guestbook_check_in from 20261101000000_guestbook_repeat_checkin.sql.
begin;

create or replace function public.guestbook_check_in(
  p_name text, p_phone text, p_email text, p_jabatan text, p_address text,
  p_latitude double precision, p_longitude double precision, p_file_path text,
  p_check_in_date date, p_check_out_date date, p_honeypot text default null,
  p_room_number text default null, p_divisi text default null, p_answers jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_key text := public.guestbook_phone_key(coalesce(p_phone, ''));
  v_jabatan text := nullif(btrim(coalesce(p_jabatan, '')), '');
  v_room text := nullif(btrim(coalesce(p_room_number, '')), '');
  v_divisi text := nullif(btrim(coalesce(p_divisi, '')), '');
  v_answers jsonb := nullif(p_answers, '{}'::jsonb);
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
  v_check_in date := coalesce(p_check_in_date, (now() at time zone 'Asia/Jakarta')::date);
  v_token text := gen_random_uuid()::text;
  v_created timestamptz;
  v_last timestamptz;
  v_same boolean;
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
  if v_divisi is not null and length(v_divisi) > 120 then
    raise exception 'Divisi maksimal 120 karakter';
  end if;
  -- Answers to the admin's own questions: label -> text, small enough for one row.
  if v_answers is not null and jsonb_typeof(v_answers) <> 'object' then
    raise exception 'Jawaban tidak valid';
  end if;
  -- Separate from the type check: SQL does not promise to skip jsonb_each for a non-object.
  if v_answers is not null and (
       octet_length(v_answers::text) > 10000
       or (select count(*) from jsonb_object_keys(v_answers)) > 30
       or exists (select 1 from jsonb_each(v_answers) e
                   where length(e.key) not between 1 and 120 or jsonb_typeof(e.value) <> 'string' or length(e.value #>> '{}') > 1000)
     ) then
    raise exception 'Jawaban tidak valid';
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
    (name, phone, email, jabatan, divisi, room_number, answers, address, latitude, longitude, file_path, check_in_date, check_out_date, checkout_token_hash)
  values
    (btrim(p_name), btrim(p_phone), btrim(p_email), v_jabatan, v_divisi, v_room, v_answers, v_address,
     p_latitude, p_longitude, p_file_path, v_check_in, p_check_out_date,
     encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  on conflict do nothing
  returning created_at into v_created;
  if v_created is not null then
    return jsonb_build_object('status', 'created', 'created_at', v_created, 'checkout_token', v_token);
  end if;
  -- Already registered: record the visit on the earliest matching row. The stored details stay as
  -- they are (anyone can type someone's phone number); only answers missing so far are filled in.
  -- Back at the event, the person is no longer checked out. A new check-out code for this visit
  -- replaces the earlier one, but only when the name typed is the stored one: check-out answers
  -- with the name, which a stranger typing someone's number must not learn.
  update public.guestbook_checkins
     set last_checked_in_at = now(), checkin_count = checkin_count + 1, checked_out_at = null,
         divisi = coalesce(divisi, v_divisi), room_number = coalesce(room_number, v_room),
         answers = coalesce(answers, v_answers), file_path = coalesce(file_path, p_file_path),
         checkout_token_hash = case when lower(name) = lower(btrim(p_name))
                                    then encode(sha256(convert_to(v_token, 'UTF8')), 'hex') else checkout_token_hash end
   where id = (select id from public.guestbook_checkins
                where phone_key = v_key or email_key = lower(btrim(p_email))
                order by created_at limit 1)
  returning lower(name) = lower(btrim(p_name)), created_at, last_checked_in_at into v_same, v_created, v_last;
  return jsonb_build_object('status', 'returning', 'created_at', v_created, 'last_checked_in_at', v_last)
         || case when v_same then jsonb_build_object('checkout_token', v_token) else '{}'::jsonb end;
end
$$;

commit;
