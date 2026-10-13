-- A daily cap per mailbox for the things that cost money or hammer someone
-- else's server: the study buddy (Claude) and the Canvas relay. Only the Edge
-- Functions call this (as the service role); the app never can.

create table public.usage (
  mailbox_id uuid not null references public.mailboxes (id) on delete cascade,
  bucket text not null,
  day date not null default (now() at time zone 'utc')::date,
  calls integer not null default 0,
  primary key (mailbox_id, bucket, day)
);

alter table public.usage enable row level security;
revoke all on table public.usage from anon, authenticated;

-- Counts one call in `bucket` for the mailbox behind `p_code` and returns how
-- many are left today, or -1 (without counting) once the limit is reached.
create or replace function public.tl_usage_tick(p_code text, p_bucket text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mailbox uuid;
  v_today date := (now() at time zone 'utc')::date;
  v_calls integer;
begin
  select id into v_mailbox from public.mailboxes where reader_hash = public.tl_hash(p_code);
  if v_mailbox is null then
    raise exception 'wrong mailbox code' using errcode = '28000';
  end if;
  insert into public.usage (mailbox_id, bucket, day, calls)
  values (v_mailbox, p_bucket, v_today, 0)
  on conflict (mailbox_id, bucket, day) do nothing;
  select calls into v_calls from public.usage
  where mailbox_id = v_mailbox and bucket = p_bucket and day = v_today
  for update;
  if v_calls >= p_limit then
    return -1;
  end if;
  update public.usage set calls = calls + 1
  where mailbox_id = v_mailbox and bucket = p_bucket and day = v_today;
  return p_limit - v_calls - 1;
end
$$;

revoke all on function public.tl_usage_tick(text, text, integer) from public, anon, authenticated;
grant execute on function public.tl_usage_tick(text, text, integer) to service_role;
