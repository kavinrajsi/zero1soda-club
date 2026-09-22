const API_VERSION = process.env.SHOPIFY_STOREFRONT_API_VERSION || '2026-07'

export class ShopifyError extends Error {}

function config() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN
  if (!domain || !token) {
    throw new ShopifyError(
      'Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_TOKEN. See README.'
    )
  }
  return { domain, token }
}

export function isShopifyConfigured() {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_TOKEN)
}

type GraphQLResponse<T> = {
  data?: T
  errors?: { message: string }[]
}

/**
 * Storefront API call. Always runs server-side so the token never reaches the
 * browser, even though Storefront tokens are public-scoped.
 */
export async function storefront<T>(
  query: string,
  variables: Record<string, unknown> = {},
  init: { cache?: RequestCache; revalidate?: number } = {}
): Promise<T> {
  const { domain, token } = config()
  const response = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
    cache: init.cache,
    next: init.revalidate === undefined ? undefined : { revalidate: init.revalidate },
  })

  if (!response.ok) {
    throw new ShopifyError(`Storefront API ${response.status}: ${await response.text()}`)
  }

  const payload = (await response.json()) as GraphQLResponse<T>
  if (payload.errors?.length) {
    throw new ShopifyError(payload.errors.map((e) => e.message).join('; '))
  }
  if (!payload.data) throw new ShopifyError('Storefront API returned no data.')
  return payload.data
}

/** Admin API call. Only used by the interest form; optional. */
export async function admin<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN
  const token = process.env.SHOPIFY_ADMIN_TOKEN
  if (!domain || !token) throw new ShopifyError('Admin API is not configured.')

  const response = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new ShopifyError(`Admin API ${response.status}: ${await response.text()}`)
  }

  const payload = (await response.json()) as GraphQLResponse<T>
  if (payload.errors?.length) {
    throw new ShopifyError(payload.errors.map((e) => e.message).join('; '))
  }
  if (!payload.data) throw new ShopifyError('Admin API returned no data.')
  return payload.data
}
