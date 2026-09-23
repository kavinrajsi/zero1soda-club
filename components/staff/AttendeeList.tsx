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
}

export default function AttendeeList({ attendees, linkToCheckin = false }: Props) {
  if (attendees.length === 0) {
    return <p className="roster__empty">No tickets sold for this event yet.</p>
  }

  return (
    <ul className="roster">
      {attendees.map((attendee) => {
        const status = attendee.checkedInAt ? 'in' : attendee.paid ? 'due' : 'unpaid'
        const row = (
          <>
            <span className="roster__who">
              <strong className="roster__name">{attendee.name || 'Guest'}</strong>
              <small className="roster__detail">
                {attendee.orderName}
                {attendee.quantity > 1 ? ` · ticket ${attendee.index} of ${attendee.quantity}` : ''}
              </small>
            </span>
            <span className={`roster__status roster__status--${status}`}>
              {status === 'in' && `In ${formatStamp(attendee.checkedInAt as string)}`}
              {status === 'due' && 'Not yet'}
              {status === 'unpaid' && 'Unpaid'}
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
          </li>
        )
      })}
    </ul>
  )
}
