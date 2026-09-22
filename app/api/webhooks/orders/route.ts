import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { newTicketKey, readTicketKey, writeTicketKey } from '@/lib/tickets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  let payload: { id?: number; admin_graphql_api_id?: string; line_items?: { product_id?: number }[] }
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
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[club-zero1] ticket key write failed', error)
    return new NextResponse('retry', { status: 500 })
  }
}
