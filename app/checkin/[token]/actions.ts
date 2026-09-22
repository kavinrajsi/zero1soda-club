'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { CHECKIN_COOKIE, isStaff, passcodeMatches, staffCookieValue } from '@/lib/checkin-auth'
import { decodeTicket, markCheckedIn } from '@/lib/tickets'

export async function signIn(formData: FormData) {
  const code = String(formData.get('passcode') || '')
  if (!passcodeMatches(code)) return

  const store = await cookies()
  store.set(CHECKIN_COOKIE, staffCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12, // one shift
    path: '/checkin',
  })
  revalidatePath('/checkin', 'layout')
}

export async function checkIn(formData: FormData) {
  if (!(await isStaff())) return

  const token = String(formData.get('token') || '')
  const ref = decodeTicket(token)
  if (!ref) return

  await markCheckedIn(ref)
  revalidatePath(`/checkin/${token}`)
}
