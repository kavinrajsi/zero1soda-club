export type EventVariant = {
  id: string
  title: string
  price: number
  currencyCode: string
  availableForSale: boolean
  quantityAvailable: number | null
}

export type ClubEvent = {
  id: string
  productId: string
  handle: string
  title: string
  descriptionHtml: string
  imageUrl: string | null
  imageAlt: string
  city: string
  venue: string
  /** Unix seconds. */
  startsAt: number
  /** Unix seconds. */
  endsAt: number
  cancelled: boolean
  /** Unix seconds; bookings stop at this moment. Null means "until it starts". */
  bookingClosesAt: number | null
  soldOut: boolean
  onlineStoreUrl: string | null
  variants: EventVariant[]
  minPrice: number
  currencyCode: string
}
