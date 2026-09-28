import { isAdmin, readSession } from '@/lib/auth/session'
import { loadAttendance, type Attendee } from '@/lib/attendance'
import { getEvents } from '@/lib/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stampFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

/**
 * Quotes every field. A leading = + - @ would run as a formula in Sheets or
 * Excel, and booking names are typed by the public, so those get a ' prefix.
 */
function cell(value: string | number): string {
  let text = String(value)
  // Phone numbers like +91 98… are plain digits, so they can stay as typed.
  const phone = /^\+?[\d\s()-]+$/.test(text)
  if (!phone && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function status(attendee: Attendee): string {
  if (attendee.payment === 'refunded') return 'Refunded'
  if (attendee.checkedInAt) return 'Checked in'
  return attendee.payment === 'paid' ? 'Not yet' : 'Unpaid'
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'
}

/** One event's guest list as CSV, for a paper backup at the door or follow-ups. */
export async function GET(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const session = await readSession()
  if (!session) return new Response('sign in required', { status: 401 })
  if (!isAdmin(session)) return new Response('admins only', { status: 403 })

  const { productId } = await params
  const [{ events }, attendance] = await Promise.all([getEvents(), loadAttendance()])
  const event = events.find((item) => item.productId === productId)
  const stats = attendance.byProduct.get(productId)
  if (!event && !stats) return new Response('not found', { status: 404 })

  const header = ['Name', 'Email', 'Phone', 'Order', 'Ticket code', 'Ticket', 'Status', 'Checked in (IST)']
  const rows = (stats?.attendees ?? []).map((attendee) => [
    attendee.name,
    attendee.email,
    attendee.phone,
    attendee.orderName,
    attendee.code,
    `${attendee.index} of ${attendee.quantity}`,
    status(attendee),
    attendee.checkedInAt ? stampFormatter.format(new Date(attendee.checkedInAt)) : '',
  ])

  // Leading BOM so Excel reads the file as UTF-8 (₹, accented names).
  const csv = '﻿' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
  const name = slug(event?.title ?? stats?.eventTitle ?? productId)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}-guests.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
