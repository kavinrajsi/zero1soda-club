import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AttendeeList from '@/components/staff/AttendeeList'
import StaffBar from '@/components/staff/StaffBar'
import { requireAdmin } from '@/lib/auth/guard'
import { loadAttendance } from '@/lib/attendance'
import { getEvents } from '@/lib/events'
import { formatEventDate, formatEventTime, formatMoney } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Club Zero1 admin — event',
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ productId: string }> }

export default async function AdminEventPage({ params }: Props) {
  const session = await requireAdmin()
  const { productId } = await params

  const [{ events }, attendance] = await Promise.all([getEvents(), loadAttendance()])
  const event = events.find((item) => item.productId === productId)
  if (!event) notFound()

  const stats = attendance.byProduct.get(productId)
  const sold = stats?.sold ?? 0
  const checkedIn = stats?.checkedIn ?? 0
  const seatsLeft = event.variants.reduce(
    (total, variant) => total + (variant.quantityAvailable ?? 0),
    0
  )

  return (
    <main className="admin">
      <StaffBar
        session={session}
        title={event.title}
        action={
          <Link className="staff-bar__back" href="/admin">
            All events
          </Link>
        }
      />

      <p className="admin__subtitle">
        {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt, event.endsAt)}
        <br />
        {event.venue ? `${event.venue} · ${event.city}` : event.city}
      </p>

      <section className="admin__totals" aria-label="Event totals">
        <div className="admin__total">
          <span className="admin__total-value">{sold}</span>
          <span className="admin__total-label">Sold</span>
        </div>
        <div className="admin__total">
          <span className="admin__total-value">{checkedIn}</span>
          <span className="admin__total-label">Checked in</span>
        </div>
        <div className="admin__total">
          <span className="admin__total-value">{seatsLeft}</span>
          <span className="admin__total-label">Seats left</span>
        </div>
        <div className="admin__total">
          <span className="admin__total-value">
            {formatMoney(sold * event.minPrice, event.currencyCode)}
          </span>
          <span className="admin__total-label">Ticket value</span>
        </div>
      </section>

      <h2 className="admin__heading">Guests</h2>
      <AttendeeList attendees={stats?.attendees ?? []} />
    </main>
  )
}
