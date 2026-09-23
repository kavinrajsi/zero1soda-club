import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { admin } from './shopify'

export const TICKET_METAFIELD = { namespace: 'club', key: 'ticket_key' }
export const CHECKIN_METAFIELD = { namespace: 'club', key: 'checked_in' }

export type TicketRef = {
  orderId: string
  lineItemId: string
  /** 1-based index of this ticket within its line item. */
  index: number
  total: number
}

export type TicketPayment = {
  id: string
  kind: string
  status: string
  gateway: string
  paymentId: string | null
  processedAt: string | null
  amount: string
  currencyCode: string
}

export type TicketDetails = TicketRef & {
  orderName: string
  event: string
  city: string
  venue: string
  startsAt: string | null
  buyerName: string
  buyerEmail: string
  quantity: number
  paid: boolean
  checkedInAt: string | null
  financialStatus: string
  note: string | null
  orderedAt: string | null
  /** Price of one ticket on this line, not the whole line. */
  unitPrice: string
  currencyCode: string
  payments: TicketPayment[]
}

function secret(): string {
  const value = process.env.TICKET_SECRET
  if (!value || value.length < 16) {
    throw new Error('TICKET_SECRET is missing or too short (32+ random chars).')
  }
  return value
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 27)
}

/** Opaque, tamper-proof handle for one ticket. Carries no readable order data. */
export function encodeTicket(ref: TicketRef): string {
  const payload = [ref.orderId, ref.lineItemId, ref.index, ref.total].join('~')
  const body = Buffer.from(payload).toString('base64url')
  return `${body}.${sign(payload)}`
}

export function decodeTicket(token: string): TicketRef | null {
  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  let payload: string
  try {
    payload = Buffer.from(body, 'base64url').toString()
  } catch {
    return null
  }

  const expected = sign(payload)
  if (expected.length !== signature.length) return null
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null

  const [orderId, lineItemId, index, total] = payload.split('~')
  if (!orderId || !lineItemId) return null
  return { orderId, lineItemId, index: Number(index), total: Number(total) }
}

export function newTicketKey(): string {
  return randomBytes(24).toString('base64url')
}

export function ticketSlotKey(ref: TicketRef): string {
  return `${ref.lineItemId}:${ref.index}`
}

const ORDER_QUERY = /* GraphQL */ `
  query ClubTicketOrder($id: ID!) {
    order(id: $id) {
      id
      name
      displayFinancialStatus
      processedAt
      note
      email
      transactions(first: 10) {
        id
        kind
        status
        gateway
        formattedGateway
        paymentId
        processedAt
        amountSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
      customer {
        displayName
      }
      ticketKey: metafield(namespace: "club", key: "ticket_key") {
        value
      }
      checkedIn: metafield(namespace: "club", key: "checked_in") {
        value
      }
      lineItems(first: 50) {
        nodes {
          id
          title
          quantity
          originalUnitPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          customAttributes {
            key
            value
          }
          product {
            id
            productType
            city: metafield(namespace: "event", key: "city") {
              value
            }
            venue: metafield(namespace: "event", key: "venue") {
              value
            }
            startsAt: metafield(namespace: "event", key: "starts_at") {
              value
            }
          }
        }
      }
    }
  }
`

type OrderResult = {
  order: {
    id: string
    name: string
    displayFinancialStatus: string | null
    processedAt: string | null
    note: string | null
    email: string | null
    transactions: {
      id: string
      kind: string
      status: string
      gateway: string
      formattedGateway: string | null
      paymentId: string | null
      processedAt: string | null
      amountSet: { shopMoney: { amount: string; currencyCode: string } } | null
    }[]
    customer: { displayName: string | null } | null
    ticketKey: { value: string } | null
    checkedIn: { value: string } | null
    lineItems: {
      nodes: {
        id: string
        title: string
        quantity: number
        originalUnitPriceSet: { shopMoney: { amount: string; currencyCode: string } } | null
        customAttributes: { key: string; value: string | null }[]
        product: {
          id: string
          productType: string
          city: { value: string } | null
          venue: { value: string } | null
          startsAt: { value: string } | null
        } | null
      }[]
    }
  } | null
}

export function orderGid(orderId: string) {
  return orderId.startsWith('gid://') ? orderId : `gid://shopify/Order/${orderId}`
}

export function lineItemGid(lineItemId: string) {
  return lineItemId.startsWith('gid://') ? lineItemId : `gid://shopify/LineItem/${lineItemId}`
}

function checkedInMap(value: string | null | undefined): Record<string, string> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Resolves a ticket against the live order. Returns null when it doesn't exist. */
export async function loadTicket(ref: TicketRef): Promise<TicketDetails | null> {
  const data = await admin<OrderResult>(ORDER_QUERY, { id: orderGid(ref.orderId) })
  const order = data.order
  if (!order) return null

  const wanted = lineItemGid(ref.lineItemId)
  const line = order.lineItems.nodes.find((node) => node.id === wanted)
  if (!line) return null
  if (line.product?.productType !== 'Event ticket') return null
  if (ref.index < 1 || ref.index > line.quantity) return null

  const attribute = (key: string) =>
    line.customAttributes.find((item) => item.key === key)?.value || ''

  return {
    ...ref,
    orderName: order.name,
    event: attribute('Event') || line.title,
    city: attribute('City') || line.product.city?.value || '',
    venue: attribute('Venue') || line.product.venue?.value || '',
    startsAt: line.product.startsAt?.value ?? null,
    buyerName: attribute('Booking name') || order.customer?.displayName || '',
    buyerEmail: attribute('Booking email') || order.email || '',
    quantity: line.quantity,
    paid: order.displayFinancialStatus === 'PAID',
    checkedInAt: checkedInMap(order.checkedIn?.value)[ticketSlotKey(ref)] ?? null,
    financialStatus: order.displayFinancialStatus ?? 'UNKNOWN',
    note: order.note,
    orderedAt: order.processedAt,
    unitPrice: line.originalUnitPriceSet?.shopMoney.amount ?? '0',
    currencyCode: line.originalUnitPriceSet?.shopMoney.currencyCode ?? 'INR',
    payments: order.transactions.map((transaction) => ({
      id: transaction.id.split('/').pop() || transaction.id,
      kind: transaction.kind,
      status: transaction.status,
      gateway: transaction.formattedGateway || transaction.gateway,
      paymentId: transaction.paymentId,
      processedAt: transaction.processedAt,
      amount: transaction.amountSet?.shopMoney.amount ?? '0',
      currencyCode: transaction.amountSet?.shopMoney.currencyCode ?? 'INR',
    })),
  }
}

export async function readTicketKey(orderId: string): Promise<string | null> {
  const data = await admin<OrderResult>(ORDER_QUERY, { id: orderGid(orderId) })
  return data.order?.ticketKey?.value ?? null
}

const METAFIELDS_SET = /* GraphQL */ `
  mutation ClubTicketMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors {
        field
        message
      }
    }
  }
`

export async function writeTicketKey(orderId: string, key: string) {
  await admin(METAFIELDS_SET, {
    metafields: [
      {
        ownerId: orderGid(orderId),
        namespace: TICKET_METAFIELD.namespace,
        key: TICKET_METAFIELD.key,
        type: 'single_line_text_field',
        value: key,
      },
    ],
  })
}

/**
 * Records a check-in. Returns the existing timestamp when the ticket was
 * already used, which is the whole point of scanning at the door.
 */
export async function markCheckedIn(
  ref: TicketRef
): Promise<{ alreadyUsed: boolean; at: string }> {
  const data = await admin<OrderResult>(ORDER_QUERY, { id: orderGid(ref.orderId) })
  const existing = checkedInMap(data.order?.checkedIn?.value)
  const slot = ticketSlotKey(ref)

  if (existing[slot]) return { alreadyUsed: true, at: existing[slot] }

  const at = new Date().toISOString()
  const next = { ...existing, [slot]: at }

  await admin(METAFIELDS_SET, {
    metafields: [
      {
        ownerId: orderGid(ref.orderId),
        namespace: CHECKIN_METAFIELD.namespace,
        key: CHECKIN_METAFIELD.key,
        type: 'json',
        value: JSON.stringify(next),
      },
    ],
  })

  return { alreadyUsed: false, at }
}
