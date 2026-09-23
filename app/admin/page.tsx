import type { Metadata } from 'next'
import Link from 'next/link'
import StaffBar from '@/components/staff/StaffBar'
import { requireAdmin } from '@/lib/auth/guard'
import { loadAttendance, ORDER_HISTORY_DAYS } from '@/lib/attendance'
import { getEvents } from '@/lib/events'
import { formatEventDate, formatEventTime, formatMoney } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Club Zero1 admin',
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  const session = await requireAdmin()
  const [{ events, error }, attendance] = await Promise.all([getEvents(), loadAttendance()])

  const now = Math.floor(Date.now() / 1000)
  const historyFrom = Math.floor(new Date(attendance.since).getTime() / 1000)

  const rows = events
    .map((event) => {
      const stats = attendance.byProduct.get(event.productId)
      const capacity = event.variants.reduce(
        (total, variant) => total + (variant.quantityAvailable ?? 0),
        0
      )
      return {
        event,
        sold: stats?.sold ?? 0,
        checkedIn: stats?.checkedIn ?? 0,
        unpaid: stats?.unpaid ?? 0,
        capacity,
        /** Orders older than the window are invisible, so numbers would mislead. */
        beyondHistory: event.endsAt < historyFrom,
      }
    })
    .sort((a, b) => b.event.startsAt - a.event.startsAt)

  const totals = rows.reduce(
    (sum, row) => ({
      sold: sum.sold + (row.beyondHistory ? 0 : row.sold),
      checkedIn: sum.checkedIn + (row.beyondHistory ? 0 : row.checkedIn),
      revenue: sum.revenue + (row.beyondHistory ? 0 : row.sold * row.event.minPrice),
    }),
    { sold: 0, checkedIn: 0, revenue: 0 }
  )

  const currency = events[0]?.currencyCode ?? 'INR'

  return (
    <main className="admin">
      <StaffBar session={session} title="Events" />

      {error && (
        <p className="admin__notice admin__notice--error" role="alert">
          Events could not be loaded: {error}
        </p>
      )}

      <section className="admin__totals" aria-label="Totals">
        <div className="admin__total">
          <span className="admin__total-value">{totals.sold}</span>
          <span className="admin__total-label">Tickets sold</span>
        </div>
        <div className="admin__total">
          <span className="admin__total-value">{totals.checkedIn}</span>
          <span className="admin__total-label">Checked in</span>
        </div>
        <div className="admin__total">
          <span className="admin__total-value">{formatMoney(totals.revenue, currency)}</span>
          <span className="admin__total-label">Ticket value</span>
        </div>
      </section>

      <ul className="admin__list">
        {rows.map(({ event, sold, checkedIn, unpaid, capacity, beyondHistory }) => {
          const past = event.endsAt <= now
          const attendance = sold > 0 ? Math.round((checkedIn / sold) * 100) : 0

          return (
            <li className="admin__item" key={event.id}>
              <Link className="admin-event" href={`/admin/events/${event.productId}`}>
                <p className="admin-event__meta">
                  <span
                    className={`admin-event__state admin-event__state--${past ? 'past' : 'live'}`}
                  >
                    {past ? 'Past' : 'Upcoming'}
                  </span>
                  {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt, event.endsAt)}
                </p>

                <h2 className="admin-event__title">{event.title}</h2>
                <p className="admin-event__where">
                  {event.venue ? `${event.venue} · ${event.city}` : event.city}
                </p>

                {beyondHistory ? (
                  <p className="admin-event__stale">
                    Beyond the {ORDER_HISTORY_DAYS}-day order history
                  </p>
                ) : (
                  <>
                    <dl className="admin-event__stats">
                      <div className="admin-event__stat">
                        <dt>Sold</dt>
                        <dd>{sold}</dd>
                      </div>
                      <div className="admin-event__stat">
                        <dt>Checked in</dt>
                        <dd>{checkedIn}</dd>
                      </div>
                      <div className="admin-event__stat">
                        <dt>Seats left</dt>
                        <dd>{capacity}</dd>
                      </div>
                      {unpaid > 0 && (
                        <div className="admin-event__stat admin-event__stat--warn">
                          <dt>Unpaid</dt>
                          <dd>{unpaid}</dd>
                        </div>
                      )}
                    </dl>

                    <div
                      className="admin-event__bar"
                      role="img"
                      aria-label={`${attendance}% of sold tickets checked in`}
                    >
                      <span className="admin-event__bar-fill" style={{ width: `${attendance}%` }} />
                    </div>
                  </>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {rows.length === 0 && <p className="admin__empty">No events yet.</p>}

      <p className="admin__footnote">
        Sold and checked-in counts come from orders in the last {ORDER_HISTORY_DAYS} days
        (since {attendance.since}).
      </p>
    </main>
  )
}
