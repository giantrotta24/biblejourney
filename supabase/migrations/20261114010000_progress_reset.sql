alter table public.profiles
  add column if not exists progress_reset_at timestamptz;
