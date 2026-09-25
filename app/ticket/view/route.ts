import { NextResponse } from 'next/server'
import { encodeTicket, ticketKeyMatches } from '@/lib/tickets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Entry point for the "view your ticket" link in the order email. Liquid can't
 * sign a token, so it passes the order's key and this swaps it for one.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const orderId = params.get('o') || ''
  const lineItemId = params.get('l') || ''
  const index = Number(params.get('n') || '1')
  const total = Number(params.get('t') || '1')
  const key = params.get('k') || ''

  if (!orderId || !lineItemId || !key || !Number.isInteger(index) || index < 1) {
    return new NextResponse('bad request', { status: 400 })
  }

  try {
    if (!(await ticketKeyMatches(orderId, key))) {
      return new NextResponse('not found', { status: 404 })
    }
  } catch (error) {
    console.error('[club-zero1] ticket view lookup failed', error)
    return new NextResponse('unavailable', { status: 500 })
  }

  const token = encodeTicket({ orderId, lineItemId, index, total })
  return NextResponse.redirect(new URL(`/ticket/${token}`, request.url))
}
