create table if not exists public.assistant_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  note text
);

-- No policies: only the server's service role and the owner can manage invitations.
alter table public.assistant_access enable row level security;
revoke all on public.assistant_access from anon, authenticated;
grant all on public.assistant_access to service_role;
