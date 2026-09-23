import type { Metadata } from 'next'
import Link from 'next/link'
import StaffBar from '@/components/staff/StaffBar'
import { requireStaff } from '@/lib/auth/guard'
import { loadAttendance } from '@/lib/attendance'
import { getEvents } from '@/lib/events'
import { formatEventDate, formatEventTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Club Zero1 door',
  robots: { index: false, follow: false },
}

export default async function CheckerPage() {
  const session = await requireStaff()
  const [{ events }, attendance] = await Promise.all([getEvents(), loadAttendance()])

  const now = Math.floor(Date.now() / 1000)
  // Tonight's door first: upcoming by soonest, then the most recent past events.
  const upcoming = events.filter((event) => event.endsAt > now).sort((a, b) => a.startsAt - b.startsAt)
  const past = events.filter((event) => event.endsAt <= now).sort((a, b) => b.startsAt - a.startsAt)

  function renderEvent(productId: string, title: string, startsAt: number, endsAt: number, where: string) {
    const stats = attendance.byProduct.get(productId)
    const sold = stats?.sold ?? 0
    const checkedIn = stats?.checkedIn ?? 0

    return (
      <li className="checker__item" key={productId}>
        <Link className="checker-event" href={`/checker/events/${productId}`}>
          <p className="checker-event__when">
            {formatEventDate(startsAt)} · {formatEventTime(startsAt, endsAt)}
          </p>
          <h2 className="checker-event__title">{title}</h2>
          <p className="checker-event__where">{where}</p>
          <p className="checker-event__count">
            <strong>{checkedIn}</strong> of <strong>{sold}</strong> checked in
          </p>
        </Link>
      </li>
    )
  }

  return (
    <main className="checker">
      <StaffBar session={session} title="Door" />

      <Link className="checker__scan-cta" href="/checker/scan">
        Scan a ticket
      </Link>

      <h2 className="checker__heading">Tonight and ahead</h2>
      {upcoming.length === 0 ? (
        <p className="checker__empty">No upcoming events.</p>
      ) : (
        <ul className="checker__list">
          {upcoming.map((event) =>
            renderEvent(
              event.productId,
              event.title,
              event.startsAt,
              event.endsAt,
              event.venue ? `${event.venue} · ${event.city}` : event.city
            )
          )}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="checker__heading">Past</h2>
          <ul className="checker__list checker__list--muted">
            {past
              .slice(0, 10)
              .map((event) =>
                renderEvent(
                  event.productId,
                  event.title,
                  event.startsAt,
                  event.endsAt,
                  event.venue ? `${event.venue} · ${event.city}` : event.city
                )
              )}
          </ul>
        </>
      )}
    </main>
  )
}
