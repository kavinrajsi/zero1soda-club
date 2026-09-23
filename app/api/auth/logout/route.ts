import { NextResponse } from 'next/server'
import { endSession } from '@/lib/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  await endSession()
  return NextResponse.redirect(new URL('/login?signed-out=1', request.url), 303)
}
