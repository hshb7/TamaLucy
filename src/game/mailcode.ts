/**
 * Mailbox codes are compared case-insensitively, with any run of spaces or
 * underscores treated as a hyphen. Must match public.tl_hash in Supabase.
 */
export function normalizeCode(code: string): string {
  return code.trim().toLowerCase().replace(/[\s_]+/g, '-')
}
