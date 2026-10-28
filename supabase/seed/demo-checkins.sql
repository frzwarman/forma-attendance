-- Demo check-ins for presentations and for trying the Excel/CSV export.
-- 48 fictional attendees over roughly the last 30 hours, about half already checked
-- out, hotel room numbers for 36 of them, and three lucky-draw winners. Every demo row
-- uses an @example.com e-mail (a reserved domain no real attendee has);
-- remove-demo-checkins.sql deletes exactly those rows. Run it in the Supabase SQL editor
-- after the migrations. Running it twice adds nothing new.
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
  attendees as (
    select g, now() - make_interval(mins => (48 - g) * 37 + 5) as checked_in
    from generate_series(1, 48) as g
  )
insert into public.guestbook_checkins
  (created_at, name, phone, email, room_number, check_in_date, checked_out_at)
select
  a.checked_in,
  f.name || ' ' || l.name,
  '0812-' || lpad(a.g::text, 4, '0') || '-' || lpad(((a.g * 7919) % 10000)::text, 4, '0'),
  lower(f.name || '.' || l.name) || a.g || '@example.com',
  case when a.g % 4 <> 0 then (5 + a.g % 8)::text || lpad((1 + a.g * 7 % 30)::text, 2, '0') end,
  (a.checked_in at time zone 'Asia/Jakarta')::date,
  case
    when a.g % 2 = 0 and a.checked_in + make_interval(hours => 2 + a.g % 6) < now()
      then a.checked_in + make_interval(hours => 2 + a.g % 6)
  end
from attendees a
join first_names f on f.n = 1 + (a.g - 1) % 16
join last_names l on l.n = 1 + (a.g * 5) % 12
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
