import { timingSafeEqual } from 'node:crypto'
import QRCode from 'qrcode'
import { decodeTicket, encodeTicket, loadTicket, readTicketKey } from '@/lib/tickets'
import type { TicketRef } from '@/lib/tickets'
import { SITE } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function equal(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Renders one ticket's QR as a PNG. Two ways in:
 *
 * - `?token=` — a signed ticket handle, used by the hosted ticket page.
 * - `?o=&l=&n=&t=&k=` — raw ids plus the order's ticket key, used by the
 *   Shopify order email, whose Liquid can't compute a signature. The key is
 *   random per order, so a guessed order id alone mints nothing.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const size = Math.min(600, Math.max(120, Number(params.get('size') || '240')))
  const signed = params.get('token')

  let ref: TicketRef | null = null

  if (signed) {
    ref = decodeTicket(signed)
    if (!ref) return new Response('not found', { status: 404 })
  } else {
    const orderId = params.get('o') || ''
    const lineItemId = params.get('l') || ''
    const index = Number(params.get('n') || '1')
    const total = Number(params.get('t') || '1')
    const key = params.get('k') || ''

    if (!orderId || !lineItemId || !key || !Number.isInteger(index) || index < 1) {
      return new Response('bad request', { status: 400 })
    }

    try {
      const expectedKey = await readTicketKey(orderId)
      if (!expectedKey || !equal(expectedKey, key)) {
        return new Response('not found', { status: 404 })
      }
    } catch (error) {
      console.error('[club-zero1] ticket key lookup failed', error)
      return new Response('unavailable', { status: 500 })
    }

    ref = { orderId, lineItemId, index, total }
  }

  try {
    const ticket = await loadTicket(ref)
    if (!ticket) return new Response('not found', { status: 404 })

    const target = `${SITE.url}/checkin/${encodeTicket(ref)}`
    const png = await QRCode.toBuffer(target, {
      type: 'png',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#1C1212FF', light: '#FFFFFFFF' },
    })

    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        // Email clients re-fetch often; the QR never changes for a given ticket.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('[club-zero1] QR generation failed', error)
    return new Response('unavailable', { status: 500 })
  }
}
