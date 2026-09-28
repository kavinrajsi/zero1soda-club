import { admin } from '@/lib/shopify'
import { EVENT_PRODUCT_TYPE } from '@/lib/events'
import { encodeTicket, formatTicketCode, paymentState, type PaymentState } from '@/lib/tickets'

/**
 * Shopify's read_orders scope only reaches back 60 days. Events inside that
 * window report exact numbers; anything older is flagged rather than guessed.
 */
export const ORDER_HISTORY_DAYS = 60

const ORDERS_QUERY = /* GraphQL */ `
  query ClubEventOrders($query: String!, $after: String) {
    orders(first: 100, query: $query, after: $after, sortKey: CREATED_AT) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        createdAt
        cancelledAt
        displayFinancialStatus
        checkedIn: metafield(namespace: "club", key: "checked_in") {
          value
        }
        lineItems(first: 50) {
          nodes {
            id
            quantity
            discountedTotalSet {
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
              title
              productType
            }
          }
        }
      }
    }
  }
`

type OrdersResult = {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: {
      id: string
      name: string
      createdAt: string
      cancelledAt: string | null
      displayFinancialStatus: string | null
      checkedIn: { value: string } | null
      lineItems: {
        nodes: {
          id: string
          quantity: number
          discountedTotalSet: { shopMoney: { amount: string; currencyCode: string } } | null
          customAttributes: { key: string; value: string | null }[]
          product: { id: string; title: string; productType: string } | null
        }[]
      }
    }[]
  }
}

export type Attendee = {
  /** Signed handle for this exact ticket, so the list can link to check-in. */
  token: string
  orderId: string
  orderName: string
  lineItemId: string
  index: number
  quantity: number
  /** Short code staff can type at the door, e.g. "z1s1042-2". */
  code: string
  name: string
  email: string
  phone: string
  payment: PaymentState
  checkedInAt: string | null
}

export type EventAttendance = {
  productId: string
  /** From the booking, so an event taken off the store still has a name. */
  eventTitle: string
  /** Live tickets: refunded ones are listed but not counted here. */
  sold: number
  checkedIn: number
  unpaid: number
  refunded: number
  /** Paid line totals after line discounts. */
  revenue: number
  currencyCode: string
  attendees: Attendee[]
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

function attribute(
  attributes: { key: string; value: string | null }[],
  key: string
): string {
  return attributes.find((item) => item.key === key)?.value || ''
}

/**
 * One pass over recent orders, bucketed by event product. Cheaper than querying
 * per event: Shopify order search cannot filter by product, so any per-event
 * query would scan the same pages again.
 */
export async function loadAttendance(): Promise<{
  byProduct: Map<string, EventAttendance>
  since: string
}> {
  const since = new Date(Date.now() - ORDER_HISTORY_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const search = `created_at:>=${since} AND status:any`

  const byProduct = new Map<string, EventAttendance>()
  let after: string | null = null

  do {
    const data: OrdersResult = await admin<OrdersResult>(ORDERS_QUERY, {
      query: search,
      after,
    })

    for (const order of data.orders.nodes) {
      // A cancelled order never happened as far as the door is concerned.
      if (order.cancelledAt) continue

      const used = checkedInMap(order.checkedIn?.value)
      const payment = paymentState(order.displayFinancialStatus)
      // Numbered across the order's event lines, as ticketSlots() does in lib/tickets.ts.
      let position = 0

      for (const line of order.lineItems.nodes) {
        if (line.product?.productType !== EVENT_PRODUCT_TYPE) continue

        const productId = line.product.id.split('/').pop() as string
        const orderId = order.id.split('/').pop() as string
        const lineItemId = line.id.split('/').pop() as string
        const total = line.discountedTotalSet?.shopMoney

        const bucket: EventAttendance = byProduct.get(productId) ?? {
          productId,
          eventTitle: attribute(line.customAttributes, 'Event') || line.product.title,
          sold: 0,
          checkedIn: 0,
          unpaid: 0,
          refunded: 0,
          revenue: 0,
          currencyCode: total?.currencyCode ?? 'INR',
          attendees: [],
        }

        if (payment === 'refunded') {
          bucket.refunded += line.quantity
        } else {
          bucket.sold += line.quantity
          if (payment === 'unpaid') bucket.unpaid += line.quantity
          if (payment === 'paid') bucket.revenue += Number(total?.amount ?? 0)
        }

        for (let index = 1; index <= line.quantity; index += 1) {
          position += 1
          const checkedInAt = used[`${lineItemId}:${index}`] ?? null
          if (checkedInAt && payment !== 'refunded') bucket.checkedIn += 1

          bucket.attendees.push({
            token: encodeTicket({ orderId, lineItemId, index, total: line.quantity }),
            orderId,
            orderName: order.name,
            lineItemId,
            index,
            quantity: line.quantity,
            code: formatTicketCode(order.name, position),
            name: attribute(line.customAttributes, 'Booking name'),
            email: attribute(line.customAttributes, 'Booking email'),
            phone: attribute(line.customAttributes, 'Booking phone'),
            payment,
            checkedInAt,
          })
        }

        byProduct.set(productId, bucket)
      }
    }

    after = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null
  } while (after)

  for (const bucket of byProduct.values()) {
    bucket.attendees.sort(
      (a, b) => a.name.localeCompare(b.name) || a.index - b.index
    )
  }

  return { byProduct, since }
}

export type RosterFilter = 'all' | 'in' | 'due' | 'unpaid' | 'refunded'

const ROSTER_FILTERS: RosterFilter[] = ['all', 'in', 'due', 'unpaid', 'refunded']

/** Reads a `?show=` value, falling back to everyone. */
export function parseRosterFilter(value: string | undefined): RosterFilter {
  return ROSTER_FILTERS.includes(value as RosterFilter) ? (value as RosterFilter) : 'all'
}

/** Refunded tickets never count as coming: they are only listed for the record. */
function matchesFilter(attendee: Attendee, filter: RosterFilter): boolean {
  const live = attendee.payment !== 'refunded'
  switch (filter) {
    case 'in':
      return live && !!attendee.checkedInAt
    case 'due':
      return live && !attendee.checkedInAt
    case 'unpaid':
      return attendee.payment === 'unpaid'
    case 'refunded':
      return !live
    default:
      return true
  }
}

export function rosterCounts(attendees: Attendee[]): Record<RosterFilter, number> {
  const counts = { all: attendees.length, in: 0, due: 0, unpaid: 0, refunded: 0 }
  for (const attendee of attendees) {
    for (const filter of ['in', 'due', 'unpaid', 'refunded'] as const) {
      if (matchesFilter(attendee, filter)) counts[filter] += 1
    }
  }
  return counts
}

/** Filter, then a loose match on name, email, phone or ticket code. */
export function filterRoster(attendees: Attendee[], filter: RosterFilter, query = ''): Attendee[] {
  const needle = query.trim().toLowerCase().replace(/^#/, '')
  return attendees.filter((attendee) => {
    if (!matchesFilter(attendee, filter)) return false
    if (!needle) return true
    return [attendee.name, attendee.email, attendee.phone, attendee.code].some((field) =>
      field.toLowerCase().includes(needle)
    )
  })
}
