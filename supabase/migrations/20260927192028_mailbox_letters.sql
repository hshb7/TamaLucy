-- TamaLucy letters: the giver writes letters (optionally scheduled), the
-- fox delivers them to her app. Both sides hold a secret code; only its
-- sha256 hash is stored. Tables are closed to the API; everything goes
-- through the security-definer functions below, which check the code.

create table public.mailboxes (
  id uuid primary key default gen_random_uuid(),
  reader_hash text not null unique,
  writer_hash text not null unique,
  created_at timestamptz not null default now()
);

create table public.letters (
  id uuid primary key default gen_random_uuid(),
  mailbox_id uuid not null references public.mailboxes (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  signed text not null default '' check (char_length(signed) <= 60),
  deliver_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index letters_mailbox_deliver_idx on public.letters (mailbox_id, deliver_at);

alter table public.mailboxes enable row level security;
alter table public.letters enable row level security;
revoke all on table public.mailboxes, public.letters from anon, authenticated;

-- codes are compared case-insensitively, with spaces treated like hyphens
create or replace function public.tl_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(regexp_replace(lower(btrim(coalesce(p_code, ''))), '[[:space:]_]+', '-', 'g'), 'UTF8')), 'hex')
$$;

create or replace function public.tl_check_mailbox(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.mailboxes where reader_hash = public.tl_hash(p_code))
$$;

create or replace function public.tl_fetch_letters(p_code text)
returns table (id uuid, body text, signed text, deliver_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.body, l.signed, l.deliver_at
  from public.letters l
  join public.mailboxes m on m.id = l.mailbox_id
  where m.reader_hash = public.tl_hash(p_code)
    and l.deliver_at <= now()
  order by l.deliver_at desc
  limit 100
$$;

create or replace function public.tl_send_letter(p_key text, p_body text, p_signed text default '', p_deliver_at timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mailbox uuid;
  v_id uuid;
begin
  select id into v_mailbox from public.mailboxes where writer_hash = public.tl_hash(p_key);
  if v_mailbox is null then
    raise exception 'wrong writer key' using errcode = '28000';
  end if;
  if (select count(*) from public.letters where mailbox_id = v_mailbox) >= 1000 then
    raise exception 'mailbox is full';
  end if;
  insert into public.letters (mailbox_id, body, signed, deliver_at)
  values (v_mailbox, btrim(p_body), btrim(coalesce(p_signed, '')), coalesce(p_deliver_at, now()))
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.tl_list_letters(p_key text)
returns table (id uuid, body text, signed text, deliver_at timestamptz, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.mailboxes where writer_hash = public.tl_hash(p_key)) then
    raise exception 'wrong writer key' using errcode = '28000';
  end if;
  return query
    select l.id, l.body, l.signed, l.deliver_at, l.created_at
    from public.letters l
    join public.mailboxes m on m.id = l.mailbox_id
    where m.writer_hash = public.tl_hash(p_key)
    order by l.deliver_at desc
    limit 200;
end
$$;

create or replace function public.tl_delete_letter(p_key text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.letters l
  using public.mailboxes m
  where l.id = p_id
    and m.id = l.mailbox_id
    and m.writer_hash = public.tl_hash(p_key);
  get diagnostics v_count = row_count;
  return v_count > 0;
end
$$;

revoke all on function public.tl_hash(text) from public, anon, authenticated;
revoke all on function public.tl_check_mailbox(text) from public;
revoke all on function public.tl_fetch_letters(text) from public;
revoke all on function public.tl_send_letter(text, text, text, timestamptz) from public;
revoke all on function public.tl_list_letters(text) from public;
revoke all on function public.tl_delete_letter(text, uuid) from public;

grant execute on function public.tl_check_mailbox(text) to anon, authenticated;
grant execute on function public.tl_fetch_letters(text) to anon, authenticated;
grant execute on function public.tl_send_letter(text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.tl_list_letters(text) to anon, authenticated;
grant execute on function public.tl_delete_letter(text, uuid) to anon, authenticated;
