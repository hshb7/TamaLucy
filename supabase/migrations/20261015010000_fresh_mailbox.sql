-- First time here, signed in: a mailbox of her own, made on the spot and
-- bound to the account, so a brand-new person can start a fox and have it
-- follow them without a giver minting codes. The writer key is returned once,
-- for her to hand to whoever will write her letters.
create or replace function public.tl_claim_new_mailbox()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_existing text;
  v_code text;
  v_writer text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select code into v_existing from public.mailbox_owners where user_id = v_user;
  if v_existing is not null then
    return json_build_object('code', v_existing);
  end if;
  v_code := regexp_replace(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20), '(.{4})(?=.)', '\1-', 'g');
  v_writer := 'writer-' || regexp_replace(substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 24), '(.{4})(?=.)', '\1-', 'g');
  insert into public.mailboxes (reader_hash, writer_hash)
  values (public.tl_hash(v_code), public.tl_hash(v_writer))
  returning id into v_id;
  insert into public.mailbox_owners (user_id, mailbox_id, code) values (v_user, v_id, v_code);
  return json_build_object('code', v_code, 'writer', v_writer);
end
$$;

revoke all on function public.tl_claim_new_mailbox() from public, anon;
grant execute on function public.tl_claim_new_mailbox() to authenticated;
