-- Hapus on Undian's participant list: an admin takes one name off the list (and so off the wheel) without
-- uploading the file again, e.g. someone who left. A delete by an admin, like the put-back update; nobody
-- else may delete, and names are still never edited in place.
-- Expand only.
-- Rollback: drop policy "guestbook wheel admin delete" on public.guestbook_wheel_entries; revoke delete on
-- public.guestbook_wheel_entries from authenticated.
begin;

grant delete on public.guestbook_wheel_entries to authenticated;
create policy "guestbook wheel admin delete" on public.guestbook_wheel_entries
  for delete to authenticated using (public.guestbook_is_admin());

commit;
