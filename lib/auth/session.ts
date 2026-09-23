import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'z1_session'
const SESSION_HOURS = 12

export type StaffRole = 'admin' | 'checker'

export type StaffSession = {
  customerId: string
  displayName: string
  email: string
  role: StaffRole
  expiresAt: number
}

function secret(): string {
  const value = process.env.SESSION_SECRET || process.env.TICKET_SECRET
  if (!value || value.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short (32+ random chars).')
  }
  return value
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 32)
}

function serialise(session: StaffSession): string {
  const body = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${body}.${sign(body)}`
}

function deserialise(raw: string): StaffSession | null {
  const [body, signature] = raw.split('.')
  if (!body || !signature) return null

  const expected = sign(body)
  if (expected.length !== signature.length) return null
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null

  try {
    const session = JSON.parse(Buffer.from(body, 'base64url').toString()) as StaffSession
    if (!session.customerId || !session.role) return null
    if (session.expiresAt <= Date.now()) return null
    return session
  } catch {
    return null
  }
}

export async function startSession(
  session: Omit<StaffSession, 'expiresAt'>
): Promise<StaffSession> {
  const full: StaffSession = {
    ...session,
    expiresAt: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, serialise(full), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_HOURS * 60 * 60,
  })

  return full
}

export async function readSession(): Promise<StaffSession | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value
  return raw ? deserialise(raw) : null
}

export async function endSession() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/** Admins can see everything a checker can, so the door still works for them. */
export function canCheckIn(session: StaffSession | null): boolean {
  return session?.role === 'checker' || session?.role === 'admin'
}

export function isAdmin(session: StaffSession | null): boolean {
  return session?.role === 'admin'
}
