-- Kesan & Pesan: messages from checked-in attendees, sent from the checked-in page with the check-out
-- code their phone holds, so each message is stored under the sender's check-in (name, phone, e-mail,
-- Divisi) without the page sending those details. Only admins read them; attendees add theirs through
-- guestbook_send_feedback. Each new message is copied to the Google Sheet's "Kesan & Pesan" tab
-- (scripts/google-sheet/Code.gs), and private.guestbook_sheet_resend() now sends the messages too.
-- Expand only.
-- Rollback: drop trigger guestbook_sheet_feedback_insert on guestbook_feedback; drop functions
-- public.guestbook_send_feedback(text, text), private.guestbook_sheet_feedback_added() and
-- private.guestbook_sheet_send_feedback(uuid[]); re-create private.guestbook_sheet_resend() from
-- 20261103000000_guestbook_sheet_sync.sql; then drop table guestbook_feedback (this discards the messages).
begin;

create table public.guestbook_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  checkin_id uuid not null references public.guestbook_checkins(id) on delete cascade,
  message text not null check (length(btrim(message)) between 1 and 2000)
);
create index guestbook_feedback_checkin_idx on public.guestbook_feedback (checkin_id);

alter table public.guestbook_feedback enable row level security;
revoke all on public.guestbook_feedback from anon, authenticated;
grant select on public.guestbook_feedback to authenticated;
create policy "guestbook feedback admin read" on public.guestbook_feedback
  for select to authenticated using (public.guestbook_is_admin());

-- The attendee's only way in. The check-out code identifies the sender; at most 50 messages each,
-- so one code cannot flood the table or the sheet.
create function public.guestbook_send_feedback(p_token text, p_message text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_checkin uuid;
  v_message text := btrim(coalesce(p_message, ''));
  v_created timestamptz;
begin
  if p_token is null or length(p_token) > 64 then raise exception 'Kode check-in tidak dikenal'; end if;
  select id into v_checkin from public.guestbook_checkins
   where checkout_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if v_checkin is null then raise exception 'Kode check-in tidak dikenal'; end if;
  if length(v_message) not between 1 and 2000 then
    raise exception 'Kesan & pesan wajib diisi (maksimal 2000 karakter)';
  end if;
  if (select count(*) from public.guestbook_feedback where checkin_id = v_checkin) >= 50 then
    raise exception 'Batas kesan & pesan sudah tercapai';
  end if;
  insert into public.guestbook_feedback (checkin_id, message) values (v_checkin, v_message)
  returning created_at into v_created;
  return jsonb_build_object('status', 'sent', 'created_at', v_created);
end
$$;
revoke all on function public.guestbook_send_feedback(text, text) from public;
grant execute on function public.guestbook_send_feedback(text, text) to anon, authenticated;

-- Sends p_ids' messages (100 per request) with the sender's details as they are now. The check-in's
-- ID goes along, so deleting the check-in removes its messages from the sheet too.
create function private.guestbook_sheet_send_feedback(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  v_sheet private.guestbook_sheet;
  v_rows jsonb;
begin
  select * into v_sheet from private.guestbook_sheet;
  if v_sheet.url is null then return; end if;
  for i in 0 .. coalesce(array_length(p_ids, 1), 0) - 1 by 100 loop
    select jsonb_agg(jsonb_build_object('id', f.id, 'cells', jsonb_build_array(
             jsonb_build_array('Waktu (WIB)', private.guestbook_sheet_wib(f.created_at)),
             jsonb_build_array('Nama', c.name),
             jsonb_build_array('Nomor Telepon', c.phone),
             jsonb_build_array('E-mail', c.email),
             jsonb_build_array('Divisi', coalesce(c.divisi, '')),
             jsonb_build_array('Kesan & Pesan', f.message),
             jsonb_build_array('ID', c.id)
           )) order by f.created_at) into v_rows
      from public.guestbook_feedback f join public.guestbook_checkins c on c.id = f.checkin_id
     where f.id = any (p_ids[i + 1 : i + 100]);
    if v_rows is not null then
      perform net.http_post(url := v_sheet.url, body := jsonb_build_object('secret', v_sheet.secret, 'feedback', v_rows), timeout_milliseconds := 30000);
    end if;
  end loop;
exception when others then
  -- The message matters more than its copy in the sheet.
  raise warning 'guestbook sheet sync skipped: %', sqlerrm;
end
$$;

create function private.guestbook_sheet_feedback_added() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.guestbook_sheet_send_feedback(array(select id from changed));
  return null;
end
$$;
create trigger guestbook_sheet_feedback_insert after insert on public.guestbook_feedback
  referencing new table as changed for each statement execute function private.guestbook_sheet_feedback_added();

-- Every check-in and every message again. Returns the number of check-ins.
create or replace function private.guestbook_sheet_resend() returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  v_ids uuid[] := array(select id from public.guestbook_checkins order by created_at);
begin
  perform private.guestbook_sheet_send(v_ids);
  perform private.guestbook_sheet_send_feedback(array(select id from public.guestbook_feedback order by created_at));
  return coalesce(array_length(v_ids, 1), 0);
end
$$;

revoke all on all functions in schema private from public, anon, authenticated;

commit;
