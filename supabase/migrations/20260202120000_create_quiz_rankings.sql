-- Quiz hall of fame: server-side rankings + Realtime.
-- Run in Supabase SQL Editor or via `supabase db push` if you use the CLI.

create table if not exists public.quiz_rankings (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  time_ms integer not null,
  created_at timestamptz not null default now(),
  constraint quiz_rankings_nickname_len check (char_length(nickname) between 1 and 14),
  constraint quiz_rankings_time_ms_nonneg check (time_ms >= 0),
  constraint quiz_rankings_time_ms_sane check (time_ms <= 86400000)
);

create index if not exists quiz_rankings_time_ms_created_at_idx
  on public.quiz_rankings (time_ms asc, created_at asc);

alter table public.quiz_rankings enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert on table public.quiz_rankings to anon, authenticated;
grant all on table public.quiz_rankings to service_role;

drop policy if exists "quiz_rankings_select_public" on public.quiz_rankings;
drop policy if exists "quiz_rankings_insert_public" on public.quiz_rankings;

-- Omit TO so PostgREST sessions (`anon` / `authenticated`) always match.
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

-- Expose to Supabase Realtime (safe if re-applied).
do $migration$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quiz_rankings'
  ) then
    alter publication supabase_realtime add table public.quiz_rankings;
  end if;
end $migration$;
