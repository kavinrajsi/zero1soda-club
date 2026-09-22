import type { Metadata } from 'next'
import { Anton, Poppins } from 'next/font/google'
import './globals.css'

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://club.zero1soda.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Club Zero1 — Events, workshops and community',
  description:
    'Workshops, meetups and a little something different from Zero1 Soda. Find your next event and book your tickets.',
  openGraph: {
    title: 'Club Zero1 — Good people. Great plans.',
    description:
      'Workshops, meetups and a little something different from Zero1 Soda. Find your next event and book your tickets.',
    url: siteUrl,
    siteName: 'Club Zero1',
    locale: 'en_IN',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${anton.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  )
}
