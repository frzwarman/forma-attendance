-- Laporan (the admin's event report) shows every E-Vote held, not only the vote under way: the latest poll
-- after an event is often a test or a reset, while the real result is an earlier one. guestbook_poll_history
-- returns every poll, newest first, each with how many phones voted and the count per option, as
-- guestbook_poll_results does for the latest. Admins only; ballots stay unreadable.
-- Expand only.
-- Rollback: drop function public.guestbook_poll_history().
begin;

create function public.guestbook_poll_history() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.guestbook_is_admin() then raise exception 'Hanya admin yang dapat melihat hasil E-Vote'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'poll', to_jsonb(p),
      'voters', (select count(*) from public.guestbook_ballots b where b.poll_id = p.id),
      'counts', (select jsonb_agg((select count(*) from public.guestbook_ballots b where b.poll_id = p.id and i = any (b.picks)) order by i)
                   from generate_series(0, cardinality(p.options) - 1) as i)
    ) order by p.created_at desc)
    from public.guestbook_polls p), '[]'::jsonb);
end
$$;
revoke all on function public.guestbook_poll_history() from public, anon;
grant execute on function public.guestbook_poll_history() to authenticated;

commit;
