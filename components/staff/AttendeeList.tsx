import Link from 'next/link'
import type { Attendee } from '@/lib/attendance'

function formatStamp(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

type Props = {
  attendees: Attendee[]
  /** Checkers get a link straight to the check-in screen for each ticket. */
  linkToCheckin?: boolean
  /** Admins see each guest's email and phone under the row. */
  showContact?: boolean
  /** Shown when the list is empty, e.g. because a filter matched nothing. */
  emptyText?: string
}

export default function AttendeeList({
  attendees,
  linkToCheckin = false,
  showContact = false,
  emptyText = 'No tickets sold for this event yet.',
}: Props) {
  if (attendees.length === 0) {
    return <p className="roster__empty">{emptyText}</p>
  }

  return (
    <ul className="roster">
      {attendees.map((attendee) => {
        const status =
          attendee.payment === 'refunded'
            ? 'refunded'
            : attendee.checkedInAt
              ? 'in'
              : attendee.payment === 'paid'
                ? 'due'
                : 'unpaid'
        const row = (
          <>
            <span className="roster__who">
              <strong className="roster__name">{attendee.name || 'Guest'}</strong>
              <small className="roster__detail">
                {attendee.code}
                {attendee.quantity > 1 ? ` · ticket ${attendee.index} of ${attendee.quantity}` : ''}
              </small>
            </span>
            <span className={`roster__status roster__status--${status}`}>
              {status === 'in' && `In ${formatStamp(attendee.checkedInAt as string)}`}
              {status === 'due' && 'Not yet'}
              {status === 'unpaid' && 'Unpaid'}
              {status === 'refunded' && 'Refunded'}
            </span>
          </>
        )

        return (
          <li className="roster__item" key={`${attendee.lineItemId}:${attendee.index}`}>
            {linkToCheckin ? (
              <Link className="roster__link" href={`/checkin/${attendee.token}`}>
                {row}
              </Link>
            ) : (
              <span className="roster__link roster__link--static">{row}</span>
            )}
            {showContact && (attendee.email || attendee.phone) && (
              <p className="roster__contact">
                {attendee.email && <a href={`mailto:${attendee.email}`}>{attendee.email}</a>}
                {attendee.phone && <a href={`tel:${attendee.phone}`}>{attendee.phone}</a>}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
