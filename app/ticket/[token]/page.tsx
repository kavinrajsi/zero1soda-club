import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { decodeTicket, loadTicket } from '@/lib/tickets'
import { formatEventDate, formatEventTime } from '@/lib/format'
import { parseEventTime } from '@/lib/events'
import { SITE } from '@/lib/site'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your Club Zero1 ticket',
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ token: string }> }

export default async function TicketPage({ params }: Props) {
  const { token } = await params
  const ref = decodeTicket(token)
  if (!ref) notFound()

  const ticket = await loadTicket(ref)
  if (!ticket) notFound()

  const startsAt = parseEventTime(ticket.startsAt)
  const qr = `/api/ticket/qr?size=320&token=${encodeURIComponent(token)}`

  return (
    <div className="z1 z1-ticket-page">
      <div className="z1-ticket">
        <p className="z1-kicker">CLUB ZERO1 · {ticket.orderName}</p>
        <h1>{ticket.event}</h1>
        <p className="z1-ticket-where">
          {ticket.venue ? `${ticket.venue} · ${ticket.city}` : ticket.city}
        </p>
        {startsAt !== null && (
          <p className="z1-ticket-when">
            {formatEventDate(startsAt)} · {formatEventTime(startsAt, startsAt)}
          </p>
        )}

        <div className="z1-ticket-qr">
          {/* Not next/image: the PNG is generated per ticket and never reused. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Ticket QR code" width={320} height={320} />
        </div>

        <dl className="z1-ticket-meta">
          <div>
            <dt>Ticket</dt>
            <dd>
              {ticket.index} of {ticket.quantity}
            </dd>
          </div>
          <div>
            <dt>Name</dt>
            <dd>{ticket.buyerName || '—'}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{ticket.checkedInAt ? 'Checked in' : ticket.paid ? 'Valid' : 'Payment pending'}</dd>
          </div>
        </dl>

        <p className="z1-ticket-note">
          Show this at the door. One scan per ticket. Questions? Reply to your order email or visit{' '}
          <a href={SITE.storeUrl}>zero1soda.com</a>.
        </p>
      </div>
    </div>
  )
}
