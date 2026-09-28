import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AttendeeList from '@/components/staff/AttendeeList'
import StaffBar from '@/components/staff/StaffBar'
import { requireAdmin } from '@/lib/auth/guard'
import {
  filterRoster,
  loadAttendance,
  parseRosterFilter,
  rosterCounts,
  type RosterFilter,
} from '@/lib/attendance'
import { getEvents } from '@/lib/events'
import { formatEventDate, formatEventTime, formatMoney } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Club Zero1 admin — event',
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ productId: string }>
  searchParams: Promise<{ show?: string; q?: string }>
}

const FILTER_LABELS: [RosterFilter, string][] = [
  ['all', 'All'],
  ['due', 'Not yet'],
  ['in', 'Checked in'],
  ['unpaid', 'Unpaid'],
  ['refunded', 'Refunded'],
]

function filterHref(filter: RosterFilter, query: string) {
  const params = new URLSearchParams()
  if (filter !== 'all') params.set('show', filter)
  if (query) params.set('q', query)
  const search = params.toString()
  return search ? `?${search}` : '?'
}

export default async function AdminEventPage({ params, searchParams }: Props) {
  const session = await requireAdmin()
  const { productId } = await params
  const { show, q } = await searchParams
  const filter = parseRosterFilter(show)
  const query = (q ?? '').trim()

  const [{ events }, attendance] = await Promise.all([getEvents(), loadAttendance()])
  const event = events.find((item) => item.productId === productId)
  const stats = attendance.byProduct.get(productId)
  // Off the store and no orders either: nothing to show.
  if (!event && !stats) notFound()

  const all = stats?.attendees ?? []
  const counts = rosterCounts(all)
  const attendees = filterRoster(all, filter, query)
  const seatsLeft = event?.variants.reduce(
    (total, variant) => total + (variant.quantityAvailable ?? 0),
    0
  )
  const currency = stats?.currencyCode ?? event?.currencyCode ?? 'INR'

  return (
    <main className="admin">
      <StaffBar
        session={session}
        title={event?.title ?? stats?.eventTitle ?? 'Event'}
        action={
          <Link className="staff-bar__back" href="/admin">
            All events
          </Link>
        }
      />

      <p className="admin__subtitle">
        {event ? (
          <>
            {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt, event.endsAt)}
            <br />
            {event.venue ? `${event.venue} · ${event.city}` : event.city}
          </>
        ) : (
          'No longer on the store. Numbers come from its orders.'
        )}
      </p>

      <section className="admin__totals" aria-label="Event totals">
        <div className="admin__total">
          <span className="admin__total-value">{stats?.sold ?? 0}</span>
          <span className="admin__total-label">Sold</span>
        </div>
        <div className="admin__total">
          <span className="admin__total-value">{stats?.checkedIn ?? 0}</span>
          <span className="admin__total-label">Checked in</span>
        </div>
        <div className="admin__total">
          <span className="admin__total-value">{seatsLeft ?? '—'}</span>
          <span className="admin__total-label">Seats left</span>
        </div>
        <div className="admin__total">
          <span className="admin__total-value">{formatMoney(stats?.revenue ?? 0, currency)}</span>
          <span className="admin__total-label">Paid revenue</span>
        </div>
      </section>

      <div className="admin__actions">
        <a className="admin__action" href={`/admin/events/${productId}/export`} download>
          Download CSV
        </a>
        <Link className="admin__action" href="/checker/scan">
          Scan tickets
        </Link>
      </div>

      <h2 className="admin__heading">Guests</h2>

      <form className="admin-search" method="get" role="search">
        {filter !== 'all' && <input type="hidden" name="show" value={filter} />}
        <label className="admin-search__label" htmlFor="AdminGuestSearch">
          Search guests
        </label>
        <div className="admin-search__row">
          <input
            className="admin-search__input"
            id="AdminGuestSearch"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Name, email, phone or code"
            autoComplete="off"
          />
          <button className="admin-search__submit" type="submit">
            Search
          </button>
        </div>
      </form>

      <nav className="checker-filter" aria-label="Filter guests">
        {FILTER_LABELS.filter(
          ([value]) => value === 'all' || value === 'due' || value === 'in' || counts[value] > 0 || filter === value
        ).map(([value, label]) => (
          <Link
            key={value}
            className={`checker-filter__option${
              filter === value ? ' checker-filter__option--active' : ''
            }`}
            href={filterHref(value, query)}
            scroll={false}
          >
            {label} <span className="checker-filter__count">{counts[value]}</span>
          </Link>
        ))}
      </nav>

      {query && (
        <p className="admin__subtitle">
          {attendees.length} match{attendees.length === 1 ? '' : 'es'} for &ldquo;{query}&rdquo;
          {' · '}
          <Link href={filterHref(filter, '')}>Clear search</Link>
        </p>
      )}

      <AttendeeList
        attendees={attendees}
        linkToCheckin
        showContact
        emptyText={all.length === 0 ? undefined : 'No guests match.'}
      />
    </main>
  )
}
