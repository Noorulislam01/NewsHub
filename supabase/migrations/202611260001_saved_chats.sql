create table if not exists public.saved_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_chats_user_updated_idx
  on public.saved_chats (user_id, updated_at desc);

alter table public.saved_chats enable row level security;

grant select, insert, update, delete on table public.saved_chats to authenticated;

drop policy if exists "Users can view their own saved chats" on public.saved_chats;
create policy "Users can view their own saved chats"
  on public.saved_chats for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own saved chats" on public.saved_chats;
create policy "Users can create their own saved chats"
  on public.saved_chats for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own saved chats" on public.saved_chats;
create policy "Users can update their own saved chats"
  on public.saved_chats for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own saved chats" on public.saved_chats;
create policy "Users can delete their own saved chats"
  on public.saved_chats for delete
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
