const API_VERSION = process.env.SHOPIFY_STOREFRONT_API_VERSION || '2026-07'

export class ShopifyError extends Error {}

function storeDomain() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN
  if (!domain) throw new ShopifyError('Missing SHOPIFY_STORE_DOMAIN. See README.')
  return domain
}

/**
 * Headless channel storefronts issue two tokens. The private one is stronger and
 * must stay server-side, which is where every call in this app runs; the public
 * one works too and is the fallback.
 */
function storefrontAuth(): Record<string, string> {
  const privateToken = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN
  if (privateToken) return { 'Shopify-Storefront-Private-Token': privateToken }

  const publicToken = process.env.SHOPIFY_STOREFRONT_TOKEN
  if (publicToken) return { 'X-Shopify-Storefront-Access-Token': publicToken }

  throw new ShopifyError(
    'Missing SHOPIFY_STOREFRONT_PRIVATE_TOKEN or SHOPIFY_STOREFRONT_TOKEN. See README.'
  )
}

export function isShopifyConfigured() {
  return Boolean(
    process.env.SHOPIFY_STORE_DOMAIN &&
      (process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN || process.env.SHOPIFY_STOREFRONT_TOKEN)
  )
}

export function isAdminConfigured() {
  return Boolean(
    process.env.SHOPIFY_ADMIN_TOKEN ||
      (process.env.SHOPIFY_APP_CLIENT_ID && process.env.SHOPIFY_APP_CLIENT_SECRET)
  )
}

type GraphQLResponse<T> = {
  data?: T
  errors?: { message: string }[]
}

/**
 * Storefront API call. Always runs server-side so the token never reaches the
 * browser — required for the private token, good hygiene for the public one.
 */
export async function storefront<T>(
  query: string,
  variables: Record<string, unknown> = {},
  init: { cache?: RequestCache; revalidate?: number } = {}
): Promise<T> {
  const response = await fetch(`https://${storeDomain()}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...storefrontAuth() },
    body: JSON.stringify({ query, variables }),
    cache: init.cache,
    next: init.revalidate === undefined ? undefined : { revalidate: init.revalidate },
  })

  if (!response.ok) {
    throw new ShopifyError(`Storefront API ${response.status}: ${await response.text()}`)
  }

  return unwrap<T>(await response.json(), 'Storefront API')
}

let cachedAdminToken: { token: string; expiresAt: number } | null = null

/**
 * Apps created in the Dev Dashboard have no long-lived token: the client
 * credentials grant mints one that lives 24h. A legacy admin-created app's
 * static token still works if SHOPIFY_ADMIN_TOKEN is set.
 */
async function adminToken(): Promise<string> {
  const staticToken = process.env.SHOPIFY_ADMIN_TOKEN
  if (staticToken) return staticToken

  const clientId = process.env.SHOPIFY_APP_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_APP_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new ShopifyError('Admin API is not configured.')

  // Refresh a minute early so a token never expires mid-request.
  if (cachedAdminToken && cachedAdminToken.expiresAt > Date.now() + 60_000) {
    return cachedAdminToken.token
  }

  const response = await fetch(`https://${storeDomain()}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
    cache: 'no-store',
  })

  // OAuth failures come back as an HTML error page rather than JSON.
  const body = await response.text()
  let payload: { access_token?: string; expires_in?: number }
  try {
    payload = JSON.parse(body)
  } catch {
    const reason = body.match(/<title>([^<]+)<\/title>/)?.[1] || `HTTP ${response.status}`
    throw new ShopifyError(`Token request failed: ${reason}`)
  }
  if (!response.ok || !payload.access_token) {
    throw new ShopifyError(`Token request ${response.status}: no access token returned.`)
  }

  cachedAdminToken = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 86_399) * 1000,
  }
  return cachedAdminToken.token
}

/** Admin API call. Only used by the interest form; optional. */
export async function admin<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`https://${storeDomain()}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': await adminToken(),
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new ShopifyError(`Admin API ${response.status}: ${await response.text()}`)
  }

  return unwrap<T>(await response.json(), 'Admin API')
}

/**
 * Admin REST read, for the odd field GraphQL doesn't expose (an order's
 * checkout_token). Null on 404 so callers can treat "not there yet" as a state.
 */
export async function adminRest<T>(path: string): Promise<T | null> {
  const response = await fetch(`https://${storeDomain()}/admin/api/${API_VERSION}/${path}`, {
    headers: { 'X-Shopify-Access-Token': await adminToken() },
    cache: 'no-store',
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new ShopifyError(`Admin REST ${response.status}: ${await response.text()}`)
  }
  return (await response.json()) as T
}

/**
 * Shopify answers a partially-allowed query with both `data` and `errors` — a
 * field the token lacks a scope for comes back null rather than failing the
 * request. Losing the whole page over one optional field is worse than
 * rendering without it, so partial data wins and the errors are logged.
 */
function unwrap<T>(payload: GraphQLResponse<T>, label: string): T {
  if (payload.data) {
    if (payload.errors?.length) {
      console.warn(`[club-zero1] ${label} partial response:`, payload.errors.map((e) => e.message).join('; '))
    }
    return payload.data
  }
  if (payload.errors?.length) {
    throw new ShopifyError(payload.errors.map((error) => error.message).join('; '))
  }
  throw new ShopifyError(`${label} returned no data.`)
}
