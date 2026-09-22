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
