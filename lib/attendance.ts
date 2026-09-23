import { admin } from '@/lib/shopify'
import { EVENT_PRODUCT_TYPE } from '@/lib/events'
import { encodeTicket } from '@/lib/tickets'

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
        displayFinancialStatus
        checkedIn: metafield(namespace: "club", key: "checked_in") {
          value
        }
        lineItems(first: 20) {
          nodes {
            id
            quantity
            customAttributes {
              key
              value
            }
            product {
              id
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
      displayFinancialStatus: string | null
      checkedIn: { value: string } | null
      lineItems: {
        nodes: {
          id: string
          quantity: number
          customAttributes: { key: string; value: string | null }[]
          product: { id: string; productType: string } | null
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
  name: string
  email: string
  phone: string
  paid: boolean
  checkedInAt: string | null
}

export type EventAttendance = {
  productId: string
  sold: number
  checkedIn: number
  unpaid: number
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
      const used = checkedInMap(order.checkedIn?.value)
      const paid = order.displayFinancialStatus === 'PAID'

      for (const line of order.lineItems.nodes) {
        if (line.product?.productType !== EVENT_PRODUCT_TYPE) continue

        const productId = line.product.id.split('/').pop() as string
        const orderId = order.id.split('/').pop() as string
        const lineItemId = line.id.split('/').pop() as string

        const bucket: EventAttendance = byProduct.get(productId) ?? {
          productId,
          sold: 0,
          checkedIn: 0,
          unpaid: 0,
          attendees: [],
        }

        bucket.sold += line.quantity
        if (!paid) bucket.unpaid += line.quantity

        for (let index = 1; index <= line.quantity; index += 1) {
          const checkedInAt = used[`${lineItemId}:${index}`] ?? null
          if (checkedInAt) bucket.checkedIn += 1

          bucket.attendees.push({
            token: encodeTicket({ orderId, lineItemId, index, total: line.quantity }),
            orderId,
            orderName: order.name,
            lineItemId,
            index,
            quantity: line.quantity,
            name: attribute(line.customAttributes, 'Booking name'),
            email: attribute(line.customAttributes, 'Booking email'),
            phone: attribute(line.customAttributes, 'Booking phone'),
            paid,
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
