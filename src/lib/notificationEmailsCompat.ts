import type { SupabaseClient } from '@supabase/supabase-js'

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const value = (error as { message?: unknown }).message
    if (typeof value === 'string' && value.length > 0) return value
  }
  return 'Unknown error'
}

/** True when PostgREST reports unknown columns / stale schema for notification_emails. */
export function isNotificationEmailsSchemaLimitedError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    (m.includes('schema cache') && m.includes('notification_emails')) ||
    (m.includes('could not find') && m.includes('column')) ||
    (m.includes('column') && m.includes('does not exist'))
  )
}

export async function fetchNotificationRecipientEmails(client: SupabaseClient): Promise<string[]> {
  const active = await client.from('notification_emails').select('email').eq('is_active', true)
  if (!active.error) {
    return Array.from(
      new Set(
        (active.data ?? [])
          .map((entry) =>
            typeof entry?.email === 'string' ? entry.email.trim().toLowerCase() : ''
          )
          .filter((email) => email.length > 0)
      )
    )
  }
  const msg = asErrorMessage(active.error)
  if (!isNotificationEmailsSchemaLimitedError(msg)) {
    return []
  }
  const plain = await client.from('notification_emails').select('email')
  if (plain.error) {
    return []
  }
  return Array.from(
    new Set(
      (plain.data ?? [])
        .map((entry) =>
          typeof entry?.email === 'string' ? entry.email.trim().toLowerCase() : ''
        )
        .filter((email) => email.length > 0)
    )
  )
}
