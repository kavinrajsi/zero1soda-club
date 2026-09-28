import type { Metadata } from 'next'
import Link from 'next/link'
import StaffBar from '@/components/staff/StaffBar'
import { requireAdmin } from '@/lib/auth/guard'
import { loadAttendance, ORDER_HISTORY_DAYS, type EventAttendance } from '@/lib/attendance'
import { getEvents } from '@/lib/events'
import { formatEventDate, formatEventTime, formatMoney } from '@/lib/format'
import { loadInterest, type Interest } from '@/lib/interest'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Club Zero1 admin',
  robots: { index: false, follow: false },
}

/** Interest is a side panel: if Shopify refuses the lookup, the event numbers still render. */
async function safeInterest(): Promise<Interest | null> {
  try {
    return await loadInterest()
  } catch (error) {
    console.error('[club-zero1] interest lookup failed', error)
    return null
  }
}

function EventStats({ stats, seatsLeft }: { stats: EventAttendance | undefined; seatsLeft?: number }) {
  const sold = stats?.sold ?? 0
  const checkedIn = stats?.checkedIn ?? 0
  const unpaid = stats?.unpaid ?? 0
  const refunded = stats?.refunded ?? 0
  const attendance = sold > 0 ? Math.round((checkedIn / sold) * 100) : 0

  return (
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
        {seatsLeft !== undefined && (
          <div className="admin-event__stat">
            <dt>Seats left</dt>
            <dd>{seatsLeft}</dd>
          </div>
        )}
        {unpaid > 0 && (
          <div className="admin-event__stat admin-event__stat--warn">
            <dt>Unpaid</dt>
            <dd>{unpaid}</dd>
          </div>
        )}
        {refunded > 0 && (
          <div className="admin-event__stat">
            <dt>Refunded</dt>
            <dd>{refunded}</dd>
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
  )
}

export default async function AdminPage() {
  const session = await requireAdmin()
  const [{ events, error }, attendance, interest] = await Promise.all([
    getEvents(),
    loadAttendance(),
    safeInterest(),
  ])

  const now = Math.floor(Date.now() / 1000)
  const historyFrom = Math.floor(new Date(attendance.since).getTime() / 1000)

  const rows = events
    .map((event) => ({
      event,
      stats: attendance.byProduct.get(event.productId),
      seatsLeft: event.variants.reduce(
        (total, variant) => total + (variant.quantityAvailable ?? 0),
        0
      ),
      /** Orders older than the window are invisible, so numbers would mislead. */
      beyondHistory: event.endsAt < historyFrom,
    }))
    .sort((a, b) => b.event.startsAt - a.event.startsAt)

  // Tickets sold for events that have since left the store still need a home.
  const listed = new Set(events.map((event) => event.productId))
  const offStore = [...attendance.byProduct.values()]
    .filter((stats) => !listed.has(stats.productId))
    .sort((a, b) => a.eventTitle.localeCompare(b.eventTitle))

  const counted = [
    ...rows.filter((row) => !row.beyondHistory).map((row) => row.stats),
    ...offStore,
  ]
  const totals = counted.reduce(
    (sum, stats) => ({
      sold: sum.sold + (stats?.sold ?? 0),
      checkedIn: sum.checkedIn + (stats?.checkedIn ?? 0),
      revenue: sum.revenue + (stats?.revenue ?? 0),
    }),
    { sold: 0, checkedIn: 0, revenue: 0 }
  )

  const currency =
    counted.find((stats) => stats?.currencyCode)?.currencyCode ?? events[0]?.currencyCode ?? 'INR'

  return (
    <main className="admin">
      <StaffBar
        session={session}
        title="Events"
        action={
          <Link className="staff-bar__back" href="/checker/scan">
            Scan tickets
          </Link>
        }
      />

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
          <span className="admin__total-label">Paid revenue</span>
        </div>
        <div className="admin__total">
          <span className="admin__total-value">{interest ? interest.total : '—'}</span>
          <span className="admin__total-label">Want updates</span>
        </div>
      </section>

      <ul className="admin__list">
        {rows.map(({ event, stats, seatsLeft, beyondHistory }) => {
          const past = event.endsAt <= now

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
                  <EventStats stats={stats} seatsLeft={seatsLeft} />
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {rows.length === 0 && <p className="admin__empty">No events yet.</p>}

      {offStore.length > 0 && (
        <>
          <h2 className="admin__heading">Not on the store</h2>
          <ul className="admin__list admin__list--muted">
            {offStore.map((stats) => (
              <li className="admin__item" key={stats.productId}>
                <Link className="admin-event" href={`/admin/events/${stats.productId}`}>
                  <h2 className="admin-event__title">{stats.eventTitle}</h2>
                  <p className="admin-event__where">Unpublished or removed, with tickets sold</p>
                  <EventStats stats={stats} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="admin__heading">Want updates by city</h2>
      {!interest ? (
        <p className="admin__empty">Interest sign-ups could not be loaded.</p>
      ) : interest.cities.length === 0 ? (
        <p className="admin__empty">No one has asked for updates yet.</p>
      ) : (
        <ul className="admin-interest">
          {interest.cities.map(({ city, count }) => (
            <li className="admin-interest__row" key={city}>
              <span>{city}</span>
              <strong>{count}</strong>
            </li>
          ))}
        </ul>
      )}

      <p className="admin__footnote">
        Sold, checked-in and revenue come from orders in the last {ORDER_HISTORY_DAYS} days
        (since {attendance.since}). Revenue is paid line totals after line discounts; cancelled
        orders are left out and refunded tickets are listed separately. Updates are people who
        used &ldquo;Notify me&rdquo;, tagged <code>club-zero1</code> in Shopify.
      </p>
    </main>
  )
}
