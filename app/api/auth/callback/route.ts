import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  customerIdFromClaims,
  exchangeCode,
  PKCE_COOKIE,
  readIdToken,
} from '@/lib/auth/customer-account'
import { identifyStaff } from '@/lib/auth/roles'
import { startSession } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function fail(request: Request, reason: string) {
  return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url))
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const code = params.get('code')
  const state = params.get('state')

  if (params.get('error')) return fail(request, 'denied')
  if (!code || !state) return fail(request, 'incomplete')

  const store = await cookies()
  const stored = store.get(PKCE_COOKIE)?.value
  if (!stored) return fail(request, 'expired')
  store.delete(PKCE_COOKIE)

  let pkce: { verifier: string; state: string; nonce: string }
  try {
    pkce = JSON.parse(stored)
  } catch {
    return fail(request, 'expired')
  }

  // Guards against a login started somewhere else being finished here.
  if (pkce.state !== state) return fail(request, 'state')

  try {
    const tokens = await exchangeCode({
      code,
      redirectUri: new URL('/api/auth/callback', request.url).toString(),
      verifier: pkce.verifier,
    })

    const claims = readIdToken(tokens.id_token)
    if (claims.nonce && claims.nonce !== pkce.nonce) return fail(request, 'nonce')

    const customerId = customerIdFromClaims(claims)
    if (!customerId) return fail(request, 'identity')

    const staff = await identifyStaff(customerId)
    // A real customer with no staff tag is not an error, just not staff.
    if (!staff) return fail(request, 'forbidden')

    await startSession(staff)
    return NextResponse.redirect(new URL(staff.role === 'admin' ? '/admin' : '/checker', request.url))
  } catch (error) {
    console.error('[club-zero1] staff login failed', error)
    return fail(request, 'exchange')
  }
}
