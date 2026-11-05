-- VIP realtime chat for the course SPA.
-- Run this once in the Supabase SQL editor (free project is enough).
-- Login stays in the browser, so these policies allow the public anon key
-- to read and insert. The SPA only mounts chat when profile.vip is true.
-- Do not put secrets in messages. Tighten the policies when auth moves server-side.

create table if not exists public.vip_channels (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.vip_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id bigint not null references public.vip_channels (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  author_id text not null check (char_length(author_id) between 1 and 80),
  author_name text not null check (char_length(author_name) between 1 and 80),
  author_role text not null check (author_role in ('student', 'staff', 'admin')),
  kind text not null default 'chat' check (kind in ('chat', 'announcement')),
  created_at timestamptz not null default now()
);

create index if not exists vip_messages_channel_created_idx
  on public.vip_messages (channel_id, created_at);

alter table public.vip_channels enable row level security;
alter table public.vip_messages enable row level security;

grant select, insert on public.vip_channels to anon, authenticated;
grant select, insert on public.vip_messages to anon, authenticated;
grant usage, select on sequence public.vip_channels_id_seq to anon, authenticated;

drop policy if exists vip_channels_select on public.vip_channels;
create policy vip_channels_select on public.vip_channels
  for select to anon, authenticated using (true);

drop policy if exists vip_channels_insert on public.vip_channels;
create policy vip_channels_insert on public.vip_channels
  for insert to anon, authenticated with check (true);

drop policy if exists vip_messages_select on public.vip_messages;
create policy vip_messages_select on public.vip_messages
  for select to anon, authenticated using (true);

drop policy if exists vip_messages_insert on public.vip_messages;
create policy vip_messages_insert on public.vip_messages
  for insert to anon, authenticated with check (true);

insert into public.vip_channels (name)
select '復盤交流'
where not exists (select 1 from public.vip_channels where name = '復盤交流');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vip_channels'
  ) then
    alter publication supabase_realtime add table public.vip_channels;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vip_messages'
  ) then
    alter publication supabase_realtime add table public.vip_messages;
  end if;
end $$;
