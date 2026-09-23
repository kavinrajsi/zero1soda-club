import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { canCheckIn, readSession } from './auth/session'

export const CHECKIN_COOKIE = 'z1_staff'

function passcode(): string | null {
  return process.env.CHECKIN_PASSCODE || null
}

/** Cookie value is derived from the passcode, so it can't be guessed or reused elsewhere. */
export function staffCookieValue(): string {
  const code = passcode()
  if (!code) return ''
  return createHmac('sha256', process.env.TICKET_SECRET || code)
    .update(`staff:${code}`)
    .digest('base64url')
}

export function passcodeMatches(input: string): boolean {
  const code = passcode()
  if (!code || input.length !== code.length) return false
  return timingSafeEqual(Buffer.from(input), Buffer.from(code))
}

/**
 * A signed-in checker or admin needs no passcode; the shared passcode stays as
 * a fallback for a phone that is not signed in.
 */
export async function isStaff(): Promise<boolean> {
  if (canCheckIn(await readSession())) return true

  if (!passcode()) return false
  const store = await cookies()
  const current = store.get(CHECKIN_COOKIE)?.value
  const expected = staffCookieValue()
  if (!current || !expected || current.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(current), Buffer.from(expected))
}
