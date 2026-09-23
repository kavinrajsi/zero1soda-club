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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`)
  }

  return (await response.json()) as TokenResponse
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
  const sub = claims.sub
  if (!sub) return null
  const numeric = sub.split(/[^0-9]/).filter(Boolean).pop()
  return numeric ?? null
}
