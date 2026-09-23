import type { Metadata } from 'next'
import Link from 'next/link'
import QrScanner from '@/components/staff/QrScanner'
import StaffBar from '@/components/staff/StaffBar'
import { requireStaff } from '@/lib/auth/guard'
import { SITE } from '@/lib/site'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Club Zero1 — scan',
  robots: { index: false, follow: false },
}

export default async function ScanPage() {
  const session = await requireStaff()

  return (
    <main className="checker checker--scan">
      <StaffBar
        session={session}
        title="Scan"
        action={
          <Link className="staff-bar__back" href="/checker">
            Events
          </Link>
        }
      />
      <QrScanner checkinPrefix={`${SITE.url}/checkin/`} />
    </main>
  )
}
