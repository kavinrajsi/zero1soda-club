import { redirect } from 'next/navigation'
import { isAdmin, readSession, type StaffSession } from './session'

/** Any signed-in staff member. Redirects to sign in when there is no session. */
export async function requireStaff(): Promise<StaffSession> {
  const session = await readSession()
  if (!session) redirect('/login')
  return session
}

/** Admin-only pages. A checker lands on their own module rather than a dead end. */
export async function requireAdmin(): Promise<StaffSession> {
  const session = await requireStaff()
  if (!isAdmin(session)) redirect('/checker')
  return session
}
