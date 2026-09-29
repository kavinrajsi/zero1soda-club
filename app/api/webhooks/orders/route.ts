import { createHmac, timingSafeEqual } from 'node:crypto'
import { after, NextResponse } from 'next/server'
import { logToSheet } from '@/lib/sheets'
import { newTicketKey, readTicketKey, writeTicketKey } from '@/lib/tickets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Property = { name?: string; value?: string }

type OrderPayload = {
  id?: number
  admin_graphql_api_id?: string
  name?: string
  email?: string | null
  phone?: string | null
  financial_status?: string
  total_price?: string
  currency?: string
  note_attributes?: Property[]
  line_items?: { product_id?: number; title?: string; quantity?: number; properties?: Property[] }[]
}

const CLUB_SOURCE = 'club.zero1soda.com'

function property(list: Property[] | undefined, name: string) {
  return list?.find((entry) => entry.name === name)?.value?.trim() || ''
}

/** The subscription is store-wide; only orders from this site's checkout belong in the sheet. */
function isClubOrder(payload: OrderPayload) {
  if (property(payload.note_attributes, 'Source') === CLUB_SOURCE) return true
  return Boolean(
    payload.line_items?.some(
      (line) => property(line.properties, 'Event') || property(line.properties, 'Booking email')
    )
  )
}

function orderRow(payload: OrderPayload, orderId: string) {
  const lines = payload.line_items ?? []
  const booked = (name: string) =>
    lines.map((line) => property(line.properties, name)).find(Boolean) || ''

  // Order-level contact can be redacted without protected customer data access;
  // the booking properties the checkout route set are always there.
  return [
    payload.name || '',
    orderId,
    booked('Booking name'),
    booked('Booking email') || payload.email || '',
    booked('Booking phone') || payload.phone || '',
    booked('Event'),
    payload.financial_status || '',
    payload.total_price || '',
    payload.currency || '',
    lines.map((line) => `${line.title ?? ''} × ${line.quantity ?? 0}`).join('; '),
  ]
}

/**
 * orders/create webhook. Gives every order an unguessable ticket key, which is
 * what lets the order email build QR URLs without being able to sign them.
 */
export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_APP_CLIENT_SECRET
  if (!secret) {
    console.error('[club-zero1] webhook secret is not configured')
    return new NextResponse('not configured', { status: 500 })
  }

  const body = await request.text()
  const received = request.headers.get('x-shopify-hmac-sha256') || ''
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('base64')

  if (
    received.length !== expected.length ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  ) {
    return new NextResponse('invalid signature', { status: 401 })
  }

  let payload: OrderPayload
  try {
    payload = JSON.parse(body)
  } catch {
    return new NextResponse('malformed payload', { status: 400 })
  }

  const orderId = payload.admin_graphql_api_id || (payload.id ? String(payload.id) : '')
  if (!orderId) return new NextResponse('no order id', { status: 400 })

  try {
    // Shopify retries webhooks; keep the first key so existing QR codes stay valid.
    if (await readTicketKey(orderId)) return NextResponse.json({ ok: true, existing: true })
    await writeTicketKey(orderId, newTicketKey())
    // Logged once, on the first delivery. A failed append is not retried: Shopify's
    // retries take the `existing` path above, and the sheet is only a mirror.
    if (isClubOrder(payload)) after(() => logToSheet('Orders', orderRow(payload, orderId)))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[club-zero1] ticket key write failed', error)
    return new NextResponse('retry', { status: 500 })
  }
}
