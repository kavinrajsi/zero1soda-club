'use server'

import { isStaff } from '@/lib/checkin-auth'
import { encodeTicket, findTicketByCode } from '@/lib/tickets'

/**
 * Swaps a typed short code for the signed check-in token. Staff only: order
 * numbers are sequential, so an open lookup would hand out every ticket.
 */
export async function resolveTicketCode(code: string): Promise<string | null> {
  if (!(await isStaff())) return null

  try {
    const ref = await findTicketByCode(code)
    return ref ? encodeTicket(ref) : null
  } catch (error) {
    console.error('[club-zero1] ticket code lookup failed', error)
    return null
  }
}
