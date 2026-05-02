-- Fixes "기록 저장 실패" when RLS policies exist but table privileges for `anon` are missing,
-- or when policies were scoped to roles that don't match the REST session.
-- Safe to run after 20260202120000_create_quiz_rankings.sql

grant usage on schema public to anon, authenticated;
grant select, insert on table public.quiz_rankings to anon, authenticated;
grant all on table public.quiz_rankings to service_role;

drop policy if exists "quiz_rankings_select_public" on public.quiz_rankings;
drop policy if exists "quiz_rankings_insert_public" on public.quiz_rankings;

-- No TO clause: applies to every role that hits RLS (PostgREST `anon` / `authenticated`).
create policy "quiz_rankings_select_public"
  on public.quiz_rankings
  for select
  using (true);

create policy "quiz_rankings_insert_public"
  on public.quiz_rankings
  for insert
  with check (
    char_length(nickname) between 1 and 14
    and time_ms >= 0
    and time_ms <= 86400000
  );
