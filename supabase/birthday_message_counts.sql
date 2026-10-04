-- 생일 메시지 개수만 세는 함수 — 메시지 내용·닉네임은 어떤 형태로도 반환하지 않는다.
-- RLS 로 비공개 행을 읽을 수 없는 anon 도 숫자는 볼 수 있도록 SECURITY DEFINER 로 만든다.
-- Supabase SQL Editor 에서 실행.

create or replace function public.birthday_message_counts()
returns table (total bigint, public_count bigint, private_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint as total,
    count(*) filter (where m.is_public is true)::bigint as public_count,
    count(*) filter (where m.is_public is not true)::bigint as private_count
  from public.birthday_messages m;
$$;

revoke all on function public.birthday_message_counts() from public;
grant execute on function public.birthday_message_counts() to anon, authenticated;
