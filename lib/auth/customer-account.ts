import { createHash, randomBytes } from 'node:crypto'

/**
 * Shopify Customer Account API, OAuth 2.0 with PKCE. Staff sign in with their
 * own Shopify customer account; we never see or store a password.
 *
 * Config lives in Shopify admin → Headless → Customer Account API → Manage.
 */
const SHOP_ID = process.env.SHOPIFY_SHOP_ID || ''
const CLIENT_ID = process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID || ''

export const CUSTOMER_SCOPES = 'openid email customer-account-api:full'

/** Holds the PKCE verifier between the redirect out to Shopify and back. */
export const PKCE_COOKIE = 'z1_pkce'

export function isCustomerLoginConfigured(): boolean {
  return Boolean(SHOP_ID && CLIENT_ID)
}

function base() {
  if (!isCustomerLoginConfigured()) {
    throw new Error(
      'Missing SHOPIFY_SHOP_ID or SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID. See README.'
    )
  }
  return `https://shopify.com/authentication/${SHOP_ID}`
}

export function createVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function authorizeUrl(options: {
  redirectUri: string
  state: string
  nonce: string
  verifier: string
}): string {
  const url = new URL(`${base()}/oauth/authorize`)
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', options.redirectUri)
  url.searchParams.set('scope', CUSTOMER_SCOPES)
  url.searchParams.set('state', options.state)
  url.searchParams.set('nonce', options.nonce)
  url.searchParams.set('code_challenge', challengeFor(options.verifier))
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export function logoutUrl(idToken: string, returnTo: string): string {
  const url = new URL(`${base()}/logout`)
  url.searchParams.set('id_token_hint', idToken)
  url.searchParams.set('post_logout_redirect_uri', returnTo)
  return url.toString()
}

type TokenResponse = {
  access_token: string
  id_token: string
  expires_in: number
}

export async function exchangeCode(options: {
  code: string
  redirectUri: string
  verifier: string
  /** Must match a registered JavaScript origin; Shopify requires it here. */
  origin: string
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: options.redirectUri,
    code: options.code,
    code_verifier: options.verifier,
  })

  const response = await fetch(`${base()}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Public clients are identified by origin rather than a secret.
      Origin: options.origin,
    },
    body,
    cache: 'no-store',
  })

  const raw = await response.text()
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${raw.slice(0, 300)}`)
  }

  let payload: Partial<TokenResponse>
  try {
    payload = JSON.parse(raw) as Partial<TokenResponse>
  } catch {
    throw new Error(`Token endpoint returned non-JSON: ${raw.slice(0, 200)}`)
  }

  // Naming the missing field beats a TypeError three frames later.
  if (!payload.id_token || typeof payload.id_token !== 'string') {
    throw new Error(
      `Token response has no id_token. Keys: ${Object.keys(payload).join(', ') || 'none'}`
    )
  }

  return payload as TokenResponse
}

type IdTokenClaims = {
  sub?: string
  email?: string
  name?: string
  nonce?: string
}

/**
 * Reads the claims without verifying the signature. Safe here because the token
 * came straight from Shopify's token endpoint over TLS, never from the browser.
 */
export function readIdToken(idToken: string): IdTokenClaims {
  if (typeof idToken !== 'string') return {}
  const [, payload] = idToken.split('.')
  if (!payload) return {}
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as IdTokenClaims
  } catch {
    return {}
  }
}

/** The `sub` claim is the customer's numeric id, sometimes prefixed by shop id. */
export function customerIdFromClaims(claims: IdTokenClaims): string | null {
  const sub = typeof claims.sub === 'string' ? claims.sub : null
  if (!sub) return null
  const numeric = sub.split(/[^0-9]/).filter(Boolean).pop()
  return numeric ?? null
}

/**
 * Asks the Customer Account API who the token belongs to. Authoritative, where
 * the id_token claims are only a hint whose shape Shopify is free to change.
 */
export async function fetchCustomerId(accessToken: string): Promise<string | null> {
  const version = process.env.SHOPIFY_CUSTOMER_API_VERSION || '2026-07'
  const response = await fetch(
    `https://shopify.com/${SHOP_ID}/account/customer/api/${version}/graphql`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken,
      },
      body: JSON.stringify({ query: '{ customer { id } }' }),
      cache: 'no-store',
    }
  )

  const raw = await response.text()
  if (!response.ok) {
    throw new Error(`Customer Account API ${response.status}: ${raw.slice(0, 200)}`)
  }

  let payload: { data?: { customer?: { id?: string } }; errors?: { message: string }[] }
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error(`Customer Account API returned non-JSON: ${raw.slice(0, 200)}`)
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '))
  }

  const id = payload.data?.customer?.id
  return id ? (id.split('/').pop() ?? null) : null
}
