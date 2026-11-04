-- E-Vote: one vote at a time. An admin sets its options and how many each person may pick (E-Vote page)
-- and watches the count (Hasil E-Vote); attendees vote anonymously from the public /vote page, once per
-- phone. The latest poll is the vote under way. Saving the same options, in the same order, with the
-- same number of picks carries it on (and opens it again after Tutup voting); anything else starts a new
-- poll, counted from zero, so every phone can vote again. Earlier polls and their ballots stay.
-- A phone is known by a random ID it keeps (src/services/evote.ts): someone could vote again from a
-- private window, which is accepted for event polls like the seating layout.
-- Expand only.
-- Rollback: drop functions public.guestbook_save_poll(text[], int), public.guestbook_close_poll(),
-- public.guestbook_cast_ballot(uuid, text, int[]) and public.guestbook_poll_results(); then drop tables
-- public.guestbook_ballots and public.guestbook_polls (this discards the votes).
begin;

create table public.guestbook_polls (
  id uuid primary key default gen_random_uuid(),
  -- clock_timestamp: saves are serialised by a lock, so a later save always sorts later.
  created_at timestamptz not null default clock_timestamp(),
  options text[] not null check (cardinality(options) between 2 and 20),
  max_picks int not null check (max_picks between 1 and cardinality(options)),
  is_open boolean not null default true
);
-- The vote's options are no secret: the public page reads them.
alter table public.guestbook_polls enable row level security;
revoke all on public.guestbook_polls from anon, authenticated;
grant select on public.guestbook_polls to anon, authenticated;
create policy "guestbook polls public read" on public.guestbook_polls
  for select to anon, authenticated using (true);

-- One per phone and poll. picks: option positions (0-based), in the admin's order. Nobody reads ballots
-- directly; admins see the count through guestbook_poll_results.
create table public.guestbook_ballots (
  poll_id uuid not null references public.guestbook_polls (id) on delete cascade,
  device_id text not null check (device_id ~ '^[0-9a-f]{32}$'),
  picks int[] not null check (cardinality(picks) >= 1),
  created_at timestamptz not null default now(),
  primary key (poll_id, device_id)
);
alter table public.guestbook_ballots enable row level security;
revoke all on public.guestbook_ballots from anon, authenticated;

-- Simpan & buka voting. Options are trimmed; blank or repeated ones (ignoring case) are refused.
create function public.guestbook_save_poll(p_options text[], p_max_picks int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_options text[];
  v_poll public.guestbook_polls;
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat mengatur E-Vote'; end if;
  select coalesce(array_agg(btrim(o) order by n), '{}') into v_options from unnest(p_options) with ordinality as u(o, n);
  if cardinality(v_options) not between 2 and 20 then raise exception 'Isi 2 sampai 20 pilihan'; end if;
  if exists (select 1 from unnest(v_options) o where coalesce(o, '') = '') then raise exception 'Pilihan tidak boleh kosong'; end if;
  if exists (select 1 from unnest(v_options) o where length(o) > 120) then raise exception 'Setiap pilihan maksimal 120 karakter'; end if;
  if (select count(distinct lower(o)) from unnest(v_options) o) <> cardinality(v_options) then
    raise exception 'Pilihan tidak boleh sama';
  end if;
  if p_max_picks is null or p_max_picks not between 1 and cardinality(v_options) then
    raise exception 'Jumlah pilihan per orang harus 1 sampai %', cardinality(v_options);
  end if;
  perform pg_advisory_xact_lock(hashtext('guestbook_poll'));
  select * into v_poll from public.guestbook_polls order by created_at desc limit 1;
  if v_poll.id is not null and v_poll.options = v_options and v_poll.max_picks = p_max_picks then
    update public.guestbook_polls set is_open = true where id = v_poll.id returning * into v_poll;
  else
    insert into public.guestbook_polls (options, max_picks) values (v_options, p_max_picks) returning * into v_poll;
  end if;
  return to_jsonb(v_poll);
end
$$;
revoke all on function public.guestbook_save_poll(text[], int) from public, anon;
grant execute on function public.guestbook_save_poll(text[], int) to authenticated;

-- Tutup voting: the vote under way takes no more ballots. Null before the first vote.
create function public.guestbook_close_poll() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_poll public.guestbook_polls;
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat mengatur E-Vote'; end if;
  perform pg_advisory_xact_lock(hashtext('guestbook_poll'));
  update public.guestbook_polls set is_open = false
   where id = (select id from public.guestbook_polls order by created_at desc limit 1)
  returning * into v_poll;
  return case when v_poll.id is null then null else to_jsonb(v_poll) end;
end
$$;
revoke all on function public.guestbook_close_poll() from public, anon;
grant execute on function public.guestbook_close_poll() to authenticated;

-- The attendee's only way in. status: recorded; already (this phone voted in this poll: its first
-- picks); closed; changed (p_poll_id is not the vote under way: the page loads the current one).
create function public.guestbook_cast_ballot(p_poll_id uuid, p_device_id text, p_picks int[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_poll public.guestbook_polls;
  v_picks int[];
  v_stored int[];
begin
  if p_device_id is null or p_device_id !~ '^[0-9a-f]{32}$' then raise exception 'Perangkat tidak dikenal'; end if;
  -- FOR SHARE: a Tutup voting pressed meanwhile waits for this ballot, so none slips in after it.
  select * into v_poll from public.guestbook_polls order by created_at desc limit 1 for share;
  if v_poll.id is null or v_poll.id is distinct from p_poll_id then return jsonb_build_object('status', 'changed'); end if;
  select picks into v_stored from public.guestbook_ballots where poll_id = v_poll.id and device_id = p_device_id;
  if v_stored is not null then return jsonb_build_object('status', 'already', 'picks', to_jsonb(v_stored)); end if;
  if not v_poll.is_open then return jsonb_build_object('status', 'closed'); end if;
  if p_picks is null
     or cardinality(p_picks) not between 1 and v_poll.max_picks
     or exists (select 1 from unnest(p_picks) p where p is null or p < 0 or p >= cardinality(v_poll.options))
     or (select count(distinct p) from unnest(p_picks) p) <> cardinality(p_picks) then
    raise exception 'Pilihan tidak valid';
  end if;
  select array_agg(p order by p) into v_picks from unnest(p_picks) p;
  insert into public.guestbook_ballots (poll_id, device_id, picks) values (v_poll.id, p_device_id, v_picks)
  on conflict (poll_id, device_id) do nothing;
  if not found then
    -- The same phone sending twice at once (a double tap): the first ballot counts.
    select picks into v_stored from public.guestbook_ballots where poll_id = v_poll.id and device_id = p_device_id;
    return jsonb_build_object('status', 'already', 'picks', to_jsonb(v_stored));
  end if;
  return jsonb_build_object('status', 'recorded', 'picks', to_jsonb(v_picks));
end
$$;
revoke all on function public.guestbook_cast_ballot(uuid, text, int[]) from public;
grant execute on function public.guestbook_cast_ballot(uuid, text, int[]) to anon, authenticated;

-- Hasil E-Vote: the vote under way, how many phones voted, and per option (in order) how many picked it.
create function public.guestbook_poll_results() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_poll public.guestbook_polls;
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat melihat hasil E-Vote'; end if;
  select * into v_poll from public.guestbook_polls order by created_at desc limit 1;
  if v_poll.id is null then return jsonb_build_object('poll', null, 'voters', 0, 'counts', '[]'::jsonb); end if;
  return jsonb_build_object(
    'poll', to_jsonb(v_poll),
    'voters', (select count(*) from public.guestbook_ballots where poll_id = v_poll.id),
    'counts', (select jsonb_agg((select count(*) from public.guestbook_ballots b where b.poll_id = v_poll.id and i = any (b.picks)) order by i)
                 from generate_series(0, cardinality(v_poll.options) - 1) as i));
end
$$;
revoke all on function public.guestbook_poll_results() from public, anon;
grant execute on function public.guestbook_poll_results() to authenticated;

commit;
