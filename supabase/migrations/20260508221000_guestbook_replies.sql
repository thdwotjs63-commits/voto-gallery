alter table public.guestbook
add column if not exists parent_id bigint null references public.guestbook(id) on delete cascade;

create index if not exists guestbook_parent_id_created_at_idx
on public.guestbook(parent_id, created_at desc);

alter table public.guestbook
drop constraint if exists guestbook_parent_not_self;

alter table public.guestbook
add constraint guestbook_parent_not_self check (parent_id is null or parent_id <> id);
