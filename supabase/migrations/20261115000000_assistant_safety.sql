create table if not exists public.assistant_flags (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  day_index int not null,
  category text not null check (category in ('off_topic', 'inappropriate', 'manipulation', 'crisis', 'withheld')),
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  day_index int not null,
  kind text not null check (kind in ('question', 'history', 'map', 'people')),
  question text,
  answer text not null,
  note text,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

-- No policies: only the server's service role and the owner can read flags or reports.
alter table public.assistant_flags enable row level security;
alter table public.assistant_reports enable row level security;
revoke all on public.assistant_flags from anon, authenticated;
revoke all on public.assistant_reports from anon, authenticated;
grant all on public.assistant_flags to service_role;
grant all on public.assistant_reports to service_role;
