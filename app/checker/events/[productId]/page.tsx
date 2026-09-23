import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AttendeeList from '@/components/staff/AttendeeList'
import StaffBar from '@/components/staff/StaffBar'
import { requireStaff } from '@/lib/auth/guard'
import { loadAttendance } from '@/lib/attendance'
import { getEvents } from '@/lib/events'
import { formatEventDate, formatEventTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Club Zero1 door — guests',
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ productId: string }>
  searchParams: Promise<{ show?: string }>
}

export default async function CheckerEventPage({ params, searchParams }: Props) {
  const session = await requireStaff()
  const { productId } = await params
  const { show } = await searchParams

  const [{ events }, attendance] = await Promise.all([getEvents(), loadAttendance()])
  const event = events.find((item) => item.productId === productId)
  if (!event) notFound()

  const stats = attendance.byProduct.get(productId)
  const all = stats?.attendees ?? []
  const filter = show === 'in' || show === 'due' ? show : 'all'
  const attendees =
    filter === 'in'
      ? all.filter((attendee) => attendee.checkedInAt)
      : filter === 'due'
        ? all.filter((attendee) => !attendee.checkedInAt)
        : all

  const checkedIn = all.filter((attendee) => attendee.checkedInAt).length

  return (
    <main className="checker">
      <StaffBar
        session={session}
        title={event.title}
        action={
          <Link className="staff-bar__back" href="/checker">
            Events
          </Link>
        }
      />

      <p className="checker__subtitle">
        {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt, event.endsAt)}
        <br />
        {event.venue ? `${event.venue} · ${event.city}` : event.city}
      </p>

      <p className="checker__tally">
        <strong>{checkedIn}</strong> in · <strong>{all.length - checkedIn}</strong> still to come
      </p>

      <nav className="checker-filter" aria-label="Filter guests">
        {(
          [
            ['all', 'All', all.length],
            ['due', 'Not yet', all.length - checkedIn],
            ['in', 'Checked in', checkedIn],
          ] as const
        ).map(([value, label, count]) => (
          <Link
            key={value}
            className={`checker-filter__option${
              filter === value ? ' checker-filter__option--active' : ''
            }`}
            href={value === 'all' ? `?` : `?show=${value}`}
            scroll={false}
          >
            {label} <span className="checker-filter__count">{count}</span>
          </Link>
        ))}
      </nav>

      <AttendeeList attendees={attendees} linkToCheckin />

      <Link className="checker__scan-cta checker__scan-cta--sticky" href="/checker/scan">
        Scan a ticket
      </Link>
    </main>
  )
}
