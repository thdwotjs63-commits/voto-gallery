alter table public.guestbook
add column if not exists is_admin boolean not null default false;

create index if not exists guestbook_is_admin_idx
on public.guestbook(is_admin);
