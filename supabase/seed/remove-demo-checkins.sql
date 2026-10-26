-- Removes the demo check-ins added by demo-checkins.sql: only rows with an
-- @example.com e-mail. Their lucky-draw wins are removed with them.
delete from public.guestbook_checkins where email_key like '%@example.com';
