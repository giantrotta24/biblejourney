create table if not exists public.notes (
  user_id uuid not null references auth.users (id) on delete cascade,
  day_index int not null check (day_index between 0 and 311),
  body text not null check (char_length(body) between 1 and 20000),
  updated_at timestamptz not null,
  primary key (user_id, day_index)
);

alter table public.notes enable row level security;

drop policy if exists "Own rows: select" on public.notes;
drop policy if exists "Own rows: insert" on public.notes;
drop policy if exists "Own rows: update" on public.notes;
drop policy if exists "Own rows: delete" on public.notes;
create policy "Own rows: select" on public.notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own rows: insert" on public.notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own rows: update" on public.notes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own rows: delete" on public.notes for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.keep_latest_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at < old.updated_at then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists notes_keep_latest on public.notes;
create trigger notes_keep_latest
  before update on public.notes
  for each row execute function public.keep_latest_note();

drop trigger if exists notes_broadcast on public.notes;
create trigger notes_broadcast
  after insert or update or delete on public.notes
  for each row execute function public.broadcast_progress_change();
