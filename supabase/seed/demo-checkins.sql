-- Demo check-ins for presentations and for trying the Excel/CSV export.
-- 48 fictional attendees over roughly the last 30 hours, about half already checked
-- out, and three lucky-draw winners. Every demo row uses an @example.com e-mail
-- (a reserved domain no real attendee has); remove-demo-checkins.sql deletes exactly
-- those rows. Run it in the Supabase SQL editor. Running it twice adds nothing new.
begin;

with
  first_names(n, name) as (
    select ordinality, name
    from unnest(array[
      'Budi', 'Siti', 'Agus', 'Dewi', 'Rudi', 'Nina', 'Hendra', 'Wulan',
      'Joko', 'Ratna', 'Fajar', 'Intan', 'Bayu', 'Lestari', 'Dimas', 'Putri'
    ]) with ordinality as t(name, ordinality)
  ),
  last_names(n, name) as (
    select ordinality, name
    from unnest(array[
      'Santoso', 'Rahmawati', 'Wijaya', 'Kusuma', 'Hartono', 'Pratiwi',
      'Saputra', 'Nugroho', 'Wibowo', 'Siregar', 'Hasibuan', 'Simanjuntak'
    ]) with ordinality as t(name, ordinality)
  ),
  places(n, street, city, latitude, longitude) as (
    values
      (1, 'Jl. M.H. Thamrin', 'Jakarta Pusat', -6.1862, 106.8230),
      (2, 'Jl. Jenderal Sudirman', 'Jakarta Selatan', -6.2250, 106.8020),
      (3, 'Jl. Asia Afrika', 'Bandung', -6.9218, 107.6070),
      (4, 'Jl. Tunjungan', 'Surabaya', -7.2575, 112.7381),
      (5, 'Jl. Gatot Subroto', 'Medan', 3.5897, 98.6622),
      (6, 'Jl. Jenderal Ahmad Yani', 'Makassar', -5.1351, 119.4238),
      (7, 'Jl. Malioboro', 'Yogyakarta', -7.7926, 110.3658),
      (8, 'Jl. Teuku Umar', 'Denpasar', -8.6788, 115.2100)
  ),
  attendees as (
    select g, now() - make_interval(mins => (48 - g) * 37 + 5) as checked_in
    from generate_series(1, 48) as g
  )
insert into public.guestbook_checkins
  (created_at, name, phone, email, address, latitude, longitude, check_in_date, checked_out_at)
select
  a.checked_in,
  f.name || ' ' || l.name,
  '0812-' || lpad(a.g::text, 4, '0') || '-' || lpad(((a.g * 7919) % 10000)::text, 4, '0'),
  lower(f.name || '.' || l.name) || a.g || '@example.com',
  p.street || ' No. ' || (a.g * 3 % 120 + 1) || ', ' || p.city,
  p.latitude + ((a.g % 7) - 3) * 0.004,
  p.longitude + ((a.g % 5) - 2) * 0.004,
  (a.checked_in at time zone 'Asia/Jakarta')::date,
  case
    when a.g % 2 = 0 and a.checked_in + make_interval(hours => 2 + a.g % 6) < now()
      then a.checked_in + make_interval(hours => 2 + a.g % 6)
  end
from attendees a
join first_names f on f.n = 1 + (a.g - 1) % 16
join last_names l on l.n = 1 + (a.g * 5) % 12
join places p on p.n = 1 + (a.g * 3) % 8
on conflict do nothing;

insert into public.guestbook_draw_winners (checkin_id, prize, drawn_at)
select c.id, p.prize, now() - make_interval(mins => 20 * p.n)
from (
  select id, row_number() over (order by email_key) as rn
  from public.guestbook_checkins
  where email_key like '%@example.com'
) c
join (
  values (1, 'Hadiah 1: Smartphone'), (2, 'Hadiah 2: Jam tangan pintar'), (3, 'Hadiah 3: Voucher belanja')
) as p(n, prize) on p.n = c.rn
on conflict do nothing;

commit;
