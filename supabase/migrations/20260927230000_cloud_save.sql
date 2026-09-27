-- TamaLucy cloud save: one fox shared between her devices (iPhone + Mac).
-- It hangs off her mailbox, so the same mailbox code that reads her letters
-- also loads and stores her fox. Every write names the version it was based
-- on (compare-and-swap): a device holding a stale copy gets 'save conflict'
-- and merges the newer save in before trying again, so two devices can't
-- silently overwrite each other.

create table public.saves (
  mailbox_id uuid primary key references public.mailboxes (id) on delete cascade,
  version integer not null default 1 check (version > 0),
  state jsonb not null check (pg_column_size(state) <= 1048576),
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;
revoke all on table public.saves from anon, authenticated;

-- cheap check for "has the other device saved since I last looked?" (0 = no save yet)
create or replace function public.tl_save_version(p_code text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.version
    from public.saves s
    join public.mailboxes m on m.id = s.mailbox_id
    where m.reader_hash = public.tl_hash(p_code)
  ), 0)
$$;

create or replace function public.tl_load_save(p_code text)
returns table (version integer, state jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.version, s.state, s.updated_at
  from public.saves s
  join public.mailboxes m on m.id = s.mailbox_id
  where m.reader_hash = public.tl_hash(p_code)
$$;

-- p_version: the version this state was based on (0 = there was no save yet).
-- Returns the new version.
create or replace function public.tl_store_save(p_code text, p_state jsonb, p_version integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mailbox uuid;
  v_version integer;
begin
  select id into v_mailbox from public.mailboxes where reader_hash = public.tl_hash(p_code);
  if v_mailbox is null then
    raise exception 'wrong mailbox code' using errcode = '28000';
  end if;
  if jsonb_typeof(p_state) is distinct from 'object' then
    raise exception 'a save must be an object' using errcode = '22023';
  end if;
  if coalesce(p_version, 0) = 0 then
    insert into public.saves (mailbox_id, version, state)
    values (v_mailbox, 1, p_state)
    on conflict (mailbox_id) do nothing
    returning saves.version into v_version;
  else
    update public.saves
    set state = p_state, version = saves.version + 1, updated_at = now()
    where mailbox_id = v_mailbox and saves.version = p_version
    returning saves.version into v_version;
  end if;
  if v_version is null then
    raise exception 'save conflict' using errcode = '40001';
  end if;
  return v_version;
end
$$;

revoke all on function public.tl_save_version(text) from public, authenticated;
revoke all on function public.tl_load_save(text) from public, authenticated;
revoke all on function public.tl_store_save(text, jsonb, integer) from public, authenticated;
grant execute on function public.tl_save_version(text) to anon;
grant execute on function public.tl_load_save(text) to anon;
grant execute on function public.tl_store_save(text, jsonb, integer) to anon;
