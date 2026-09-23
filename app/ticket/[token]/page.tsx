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

function formatMoney(amount: string, currencyCode: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2,
  }).format(Number(amount))
}

function formatIssued(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(iso))
    .replace(', ', ' • ')
}

export default async function TicketPage({ params }: Props) {
  const { token } = await params
  const ref = decodeTicket(token)
  if (!ref) notFound()

  const ticket = await loadTicket(ref)
  if (!ticket) notFound()

  const startsAt = parseEventTime(ticket.startsAt)
  const qr = `/api/ticket/qr?size=420&token=${encodeURIComponent(token)}`
  const gateway = ticket.payments.find((payment) => payment.kind === 'SALE')?.gateway
  const refunded =
    ticket.financialStatus === 'REFUNDED' || ticket.financialStatus === 'PARTIALLY_REFUNDED'

  return (
    <div className="z1 z1-ticket-page">
      <div className="z1-receipt">
        <header className="z1-receipt-head">
          <p className="z1-receipt-mark" aria-hidden="true">
            🎉
          </p>
          <h1>THANK YOU!</h1>
          <p>
            {ticket.quantity > 1
              ? `Ticket ${ticket.index} of ${ticket.quantity} has been issued`
              : 'Your ticket has been issued successfully'}
          </p>
        </header>

        <div className="z1-receipt-perforation" aria-hidden="true" />

        <div className="z1-receipt-body">
          <dl className="z1-receipt-grid">
            <div>
              <dt>Ticket ID</dt>
              <dd>
                {ticket.orderName.replace('#', '')}-{ticket.index}
              </dd>
            </div>
            <div className="z1-receipt-right">
              <dt>Amount</dt>
              <dd>{formatMoney(ticket.unitPrice, ticket.currencyCode)}</dd>
            </div>
            <div className="z1-receipt-full">
              <dt>Event</dt>
              <dd>{ticket.event}</dd>
            </div>
            <div>
              <dt>Date &amp; time</dt>
              <dd>
                {startsAt !== null
                  ? `${formatEventDate(startsAt)} • ${formatEventTime(startsAt, startsAt)}`
                  : 'To be announced'}
              </dd>
            </div>
            <div className="z1-receipt-right">
              <dt>Venue</dt>
              <dd>{ticket.venue || ticket.city}</dd>
            </div>
          </dl>

          <div className="z1-receipt-payer">
            <span className="z1-receipt-avatar" aria-hidden="true">
              {(ticket.buyerName || 'Z').charAt(0).toUpperCase()}
            </span>
            <span>
              <strong>{ticket.buyerName || 'Club Zero1 guest'}</strong>
              <small>{gateway || ticket.buyerEmail}</small>
            </span>
          </div>

          {refunded && <p className="z1-receipt-void">Refunded — this ticket is no longer valid.</p>}
          {ticket.checkedInAt && <p className="z1-receipt-used">Checked in at the door.</p>}
        </div>

        <div className="z1-receipt-stub">
          {/* Generated per ticket, so next/image would only add a hop. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Ticket QR code" width={420} height={420} />
          <p>Show this at the door</p>
        </div>
      </div>

      <p className="z1-receipt-footer">
        Questions? Reply to your order email or visit <a href={SITE.storeUrl}>zero1soda.com</a>
      </p>
    </div>
  )
}
