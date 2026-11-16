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

create index if not exists assistant_reports_user_id_created_at_idx on public.assistant_reports (user_id, created_at);

-- One locked check-and-insert per reader, so two reports cannot both pass the daily limit.
create or replace function public.assistant_submit_report(
  p_user_id uuid,
  p_day_index integer,
  p_kind text,
  p_question text,
  p_answer text,
  p_note text,
  p_model text,
  p_prompt_version text,
  p_limit integer,
  p_now timestamptz
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
  v_start timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  v_start := date_trunc('day', p_now at time zone 'utc') at time zone 'utc';
  select count(*)::integer into v_count
  from public.assistant_reports
  where user_id = p_user_id
    and created_at >= v_start
    and created_at < v_start + interval '1 day';

  if v_count is null or p_limit is null or v_count >= p_limit then
    return false;
  end if;

  insert into public.assistant_reports (
    user_id, day_index, kind, question, answer, note, model, prompt_version, created_at
  ) values (
    p_user_id, p_day_index, p_kind, p_question, p_answer, p_note, p_model, p_prompt_version, p_now
  );

  return true;
end;
$$;

revoke execute on function public.assistant_submit_report(uuid, integer, text, text, text, text, text, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.assistant_submit_report(uuid, integer, text, text, text, text, text, text, integer, timestamptz) to service_role;
