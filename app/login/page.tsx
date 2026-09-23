import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isCustomerLoginConfigured } from '@/lib/auth/customer-account'
import { ROLE_TAGS } from '@/lib/auth/roles'
import { readSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Club Zero1 staff sign in',
  robots: { index: false, follow: false },
}

const ERRORS: Record<string, string> = {
  unconfigured: 'Staff sign in is not configured on this store yet.',
  denied: 'Sign in was cancelled.',
  incomplete: 'Shopify did not return a sign in code. Try again.',
  expired: 'That sign in attempt timed out. Try again.',
  state: 'That sign in did not start here. Try again from this page.',
  nonce: 'That sign in could not be verified. Try again.',
  identity: 'Shopify did not identify the account. Try again.',
  exchange: 'Shopify could not complete the sign in. Try again in a moment.',
  forbidden: `This Shopify account has no staff tag. Ask an admin to add "${ROLE_TAGS.admin}" or "${ROLE_TAGS.checker}" to it.`,
}

type Props = { searchParams: Promise<{ error?: string; 'signed-out'?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const session = await readSession()
  if (session) redirect(session.role === 'admin' ? '/admin' : '/checker')

  const params = await searchParams
  const error = params.error ? (ERRORS[params.error] ?? ERRORS.exchange) : null
  const signedOut = params['signed-out'] === '1'

  return (
    <main className="staff-login">
      <div className="staff-login__card">
        <p className="staff-login__kicker">CLUB ZERO1</p>
        <h1 className="staff-login__title">STAFF SIGN IN</h1>
        <p className="staff-login__lead">
          Use the Shopify account your club access was granted to. Shopify emails you a code —
          no password to remember.
        </p>

        {signedOut && (
          <p className="staff-login__notice staff-login__notice--calm" role="status">
            Signed out.
          </p>
        )}

        {error && (
          <p className="staff-login__notice staff-login__notice--error" role="alert">
            {error}
          </p>
        )}

        {isCustomerLoginConfigured() ? (
          <a className="staff-login__action" href="/api/auth/login">
            Continue with Shopify
          </a>
        ) : (
          <p className="staff-login__notice staff-login__notice--error">
            Set SHOPIFY_SHOP_ID and SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID to enable sign in.
          </p>
        )}

        <dl className="staff-login__roles">
          <div className="staff-login__role">
            <dt>{ROLE_TAGS.admin}</dt>
            <dd>Event numbers, tickets sold, who came</dd>
          </div>
          <div className="staff-login__role">
            <dt>{ROLE_TAGS.checker}</dt>
            <dd>Scan tickets at the door</dd>
          </div>
        </dl>
      </div>
    </main>
  )
}
