-- A stale save now fails fast with 409 Conflict instead of making the API
-- retry it.
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
    -- PT409 makes the API answer 409 Conflict right away; with 40001
    -- (serialization failure) it would keep retrying the request
    raise exception 'save conflict' using errcode = 'PT409';
  end if;
  return v_version;
end
$$;
