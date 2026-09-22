import { NextResponse } from 'next/server'
import { SITE } from '@/lib/site'
import { storefront } from '@/lib/shopify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CART_CREATE = /* GraphQL */ `
  mutation ClubCartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
      }
      userErrors {
        field
        message
      }
    }
  }
`

type CartCreateResult = {
  cartCreate: {
    cart: { id: string; checkoutUrl: string; totalQuantity: number } | null
    userErrors: { field: string[] | null; message: string }[]
  }
}

type Body = {
  variantId?: unknown
  quantity?: unknown
  event?: { title?: unknown; city?: unknown; venue?: unknown; startsAt?: unknown }
  booker?: { name?: unknown; email?: unknown; phone?: unknown }
}

const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d+$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return fail('Malformed request.')
  }

  const variantId = text(body.variantId, 120)
  if (!VARIANT_GID.test(variantId)) return fail('That ticket is no longer available.')

  const quantity = Number(body.quantity)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > SITE.maxTicketsPerCheckout) {
    return fail(`Choose between 1 and ${SITE.maxTicketsPerCheckout} tickets.`)
  }

  const name = text(body.booker?.name, 120)
  const email = text(body.booker?.email, 254)
  const phone = text(body.booker?.phone, 30)
  if (!name) return fail('Please add the name for the booking.')
  if (!EMAIL.test(email)) return fail('Please add a valid email address.')
  if (!phone) return fail('Please add a contact number.')

  const eventTitle = text(body.event?.title, 200)
  const eventCity = text(body.event?.city, 100)
  const eventVenue = text(body.event?.venue, 200)

  const attributes = [
    { key: 'Event', value: eventTitle },
    { key: 'City', value: eventCity },
    { key: 'Venue', value: eventVenue },
    { key: 'Booking name', value: name },
    { key: 'Booking email', value: email },
    { key: 'Booking phone', value: phone },
  ].filter((attribute) => attribute.value.length > 0)

  try {
    const data = await storefront<CartCreateResult>(
      CART_CREATE,
      {
        input: {
          lines: [{ merchandiseId: variantId, quantity, attributes }],
          buyerIdentity: { email, countryCode: 'IN' },
          attributes: [{ key: 'Source', value: 'club.zero1soda.com' }],
          note: eventTitle ? `Club Zero1 booking — ${eventTitle}` : 'Club Zero1 booking',
        },
      },
      { cache: 'no-store' }
    )

    const userError = data.cartCreate.userErrors[0]
    if (userError) return fail(userError.message)

    const checkoutUrl = data.cartCreate.cart?.checkoutUrl
    if (!checkoutUrl) return fail('Checkout could not be created. Please try again.')

    return NextResponse.json({ checkoutUrl })
  } catch (error) {
    console.error('[club-zero1] cartCreate failed', error)
    return fail('We could not reach the store. Please try again in a moment.', 502)
  }
}
