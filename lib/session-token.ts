import { createHmac, timingSafeEqual } from 'node:crypto'

/** Seconds of clock drift tolerated between Shopify and this server. */
const SKEW_SECONDS = 10

export type SessionTokenClaims = {
  dest: string
  aud: string
  exp: number
  nbf: number
  iat: number
  jti: string
  sub?: string
}

/**
 * Verifies a checkout UI extension session token (HS256, signed with the app
 * secret). Proves the request came from this shop's checkout, nothing more:
 * which order it may see is decided by the caller.
 */
export function verifySessionToken(token: string): SessionTokenClaims | null {
  const secret = process.env.SHOPIFY_APP_CLIENT_SECRET
  const clientId = process.env.SHOPIFY_APP_CLIENT_ID
  const shop = process.env.SHOPIFY_STORE_DOMAIN
  if (!secret || !clientId || !shop) return null

  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) return null

  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  if (expected.length !== signature.length) return null
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null

  let claims: SessionTokenClaims
  try {
    const head = JSON.parse(Buffer.from(header, 'base64url').toString())
    if (head.alg !== 'HS256') return null
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  if (claims.aud !== clientId) return null
  if (claims.dest?.replace(/^https:\/\//, '') !== shop) return null
  if (typeof claims.exp !== 'number' || claims.exp + SKEW_SECONDS < now) return null
  if (typeof claims.nbf === 'number' && claims.nbf - SKEW_SECONDS > now) return null
  return claims
}
