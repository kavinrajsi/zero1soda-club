'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { after } from 'next/server'
import { CHECKIN_COOKIE, isStaff, passcodeMatches, staffCookieValue } from '@/lib/checkin-auth'
import { istTime, logToSheet } from '@/lib/sheets'
import { decodeTicket, loadTicket, markCheckedIn, ticketSlotKey } from '@/lib/tickets'

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

  // The button only shows for valid tickets; check again so a stale screen or
  // a replayed form can't admit an unpaid or refunded one.
  const ticket = await loadTicket(ref)
  if (!ticket?.paid) return

  const result = await markCheckedIn(ref)
  if (!result.alreadyUsed) {
    after(() =>
      logToSheet('Check-ins', [
        ticket.orderName,
        ref.orderId,
        ticketSlotKey(ref),
        ticket.code,
        ticket.buyerName,
        ticket.event,
        ticket.city,
        istTime(result.at),
      ])
    )
  }
  revalidatePath(`/checkin/${token}`)
}
