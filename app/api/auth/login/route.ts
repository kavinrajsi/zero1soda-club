import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  authorizeUrl,
  createVerifier,
  isCustomerLoginConfigured,
  PKCE_COOKIE,
} from '@/lib/auth/customer-account'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isCustomerLoginConfigured()) {
    return NextResponse.redirect(new URL('/login?error=unconfigured', request.url))
  }

  const verifier = createVerifier()
  const state = randomBytes(16).toString('base64url')
  const nonce = randomBytes(16).toString('base64url')
  const redirectUri = new URL('/api/auth/callback', request.url).toString()

  const store = await cookies()
  // Short-lived: it only has to survive the round trip to Shopify and back.
  store.set(PKCE_COOKIE, JSON.stringify({ verifier, state, nonce }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: 600,
  })

  return NextResponse.redirect(authorizeUrl({ redirectUri, state, nonce, verifier }))
}
