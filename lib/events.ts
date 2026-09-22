import { isShopifyConfigured, storefront } from './shopify'
import type { ClubEvent, EventVariant } from './types'
import { SAMPLE_EVENTS } from './sample-events'

export const EVENT_PRODUCT_TYPE = process.env.SHOPIFY_EVENT_PRODUCT_TYPE || 'Event ticket'
export const EVENT_METAFIELD_NAMESPACE = 'event'

const EVENTS_QUERY = /* GraphQL */ `
  query ClubEvents($first: Int!, $query: String!) {
    products(first: $first, query: $query) {
      nodes {
        id
        handle
        title
        descriptionHtml
        onlineStoreUrl
        availableForSale
        featuredImage {
          url
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        metafields(
          identifiers: [
            { namespace: "event", key: "city" }
            { namespace: "event", key: "venue" }
            { namespace: "event", key: "starts_at" }
            { namespace: "event", key: "ends_at" }
            { namespace: "event", key: "cancelled" }
            { namespace: "event", key: "booking_closes_at" }
          ]
        ) {
          key
          value
        }
        variants(first: 20) {
          nodes {
            id
            title
            availableForSale
            quantityAvailable
            price {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`

type StorefrontProduct = {
  id: string
  handle: string
  title: string
  descriptionHtml: string
  onlineStoreUrl: string | null
  availableForSale: boolean
  featuredImage: { url: string; altText: string | null } | null
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } }
  metafields: ({ key: string; value: string } | null)[]
  variants: {
    nodes: {
      id: string
      title: string
      availableForSale: boolean
      quantityAvailable: number | null
      price: { amount: string; currencyCode: string }
    }[]
  }
}

const IST_OFFSET_MINUTES = 330

/**
 * Shopify `date_time` metafields come back as ISO strings. Values entered in the
 * admin without a zone are store-local, so an unzoned value is read as IST.
 */
export function parseEventTime(value: string | undefined | null): number | null {
  if (!value) return null
  const trimmed = value.trim()
  const zoned = /(Z|[+-]\d{2}:?\d{2})$/.test(trimmed)
  const parsed = Date.parse(zoned ? trimmed : `${trimmed}Z`)
  if (Number.isNaN(parsed)) return null
  const millis = zoned ? parsed : parsed - IST_OFFSET_MINUTES * 60_000
  return Math.floor(millis / 1000)
}

function metafieldMap(product: StorefrontProduct) {
  const map = new Map<string, string>()
  for (const field of product.metafields) {
    if (field?.value) map.set(field.key, field.value)
  }
  return map
}

function toClubEvent(product: StorefrontProduct): ClubEvent | null {
  const fields = metafieldMap(product)
  const startsAt = parseEventTime(fields.get('starts_at'))
  if (startsAt === null) return null // an event without a start date cannot be placed on the page

  const endsAt = parseEventTime(fields.get('ends_at')) ?? startsAt + 2 * 60 * 60
  const variants: EventVariant[] = product.variants.nodes.map((variant) => ({
    id: variant.id,
    title: variant.title,
    price: Number(variant.price.amount),
    currencyCode: variant.price.currencyCode,
    availableForSale: variant.availableForSale,
    quantityAvailable: variant.quantityAvailable,
  }))

  return {
    id: product.id,
    productId: product.id.split('/').pop() || product.id,
    handle: product.handle,
    title: product.title,
    descriptionHtml: product.descriptionHtml,
    imageUrl: product.featuredImage?.url ?? null,
    imageAlt: product.featuredImage?.altText || product.title,
    city: fields.get('city')?.trim() || 'Online',
    venue: fields.get('venue')?.trim() || '',
    startsAt,
    endsAt,
    cancelled: fields.get('cancelled') === 'true',
    bookingClosesAt: parseEventTime(fields.get('booking_closes_at')),
    soldOut: !product.availableForSale || variants.every((v) => !v.availableForSale),
    onlineStoreUrl: product.onlineStoreUrl,
    variants,
    minPrice: Number(product.priceRange.minVariantPrice.amount),
    currencyCode: product.priceRange.minVariantPrice.currencyCode,
  }
}

export type EventsResult = {
  events: ClubEvent[]
  /** True when Shopify is not wired up yet and sample data is on screen. */
  isSample: boolean
  error: string | null
}

export async function getEvents(): Promise<EventsResult> {
  if (!isShopifyConfigured()) {
    return { events: SAMPLE_EVENTS, isSample: true, error: null }
  }

  try {
    const data = await storefront<{ products: { nodes: StorefrontProduct[] } }>(
      EVENTS_QUERY,
      { first: 100, query: `product_type:'${EVENT_PRODUCT_TYPE}'` },
      { revalidate: 60 }
    )
    const events = data.products.nodes
      .map(toClubEvent)
      .filter((event): event is ClubEvent => event !== null && !event.cancelled)
      .sort((a, b) => a.startsAt - b.startsAt)
    return { events, isSample: false, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Storefront API error'
    return { events: [], isSample: false, error: message }
  }
}
