alter table public.profiles
  add column if not exists last_reminded_on date;

create index if not exists profiles_reminder_time_idx
  on public.profiles (reminder_time)
  where reminder_time is not null;
