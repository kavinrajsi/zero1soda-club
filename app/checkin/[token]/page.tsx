import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { decodeTicket, loadTicket } from '@/lib/tickets'
import { formatEventDate, formatEventTime } from '@/lib/format'
import { parseEventTime } from '@/lib/events'
import { isStaff } from '@/lib/checkin-auth'
import { checkIn, signIn } from './actions'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Club Zero1 check-in',
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ token: string }> }

function formatMoney(amount: string, currencyCode: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
  }).format(Number(amount))
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

function formatStamp(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export default async function CheckinPage({ params }: Props) {
  const { token } = await params
  const ref = decodeTicket(token)
  if (!ref) notFound()

  // The buyer has this URL too, so nothing about the ticket is shown unlocked.
  if (!(await isStaff())) {
    return (
      <div className="z1 z1-checkin z1-checkin--locked">
        <form action={signIn} className="z1-checkin-card">
          <p className="z1-kicker">CLUB ZERO1</p>
          <h1>Door check-in</h1>
          <p>Staff only. Enter the passcode to validate tickets on this device.</p>
          <label>
            Staff passcode
            <input name="passcode" type="password" autoComplete="one-time-code" required autoFocus />
          </label>
          <button type="submit" className="z1-pill z1-submit">
            Unlock
          </button>
        </form>
      </div>
    )
  }

  const ticket = await loadTicket(ref)
  if (!ticket) {
    return (
      <div className="z1 z1-checkin z1-checkin--invalid">
        <div className="z1-checkin-card">
          <h1>NOT VALID</h1>
          <p>This code doesn&rsquo;t match any ticket on this store.</p>
        </div>
      </div>
    )
  }

  const startsAt = parseEventTime(ticket.startsAt)
  const used = ticket.checkedInAt !== null
  const state = !ticket.paid ? 'unpaid' : used ? 'used' : 'valid'

  return (
    <div className={`z1 z1-checkin z1-checkin--${state}`}>
      <div className="z1-checkin-card">
        <h1>
          {state === 'valid' && 'VALID'}
          {state === 'used' && 'ALREADY USED'}
          {state === 'unpaid' && 'NOT PAID'}
        </h1>

        <p className="z1-checkin-event">{ticket.event}</p>
        <p className="z1-checkin-when">
          {startsAt !== null
            ? `${formatEventDate(startsAt)} · ${formatEventTime(startsAt, startsAt)}`
            : ''}
          {ticket.venue ? ` · ${ticket.venue}` : ''}
        </p>

        <dl className="z1-checkin-meta">
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
            <dt>Order</dt>
            <dd>{ticket.orderName}</dd>
          </div>
          {used && (
            <div>
              <dt>Checked in</dt>
              <dd>{formatStamp(ticket.checkedInAt as string)}</dd>
            </div>
          )}
        </dl>

        <details className="z1-checkin-more">
          <summary>
            More
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="20px"
              viewBox="0 -960 960 960"
              width="20px"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" />
            </svg>
          </summary>

          <dl className="z1-checkin-meta">
            <div>
              <dt>Payment status</dt>
              <dd>{titleCase(ticket.financialStatus.replace(/_/g, ' '))}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{ticket.buyerEmail || '—'}</dd>
            </div>
          </dl>

          {ticket.payments.length === 0 ? (
            <p className="z1-checkin-empty">No payments recorded on this order.</p>
          ) : (
            ticket.payments.map((payment) => (
              <dl className="z1-checkin-meta z1-checkin-payment" key={payment.id}>
                <div>
                  <dt>Amount</dt>
                  <dd>{formatMoney(payment.amount, payment.currencyCode)}</dd>
                </div>
                <div>
                  <dt>Gateway</dt>
                  <dd>{payment.gateway}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{titleCase(payment.status)}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{titleCase(payment.kind)}</dd>
                </div>
                {payment.paymentId && (
                  <div>
                    <dt>Payment ID</dt>
                    <dd className="z1-checkin-id">{payment.paymentId}</dd>
                  </div>
                )}
                {payment.processedAt && (
                  <div>
                    <dt>Created</dt>
                    <dd>{formatStamp(payment.processedAt)}</dd>
                  </div>
                )}
              </dl>
            ))
          )}

          {ticket.note && (
            <dl className="z1-checkin-meta">
              <div>
                <dt>Note</dt>
                <dd>{ticket.note}</dd>
              </div>
            </dl>
          )}
        </details>

        {state === 'valid' && (
          <form action={checkIn}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="z1-pill z1-submit">
              Mark checked in
            </button>
          </form>
        )}

        {state === 'unpaid' && <p>Payment is not complete on this order. Do not admit.</p>}
      </div>
    </div>
  )
}
