alter table public.profiles
  add column if not exists last_reminded_on date;

create index if not exists profiles_reminder_time_idx
  on public.profiles (reminder_time)
  where reminder_time is not null;

delete from public.push_subscriptions where endpoint not like 'https://%';

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_endpoint_https;
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_https check (endpoint like 'https://%');
