-- Sign in once, fox everywhere. A signed-in account (Google, through Supabase
-- Auth) is bound to a mailbox, so a new device only needs the sign-in: the
-- mailbox code comes down with it, and with the code her fox, her letters and
-- the rest. The code itself is kept here for that purpose; the row is only
-- ever read by the account it belongs to, through tl_my_mailbox.

create table public.mailbox_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mailbox_id uuid not null references public.mailboxes (id) on delete cascade,
  code text not null,
  claimed_at timestamptz not null default now()
);

alter table public.mailbox_owners enable row level security;
revoke all on table public.mailbox_owners from anon, authenticated;

-- "This is my mailbox": binds the signed-in account to the mailbox behind the code.
-- Signing in again with another code moves the account to that mailbox.
create or replace function public.tl_claim_mailbox(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mailbox uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select id into v_mailbox from public.mailboxes where reader_hash = public.tl_hash(p_code);
  if v_mailbox is null then
    raise exception 'wrong mailbox code' using errcode = '28000';
  end if;
  insert into public.mailbox_owners (user_id, mailbox_id, code)
  values (v_user, v_mailbox, regexp_replace(lower(btrim(p_code)), '[[:space:]_]+', '-', 'g'))
  on conflict (user_id) do update
    set mailbox_id = excluded.mailbox_id, code = excluded.code, claimed_at = now();
  return true;
end
$$;

-- "Where's my fox?": the mailbox code bound to the signed-in account, or null.
create or replace function public.tl_my_mailbox()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select code from public.mailbox_owners where user_id = auth.uid()
$$;

-- "Forget this account": unbinds it (the mailbox and everything in it stay).
create or replace function public.tl_release_mailbox()
returns boolean
language sql
security definer
set search_path = ''
as $$
  delete from public.mailbox_owners where user_id = auth.uid() returning true
$$;

revoke all on function public.tl_claim_mailbox(text) from public, anon;
revoke all on function public.tl_my_mailbox() from public, anon;
revoke all on function public.tl_release_mailbox() from public, anon;
grant execute on function public.tl_claim_mailbox(text) to authenticated;
grant execute on function public.tl_my_mailbox() to authenticated;
grant execute on function public.tl_release_mailbox() to authenticated;
