create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  reminder_time time,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  link_translation text not null default 'NIV',
  created_at timestamptz not null default now()
);

create table if not exists public.day_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  day_index smallint not null check (day_index between 0 and 311),
  completed_at timestamptz not null default now(),
  primary key (user_id, day_index)
);

create table if not exists public.verse_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  week smallint not null check (week between 1 and 52),
  learned_at timestamptz not null default now(),
  primary key (user_id, week)
);

create table if not exists public.push_subscriptions (
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.profiles enable row level security;
alter table public.day_progress enable row level security;
alter table public.verse_progress enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'day_progress', 'verse_progress', 'push_subscriptions'] loop
    execute format('drop policy if exists "Own rows: select" on public.%I', t);
    execute format('drop policy if exists "Own rows: insert" on public.%I', t);
    execute format('drop policy if exists "Own rows: update" on public.%I', t);
    execute format('drop policy if exists "Own rows: delete" on public.%I', t);
    execute format('create policy "Own rows: select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "Own rows: insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Own rows: update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Own rows: delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end
$$;

create or replace function public.keep_earliest_completion()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'day_progress' then
    new.completed_at := least(old.completed_at, new.completed_at);
  else
    new.learned_at := least(old.learned_at, new.learned_at);
  end if;
  return new;
end;
$$;

drop trigger if exists day_progress_keep_earliest on public.day_progress;
create trigger day_progress_keep_earliest
  before update on public.day_progress
  for each row execute function public.keep_earliest_completion();

drop trigger if exists verse_progress_keep_earliest on public.verse_progress;
create trigger verse_progress_keep_earliest
  before update on public.verse_progress
  for each row execute function public.keep_earliest_completion();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'day_progress'
  ) then
    alter publication supabase_realtime add table public.day_progress;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'verse_progress'
  ) then
    alter publication supabase_realtime add table public.verse_progress;
  end if;
end
$$;
