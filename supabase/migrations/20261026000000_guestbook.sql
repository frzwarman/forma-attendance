-- Additive guest book schema for the single-event check-in site.
-- Leaves every forma_ table untouched. Prefix: guestbook_.
begin;

create table public.guestbook_settings (
  id smallint primary key default 1 check (id = 1),
  event_name text not null default 'Buku Tamu' check (length(btrim(event_name)) between 1 and 120),
  welcome_text text not null default 'Silakan isi data diri Anda untuk check-in.' check (length(welcome_text) <= 600),
  logo_path text check (logo_path is null or length(logo_path) <= 200),
  background_path text check (background_path is null or length(background_path) <= 200),
  accent_color text not null default '#ec1c24' check (accent_color ~* '^#[0-9a-f]{6}$'),
  background_color text not null default '#00243f' check (background_color ~* '^#[0-9a-f]{6}$'),
  surface_color text not null default '#ffffff' check (surface_color ~* '^#[0-9a-f]{6}$'),
  text_color text not null default '#1e1e1e' check (text_color ~* '^#[0-9a-f]{6}$'),
  whatsapp_number text check (whatsapp_number is null or length(whatsapp_number) <= 32),
  updated_at timestamptz not null default now()
);
insert into public.guestbook_settings (id) values (1);

-- Digits only; a leading country code 62 becomes the local 0 prefix.
create function public.guestbook_phone_key(input text) returns text
language sql immutable strict as $$
  select case when d ~ '^62' and length(d) > 8 then '0' || substr(d, 3) else d end
  from (select regexp_replace(input, '\D', '', 'g') as d) s
$$;

create table public.guestbook_checkins (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(btrim(name)) between 2 and 120),
  phone text not null check (length(phone) <= 32),
  phone_key text generated always as (public.guestbook_phone_key(phone)) stored,
  email text not null check (length(email) <= 160 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  email_key text generated always as (lower(btrim(email))) stored,
  jabatan text not null check (length(btrim(jabatan)) between 1 and 120),
  address text not null check (length(btrim(address)) between 1 and 400),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  file_path text check (file_path is null or file_path ~ '^checkins/[A-Za-z0-9._-]+$'),
  check_in_date date not null,
  check_out_date date not null,
  constraint guestbook_checkins_phone_key_length check (length(phone_key) between 8 and 15),
  constraint guestbook_checkins_dates check (check_out_date >= check_in_date)
);
create unique index guestbook_checkins_phone_key_idx on public.guestbook_checkins (phone_key);
create unique index guestbook_checkins_email_key_idx on public.guestbook_checkins (email_key);
create index guestbook_checkins_created_at_idx on public.guestbook_checkins (created_at desc);

create table public.guestbook_draw_winners (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null unique references public.guestbook_checkins(id) on delete cascade,
  prize text not null default '' check (length(prize) <= 120),
  drawn_at timestamptz not null default now(),
  drawn_by uuid
);

-- Admins are provisioned by the owner in the Supabase dashboard, never from the client.
create table public.guestbook_admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.guestbook_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.guestbook_admins where auth_user_id = auth.uid())
$$;
revoke all on function public.guestbook_is_admin() from public;
grant execute on function public.guestbook_is_admin() to anon, authenticated;

-- The only write path for attendees. Validates, inserts, and reports duplicates
-- without exposing anything beyond the earlier check-in time.
create function public.guestbook_check_in(
  p_name text, p_phone text, p_email text, p_jabatan text, p_address text,
  p_latitude double precision, p_longitude double precision, p_file_path text,
  p_check_in_date date, p_check_out_date date, p_honeypot text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_key text := public.guestbook_phone_key(coalesce(p_phone, ''));
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
  if p_jabatan is null or length(btrim(p_jabatan)) not between 1 and 120 then
    raise exception 'Jabatan wajib diisi';
  end if;
  if p_address is null or length(btrim(p_address)) not between 1 and 400 then
    raise exception 'Alamat wajib diisi';
  end if;
  if p_check_in_date is null or p_check_out_date is null or p_check_out_date < p_check_in_date then
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
    (btrim(p_name), btrim(p_phone), btrim(p_email), btrim(p_jabatan), btrim(p_address),
     p_latitude, p_longitude, p_file_path, p_check_in_date, p_check_out_date)
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
revoke all on function public.guestbook_check_in(text, text, text, text, text, double precision, double precision, text, date, date, text) from public;
grant execute on function public.guestbook_check_in(text, text, text, text, text, double precision, double precision, text, date, date, text) to anon, authenticated;

-- Atomic lucky draw: one random attendee who has not won yet.
create function public.guestbook_draw_winner(p_prize text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_checkin public.guestbook_checkins%rowtype;
  v_winner public.guestbook_draw_winners%rowtype;
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat mengundi'; end if;
  perform pg_advisory_xact_lock(hashtext('guestbook_draw'));
  select c.* into v_checkin from public.guestbook_checkins c
   where not exists (select 1 from public.guestbook_draw_winners w where w.checkin_id = c.id)
   order by random() limit 1;
  if v_checkin.id is null then return jsonb_build_object('status', 'empty'); end if;
  insert into public.guestbook_draw_winners (checkin_id, prize, drawn_by)
  values (v_checkin.id, coalesce(left(p_prize, 120), ''), auth.uid())
  returning * into v_winner;
  return jsonb_build_object(
    'status', 'drawn',
    'winner', jsonb_build_object('id', v_winner.id, 'checkin_id', v_winner.checkin_id, 'prize', v_winner.prize, 'drawn_at', v_winner.drawn_at),
    'checkin', jsonb_build_object('id', v_checkin.id, 'name', v_checkin.name, 'jabatan', v_checkin.jabatan, 'phone', v_checkin.phone, 'email', v_checkin.email)
  );
end
$$;
revoke all on function public.guestbook_draw_winner(text) from public;
grant execute on function public.guestbook_draw_winner(text) to authenticated;

alter table public.guestbook_settings enable row level security;
alter table public.guestbook_checkins enable row level security;
alter table public.guestbook_draw_winners enable row level security;
alter table public.guestbook_admins enable row level security;
revoke all on public.guestbook_settings, public.guestbook_checkins, public.guestbook_draw_winners, public.guestbook_admins from anon, authenticated;
grant select on public.guestbook_settings to anon, authenticated;
grant update on public.guestbook_settings to authenticated;
grant select, delete on public.guestbook_checkins to authenticated;
grant select, delete on public.guestbook_draw_winners to authenticated;

create policy "guestbook settings are public" on public.guestbook_settings
  for select to anon, authenticated using (true);
create policy "guestbook settings admin update" on public.guestbook_settings
  for update to authenticated using (public.guestbook_is_admin()) with check (public.guestbook_is_admin());
create policy "guestbook checkins admin read" on public.guestbook_checkins
  for select to authenticated using (public.guestbook_is_admin());
create policy "guestbook checkins admin delete" on public.guestbook_checkins
  for delete to authenticated using (public.guestbook_is_admin());
create policy "guestbook winners admin read" on public.guestbook_draw_winners
  for select to authenticated using (public.guestbook_is_admin());
create policy "guestbook winners admin delete" on public.guestbook_draw_winners
  for delete to authenticated using (public.guestbook_is_admin());

-- Storage: public brand assets, private attendee uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('guestbook-brand', 'guestbook-brand', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('guestbook-uploads', 'guestbook-uploads', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy "guestbook brand public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'guestbook-brand');
create policy "guestbook brand admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'guestbook-brand' and public.guestbook_is_admin());
create policy "guestbook brand admin update" on storage.objects
  for update to authenticated using (bucket_id = 'guestbook-brand' and public.guestbook_is_admin())
  with check (bucket_id = 'guestbook-brand' and public.guestbook_is_admin());
create policy "guestbook brand admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'guestbook-brand' and public.guestbook_is_admin());
create policy "guestbook uploads anonymous insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'guestbook-uploads' and (storage.foldername(name))[1] = 'checkins');
create policy "guestbook uploads admin read" on storage.objects
  for select to authenticated using (bucket_id = 'guestbook-uploads' and public.guestbook_is_admin());

commit;
