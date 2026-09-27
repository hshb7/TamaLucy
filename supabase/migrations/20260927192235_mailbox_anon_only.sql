-- The app has no sign-in, so only the anon role needs the mailbox functions.
revoke execute on function public.tl_check_mailbox(text) from authenticated;
revoke execute on function public.tl_fetch_letters(text) from authenticated;
revoke execute on function public.tl_send_letter(text, text, text, timestamptz) from authenticated;
revoke execute on function public.tl_list_letters(text) from authenticated;
revoke execute on function public.tl_delete_letter(text, uuid) from authenticated;
