-- Ubah on Undian's participant list: an admin corrects a name or a Kesan & Pesan after the upload (a typo in
-- the file, a message to shorten) without uploading again. Two more columns a client may update; the order
-- (position) still comes from the file only. The table's checks keep a name 1 to 120 characters and a note
-- at most 2000.
-- Expand only.
-- Rollback: revoke update (name, note) on public.guestbook_wheel_entries from authenticated.
begin;

grant update (name, note) on public.guestbook_wheel_entries to authenticated;

commit;
