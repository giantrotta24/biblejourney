alter table public.profiles
  add column if not exists progress_reset_at timestamptz;

create or replace function public.reset_progress()
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reader uuid := auth.uid();
  stamped timestamptz := now();
begin
  if reader is null then
    raise exception 'Sign in to reset progress' using errcode = '42501';
  end if;
  delete from public.day_progress where user_id = reader;
  delete from public.verse_progress where user_id = reader;
  insert into public.profiles (user_id, progress_reset_at)
  values (reader, stamped)
  on conflict (user_id) do update set progress_reset_at = excluded.progress_reset_at;
  return stamped;
end;
$$;

revoke execute on function public.reset_progress() from public, anon;
grant execute on function public.reset_progress() to authenticated;
