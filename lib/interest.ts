import { admin } from '@/lib/shopify'

/** Tags written by /api/interest: `club-zero1` on everyone, `club-city:<city>` per city. */
const INTEREST_TAG = 'club-zero1'
const CITY_TAG_PREFIX = 'club-city:'

const CUSTOMERS_QUERY = /* GraphQL */ `
  query ClubInterest($query: String!, $after: String) {
    customers(first: 250, query: $query, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        tags
      }
    }
  }
`

type CustomersResult = {
  customers: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: { tags: string[] }[]
  }
}

export type Interest = {
  total: number
  cities: { city: string; count: number }[]
}

/** City tags are stored lowercased; show them the way people type them. */
function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** Everyone who asked to hear about events, counted by the cities they picked. */
export async function loadInterest(): Promise<Interest> {
  const byCity = new Map<string, number>()
  let total = 0
  let after: string | null = null

  do {
    const data: CustomersResult = await admin<CustomersResult>(CUSTOMERS_QUERY, {
      query: `tag:${INTEREST_TAG}`,
      after,
    })

    for (const customer of data.customers.nodes) {
      total += 1
      for (const tag of customer.tags) {
        if (!tag.startsWith(CITY_TAG_PREFIX)) continue
        const city = tag.slice(CITY_TAG_PREFIX.length).trim()
        if (city) byCity.set(city, (byCity.get(city) ?? 0) + 1)
      }
    }

    after = data.customers.pageInfo.hasNextPage ? data.customers.pageInfo.endCursor : null
  } while (after)

  const cities = [...byCity]
    .map(([city, count]) => ({ city: titleCase(city), count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city))

  return { total, cities }
}
