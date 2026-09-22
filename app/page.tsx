import Image from 'next/image'
import ClubPage from '@/components/ClubPage'
import SiteNav from '@/components/SiteNav'
import { getEvents } from '@/lib/events'

export const revalidate = 60

export default async function Page() {
  const { events, isSample, error } = await getEvents()

  return (
    <div
      className="z1"
      id="Zero1Top"
      style={
        {
          '--z1-red': '#EF250C',
          '--z1-ink': '#1C1212',
          '--z1-green': '#2c9348',
          '--z1-yellow': '#FDC503',
          '--z1-pink': '#E84286',
        } as React.CSSProperties
      }
    >
      <SiteNav />

      <header className="z1-hero">
        <Image
          className="z1-hero-image"
          src="/images/hero.png"
          alt="Club Zero1 community"
          fill
          priority
          sizes="100vw"
        />
        <div className="z1-hero-copy">
          <h1>GOOD PEOPLE. GREAT PLANS.</h1>
          <p>Workshops, meetups and a little something different. Come find your people.</p>
          <a href="#Z1Upcoming" className="z1-pill z1-white">
            Find your next event <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <div className="z1-ribbon" aria-label="Events, workshops and community">
        <span>EVENTS</span>
        <span aria-hidden="true">✦</span>
        <span>WORKSHOPS</span>
        <span aria-hidden="true">✦</span>
        <span>COMMUNITY</span>
      </div>

      <ClubPage
        events={events}
        now={Math.floor(Date.now() / 1000)}
        isSample={isSample}
        error={error}
      />
    </div>
  )
}
