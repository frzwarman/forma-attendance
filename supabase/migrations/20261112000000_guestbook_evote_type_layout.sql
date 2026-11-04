-- TYPE LAYOUT moves to E-Vote. Before E-Vote, attendees chose the seating layout in the registration
-- form's TYPE LAYOUT question (CLASS ROOM or ROUNDTABLE). Each attendee's answer (the latest; one per
-- person, unlike the sheet's row per visit) becomes their ballot in the vote under way, when that vote
-- offers Round table and Classroom table as on 04-11-2026: ROUNDTABLE -> Round table, CLASS ROOM ->
-- Classroom table. A ballot's ID is the MD5 of 'form:' and the check-in's ID, so applying this again adds
-- nobody twice; a vote with other options gets nothing. Someone who answered on the form and also voted
-- on /vote counts twice (ballots from phones are anonymous); remove TYPE LAYOUT from Formulir so new
-- attendees vote on /vote only. The answers stay in the check-ins.
-- Expand only.
-- Rollback: delete from public.guestbook_ballots b using public.guestbook_checkins c
--   where b.device_id = md5('form:' || c.id::text);
begin;

insert into public.guestbook_ballots (poll_id, device_id, picks)
select p.id, md5('form:' || c.id::text), array[array_position(p.options, m.option) - 1]
  from (select id, options from public.guestbook_polls order by created_at desc limit 1) p
 cross join public.guestbook_checkins c
  join (values ('CLASS ROOM', 'Classroom table'), ('ROUNDTABLE', 'Round table')) as m(answer, option)
    on upper(btrim(c.answers ->> 'TYPE LAYOUT')) = m.answer
 where m.option = any (p.options)
on conflict (poll_id, device_id) do nothing;

commit;
