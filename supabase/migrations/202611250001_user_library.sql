-- Per-user library data for One News Hub.
-- Run this migration in the Supabase SQL Editor or through the Supabase CLI.

create table if not exists public.saved_articles (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  article_url text not null,
  title text not null,
  publisher text not null default '',
  category text not null default '',
  published_at timestamptz,
  image_url text not null default '',
  saved_at timestamptz not null default now(),
  primary key (user_id, article_url)
);

create index if not exists saved_articles_user_saved_at_idx
  on public.saved_articles (user_id, saved_at desc);

create table if not exists public.user_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.saved_articles enable row level security;
alter table public.user_preferences enable row level security;

revoke all on table public.saved_articles from anon, authenticated;
revoke all on table public.user_preferences from anon, authenticated;
grant select, insert, update, delete on table public.saved_articles to authenticated;
grant select, insert, update, delete on table public.user_preferences to authenticated;

drop policy if exists "Users can read their saved articles" on public.saved_articles;
create policy "Users can read their saved articles"
  on public.saved_articles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can save their own articles" on public.saved_articles;
create policy "Users can save their own articles"
  on public.saved_articles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own saved articles" on public.saved_articles;
create policy "Users can update their own saved articles"
  on public.saved_articles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own saved articles" on public.saved_articles;
create policy "Users can remove their own saved articles"
  on public.saved_articles for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own preferences" on public.user_preferences;
create policy "Users can read their own preferences"
  on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own preferences" on public.user_preferences;
create policy "Users can create their own preferences"
  on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own preferences" on public.user_preferences;
create policy "Users can update their own preferences"
  on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own preferences" on public.user_preferences;
create policy "Users can remove their own preferences"
  on public.user_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);


-- Preserve the fields needed to render a saved story after it is loaded from the account library.
alter table public.saved_articles
  add column if not exists article_data jsonb not null default '{}'::jsonb;
