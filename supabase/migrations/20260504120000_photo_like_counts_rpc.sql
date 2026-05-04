-- Accurate like counts per Drive file id (photo_id), without hitting default row limits
-- on large `photo_likes` tables. Run via Supabase SQL Editor or `supabase db push`.

create or replace function public.photo_like_counts_for_ids(p_ids text[])
returns table (photo_id text, like_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select pl.photo_id, count(*)::bigint as like_count
  from public.photo_likes pl
  where pl.photo_id = any(p_ids)
  group by pl.photo_id;
$$;

grant execute on function public.photo_like_counts_for_ids(text[]) to anon, authenticated;
grant execute on function public.photo_like_counts_for_ids(text[]) to service_role;
