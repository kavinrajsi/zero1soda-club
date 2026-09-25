import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { adminRest } from '@/lib/shopify'
import { verifySessionToken } from '@/lib/session-token'
import { listOrderTickets, orderGid } from '@/lib/tickets'
import { SITE } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Extensions run in a sandboxed worker with no fixed origin; auth is the bearer token. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store' } })
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * Tickets for the thank-you page extension. The session token only proves the
 * call came from this shop's checkout; the checkout token is what proves it is
 * this buyer's order, since it is secret to their checkout session.
 */
export async function POST(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!verifySessionToken(bearer)) return reply({ status: 'unauthorized' }, 401)

  let body: { orderId?: string; checkoutToken?: string }
  try {
    body = await request.json()
  } catch {
    return reply({ status: 'bad-request' }, 400)
  }

  const orderId = orderGid(String(body.orderId || '')).split('/').pop() || ''
  const checkoutToken = String(body.checkoutToken || '')
  if (!/^\d+$/.test(orderId) || !checkoutToken) return reply({ status: 'bad-request' }, 400)

  try {
    const rest = await adminRest<{ order: { checkout_token: string | null } }>(
      `orders/${orderId}.json?fields=checkout_token`
    )
    // Not visible to the Admin API yet: the page loads before the order settles.
    if (!rest) return reply({ status: 'pending' }, 202)

    const expected = rest.order.checkout_token || ''
    if (
      expected.length !== checkoutToken.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(checkoutToken))
    ) {
      return reply({ status: 'not-found' }, 404)
    }

    const found = await listOrderTickets(orderId)
    if (!found) return reply({ status: 'pending' }, 202)

    return reply({
      status: 'ready',
      orderName: found.orderName,
      tickets: found.tickets.map((ticket) => ({
        code: ticket.code,
        event: ticket.event,
        index: ticket.index,
        total: ticket.total,
        checkinUrl: `${SITE.url}/checkin/${ticket.token}`,
        ticketUrl: `${SITE.url}/ticket/${ticket.token}`,
      })),
    })
  } catch (error) {
    console.error('[club-zero1] thank-you tickets failed', error)
    return reply({ status: 'unavailable' }, 503)
  }
}
