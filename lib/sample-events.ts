import type { ClubEvent } from './types'

/**
 * Shown only until the Shopify env vars are set. Mirrors the shape the
 * Storefront API returns so the page looks the same before and after wiring.
 */
const DAY = 86_400

function at(daysFromNow: number, hourIST: number): number {
  const base = Math.floor(Date.now() / 1000) + daysFromNow * DAY
  const day = Math.floor(base / DAY) * DAY
  return day + hourIST * 3600 - 330 * 60
}

function sample(
  id: number,
  title: string,
  city: string,
  venue: string,
  price: number,
  daysFromNow: number,
  options: { soldOut?: boolean } = {}
): ClubEvent {
  const startsAt = at(daysFromNow, 19)
  return {
    id: `gid://shopify/Product/${id}`,
    productId: String(id),
    handle: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title,
    descriptionHtml:
      '<p>A session with the Zero1 community. All experience levels are welcome. Please arrive 15 minutes early.</p>',
    imageUrl: null,
    imageAlt: title,
    city,
    venue,
    startsAt,
    endsAt: startsAt + 2 * 3600,
    cancelled: false,
    bookingClosesAt: null,
    soldOut: Boolean(options.soldOut),
    onlineStoreUrl: null,
    variants: [
      {
        id: `gid://shopify/ProductVariant/${id}1`,
        title: 'General entry',
        price,
        currencyCode: 'INR',
        availableForSale: !options.soldOut,
        quantityAvailable: options.soldOut ? 0 : 25,
      },
    ],
    minPrice: price,
    currencyCode: 'INR',
  }
}

export const SAMPLE_EVENTS: ClubEvent[] = [
  sample(102, 'Community Meetup', 'Chennai', 'Sample venue', 399, 12),
  sample(101, 'Boxing Workshop', 'Coimbatore', 'Coz Cafe', 599, 21),
  sample(103, 'Move With The Club', 'Coimbatore', 'Coz Cafe', 499, 30, { soldOut: true }),
  sample(106, 'Zero1 Wellness Festival', 'Bengaluru', 'Depot18 – Sports', 299, -35),
  sample(104, 'Boxing After Hours', 'Coimbatore', 'Coz Cafe', 599, -60),
  sample(105, 'The Community Social', 'Chennai', 'Sample venue', 399, -75),
]
