-- The admin's Info acara tab now saves what attendees see after check-in: the Mentimeter link,
-- the rundown and speaker CVs (as page images) and the PDF materials.
-- Expand only: a nullable event_content column on the settings row (null: the page shows the
-- rundown and CVs built into the site) and a public guestbook-event bucket that only admins
-- write. The settings row's existing policies already let anyone read it and admins update it.
-- Rollback: drop the four guestbook event policies, delete the guestbook-event objects and
-- bucket, then drop event_content (this discards the saved event information).
begin;

alter table public.guestbook_settings
  add column event_content jsonb
  check (event_content is null or (jsonb_typeof(event_content) = 'object' and octet_length(event_content::text) <= 200000));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('guestbook-event', 'guestbook-event', true, 20971520, array['image/jpeg', 'application/pdf'])
on conflict (id) do nothing;
create policy "guestbook event public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'guestbook-event');
create policy "guestbook event admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'guestbook-event' and public.guestbook_is_admin());
create policy "guestbook event admin update" on storage.objects
  for update to authenticated using (bucket_id = 'guestbook-event' and public.guestbook_is_admin())
  with check (bucket_id = 'guestbook-event' and public.guestbook_is_admin());
create policy "guestbook event admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'guestbook-event' and public.guestbook_is_admin());

commit;
