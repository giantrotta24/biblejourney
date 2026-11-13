create table if not exists public.assistant_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

create table if not exists public.assistant_answers (
  day_index smallint not null check (day_index between 0 and 311),
  prompt_type text not null check (prompt_type in ('history', 'map', 'people')),
  answer text not null,
  model text not null,
  created_at timestamptz not null default now(),
  primary key (day_index, prompt_type)
);

-- RLS on with no policies: only the server, using the service role key, reads or writes these tables.
alter table public.assistant_usage enable row level security;
alter table public.assistant_answers enable row level security;
revoke all on public.assistant_usage from anon, authenticated;
revoke all on public.assistant_answers from anon, authenticated;

create or replace function public.assistant_take_question(p_user_id uuid, p_day date, p_limit integer)
returns table (allowed boolean, used integer)
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.assistant_usage as u (user_id, day, count)
  values (p_user_id, p_day, 1)
  on conflict (user_id, day) do update set count = u.count + 1 where u.count < p_limit
  returning u.count into v_count;

  if v_count is null then
    select u.count into v_count from public.assistant_usage u where u.user_id = p_user_id and u.day = p_day;
    return query select false, v_count;
  else
    return query select true, v_count;
  end if;
end;
$$;

revoke execute on function public.assistant_take_question(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.assistant_take_question(uuid, date, integer) to service_role;
