'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import BookingDialog from './BookingDialog'
import EventCard from './EventCard'
import InterestDialog from './InterestDialog'
import { SITE } from '@/lib/site'
import type { ClubEvent } from '@/lib/types'

type Props = {
  events: ClubEvent[]
  /** Server clock at render time; the client takes over after mount. */
  now: number
  isSample: boolean
  error: string | null
}

export default function ClubPage({ events, now, isSample, error }: Props) {
  const [clock, setClock] = useState(now)
  const [city, setCity] = useState('')
  const [booking, setBooking] = useState<ClubEvent | null>(null)
  const [interest, setInterest] = useState<{ open: boolean; event: string; city: string }>({
    open: false,
    event: 'Club Zero1',
    city: '',
  })
  const [photo, setPhoto] = useState<{ src: string; caption: string } | null>(null)
  const lightbox = useRef<HTMLDialogElement>(null)

  // Events roll from upcoming to past without a reload.
  useEffect(() => {
    const id = setInterval(() => setClock(Math.floor(Date.now() / 1000)), 60_000)
    setClock(Math.floor(Date.now() / 1000))
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (photo) lightbox.current?.showModal()
  }, [photo])

  const cities = useMemo(
    () => [...new Set(events.map((event) => event.city))].sort((a, b) => a.localeCompare(b)),
    [events]
  )

  const notifyCities = useMemo(
    () => [...new Set([...cities, ...SITE.notifyCities])].sort((a, b) => a.localeCompare(b)),
    [cities]
  )

  const visible = useMemo(
    () => events.filter((event) => !city || event.city === city),
    [events, city]
  )

  const upcoming = useMemo(
    () =>
      visible
        .filter((event) => event.endsAt > clock)
        .sort((a, b) => a.city.localeCompare(b.city) || a.startsAt - b.startsAt),
    [visible, clock]
  )

  const past = useMemo(
    () => visible.filter((event) => event.endsAt <= clock).sort((a, b) => b.startsAt - a.startsAt),
    [visible, clock]
  )

  function openInterest(eventName: string, cityName: string) {
    setInterest({ open: true, event: eventName || 'Club Zero1', city: cityName || city })
  }

  function renderUpcoming() {
    if (upcoming.length === 0) {
      return (
        <div className="z1-empty">
          <h3>GOOD THINGS ARE COMING.</h3>
          <p>No events listed here yet. Tell us where you&rsquo;d like to join us.</p>
          <button className="z1-pill" type="button" onClick={() => openInterest('Next event', city)}>
            Notify me
          </button>
        </div>
      )
    }

    const nodes: React.ReactNode[] = []
    let currentCity: string | null = null
    upcoming.forEach((event) => {
      if (event.city !== currentCity) {
        currentCity = event.city
        nodes.push(
          <h3 className="z1-city-heading" key={`city-${event.city}`}>
            {event.city}
          </h3>
        )
      }
      const alone = upcoming.filter((item) => item.city === event.city).length === 1
      nodes.push(
        <EventCard
          key={event.id}
          event={event}
          past={false}
          wide={alone}
          onBook={setBooking}
          onNotify={(item) => openInterest(item.title, item.city)}
        />
      )
    })
    return nodes
  }

  return (
    <>
      {isSample && (
        <p className="z1-sample-banner">
          Sample data — set SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN to show live events.
        </p>
      )}
      {error && <p className="z1-error-banner">Events could not be loaded: {error}</p>}

      <section className="z1-section" id="Z1Upcoming" aria-labelledby="Z1UpcomingTitle">
        <div className="z1-heading-row">
          <div>
            <p className="z1-kicker">MAKE SOME PLANS</p>
            <h2 id="Z1UpcomingTitle">HAPPENING NOW</h2>
          </div>
          <p>
            Your city. Your people.
            <br />
            Your next good time.
          </p>
        </div>
        <div className="z1-filter-row">
          <label htmlFor="Z1City">Find events in</label>
          <select id="Z1City" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {cities.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span role="status">
            {upcoming.length} event{upcoming.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="z1-events-grid">{renderUpcoming()}</div>
      </section>

      <section className="z1-section z1-gallery-section" aria-labelledby="Z1GalleryTitle">
        <div className="z1-heading-row">
          <div>
            <p className="z1-kicker">THE CLUB, IN PICTURES</p>
            <h2 id="Z1GalleryTitle">YOU HAD TO BE THERE.</h2>
          </div>
        </div>
        <div className="z1-gallery">
          {SITE.gallery.map((item) => (
            <figure key={item.src}>
              <button
                type="button"
                className="z1-photo"
                aria-label={`Enlarge ${item.caption}`}
                onClick={() => setPhoto(item)}
              >
                <Image
                  src={item.src}
                  alt={item.caption}
                  width={1200}
                  height={800}
                  sizes="(max-width: 540px) 100vw, 640px"
                />
              </button>
              <figcaption>{item.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="z1-section" aria-labelledby="Z1PastTitle">
        <div className="z1-heading-row">
          <div>
            <p className="z1-kicker">GOOD TIMES, ON REPEAT</p>
            <h2 id="Z1PastTitle">PAST EVENTS</h2>
          </div>
          <p>
            Missed it?
            <br />
            Be in the loop for the next one.
          </p>
        </div>
        <div className="z1-events-grid">
          {past.length === 0 ? (
            <p className="z1-empty">Our past events will appear here.</p>
          ) : (
            past.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                past
                wide={false}
                onBook={setBooking}
                onNotify={(item) => openInterest(item.title, item.city)}
              />
            ))
          )}
        </div>
      </section>

      <aside className="z1-community">
        <div>
          <p className="z1-kicker">THERE&rsquo;S ALWAYS A NEXT TIME.</p>
          <h2>
            YOUR CITY.
            <br />
            OUR NEXT STOP?
          </h2>
        </div>
        <button
          type="button"
          className="z1-pill z1-white"
          onClick={() => openInterest('Events in my city', city)}
        >
          Register your interest <span aria-hidden="true">↗</span>
        </button>
        <div className="z1-bird-perch" aria-hidden="true">
          <Image
            className="z1-footer-bird"
            src="/images/club-zero1-bird.png"
            alt=""
            width={1254}
            height={1254}
          />
        </div>
      </aside>

      <BookingDialog event={booking} onClose={() => setBooking(null)} />
      <InterestDialog
        open={interest.open}
        eventName={interest.event}
        city={interest.city}
        cities={notifyCities}
        onClose={() => setInterest((state) => ({ ...state, open: false }))}
      />
      <dialog
        className="z1-dialog z1-lightbox"
        ref={lightbox}
        aria-label="Event gallery photo"
        onClose={() => setPhoto(null)}
      >
        <button
          type="button"
          className="z1-close"
          aria-label="Close photo"
          onClick={() => lightbox.current?.close()}
        >
          ×
        </button>
        {photo && (
          <>
            <Image src={photo.src} alt={photo.caption} width={1600} height={1000} />
            <p>{photo.caption}</p>
          </>
        )}
      </dialog>
    </>
  )
}
