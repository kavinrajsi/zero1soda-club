import { NextResponse } from 'next/server'
import { admin, isAdminConfigured } from '@/lib/shopify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FIND_CUSTOMER = /* GraphQL */ `
  query ClubInterestFindCustomer($query: String!) {
    customers(first: 1, query: $query) {
      nodes {
        id
        tags
        note
      }
    }
  }
`

const CREATE_CUSTOMER = /* GraphQL */ `
  mutation ClubInterestCustomerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`

const UPDATE_CUSTOMER = /* GraphQL */ `
  mutation ClubInterestCustomerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return fail(
      'The interest list is not connected yet. Please write to hello@zero1soda.com.',
      503
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return fail('Malformed request.')
  }

  const name = text(body.name, 120)
  const email = text(body.email, 254)
  const phone = text(body.phone, 30)
  const city = text(body.city, 100)
  const eventName = text(body.event, 200) || 'Club Zero1'

  if (!name) return fail('Please add your name.')
  if (!EMAIL.test(email)) return fail('Please add a valid email address.')
  if (!city) return fail('Please choose a city.')

  const [firstName, ...rest] = name.split(/\s+/)
  const lastName = rest.join(' ')
  const tags = ['club-zero1', `club-city:${city.toLowerCase()}`]
  const note = `Club Zero1 interest — ${eventName} (${city}). Phone: ${phone || 'not given'}.`
  // Deliberately no emailMarketingConsent: the checkbox covers event contact, not
  // the store's marketing list, and writing it would resubscribe someone who
  // had previously opted out. The `club-zero1` tag is what segments this list.

  try {
    const existing = await admin<{
      customers: { nodes: { id: string; tags: string[]; note: string | null }[] }
    }>(FIND_CUSTOMER, { query: `email:${JSON.stringify(email)}` })

    const customer = existing.customers.nodes[0]

    if (customer) {
      // `tags` replaces the list, so merge with what the customer already has.
      const merged = [...new Set([...customer.tags, ...tags])]
      const result = await admin<{
        customerUpdate: { userErrors: { message: string }[] }
      }>(UPDATE_CUSTOMER, {
        input: {
          id: customer.id,
          tags: merged,
          note: customer.note ? `${customer.note}\n${note}` : note,
        },
      })
      const error = result.customerUpdate.userErrors[0]
      if (error) return fail(error.message)
      return NextResponse.json({ ok: true })
    }

    const result = await admin<{
      customerCreate: { userErrors: { message: string }[] }
    }>(CREATE_CUSTOMER, {
      input: {
        email,
        firstName,
        lastName: lastName || undefined,
        phone: phone || undefined,
        tags,
        note,
      },
    })

    const error = result.customerCreate.userErrors[0]
    // A bad phone number should never block the sign-up; retry without it.
    if (error && /phone/i.test(error.message)) {
      const retry = await admin<{
        customerCreate: { userErrors: { message: string }[] }
      }>(CREATE_CUSTOMER, {
        input: {
          email,
          firstName,
          lastName: lastName || undefined,
          tags,
          note,
        },
      })
      const retryError = retry.customerCreate.userErrors[0]
      if (retryError) return fail(retryError.message)
      return NextResponse.json({ ok: true })
    }
    if (error) return fail(error.message)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[club-zero1] interest submission failed', error)
    return fail('We could not save your details. Please try again in a moment.', 502)
  }
}
