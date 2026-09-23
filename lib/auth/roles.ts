import { admin } from '@/lib/shopify'
import type { StaffRole } from './session'

export const ROLE_TAGS: Record<StaffRole, string> = {
  admin: 'club-admin',
  checker: 'club-checker',
}

const CUSTOMER_QUERY = /* GraphQL */ `
  query ClubStaffCustomer($id: ID!) {
    customer(id: $id) {
      id
      displayName
      defaultEmailAddress {
        emailAddress
      }
      tags
    }
  }
`

type CustomerResult = {
  customer: {
    id: string
    displayName: string | null
    defaultEmailAddress: { emailAddress: string | null } | null
    tags: string[]
  } | null
}

export type StaffIdentity = {
  customerId: string
  displayName: string
  email: string
  role: StaffRole
}

function roleFromTags(tags: string[]): StaffRole | null {
  const normalised = tags.map((tag) => tag.trim().toLowerCase())
  // Admin wins when someone carries both, since it is the wider role.
  if (normalised.includes(ROLE_TAGS.admin)) return 'admin'
  if (normalised.includes(ROLE_TAGS.checker)) return 'checker'
  return null
}

/**
 * Looks the signed-in customer up in the Admin API and reads their tags. The
 * Customer Account API does not expose tags, and we would not trust them from
 * the client anyway — the role has to be decided server-side.
 */
export async function identifyStaff(customerId: string): Promise<StaffIdentity | null> {
  const gid = customerId.startsWith('gid://')
    ? customerId
    : `gid://shopify/Customer/${customerId}`

  const data = await admin<CustomerResult>(CUSTOMER_QUERY, { id: gid })
  const customer = data.customer
  if (!customer) return null

  const role = roleFromTags(customer.tags)
  if (!role) return null

  return {
    customerId: customer.id.split('/').pop() || customer.id,
    displayName: customer.displayName || customer.defaultEmailAddress?.emailAddress || 'Staff',
    email: customer.defaultEmailAddress?.emailAddress || '',
    role,
  }
}
