import Image from 'next/image'
import type { ClubEvent } from '@/lib/types'
import { formatEventDate, formatEventTime, formatMoney } from '@/lib/format'

type Props = {
  event: ClubEvent
  past: boolean
  wide: boolean
  /** Unix seconds, shared with the page so SSR and the client agree. */
  now: number
  onBook: (event: ClubEvent) => void
  onNotify: (event: ClubEvent) => void
}

export default function EventCard({ event, past, wide, now, onBook, onNotify }: Props) {
  const bookingClosed = event.bookingClosesAt !== null && now >= event.bookingClosesAt
  const bookable = !past && !event.soldOut && !event.cancelled && !bookingClosed
  const image = event.imageUrl || '/images/event-placeholder.png'

  return (
    <article className={`z1-event${wide ? ' z1-event--wide' : ''}`} data-city={event.city}>
      <button
        type="button"
        className="z1-event-image"
        aria-label={bookable ? `Book ${event.title}` : `View ${event.title}`}
        onClick={() => (bookable ? onBook(event) : onNotify(event))}
      >
        <Image
          src={image}
          alt={event.imageAlt}
          width={1200}
          height={649}
          sizes="(max-width: 760px) 100vw, 640px"
        />
        <span className="z1-city-badge">{event.city}</span>
      </button>
      <div className="z1-event-meta">
        <span>{formatEventDate(event.startsAt)}</span>
        <span>{formatEventTime(event.startsAt, event.endsAt)}</span>
      </div>
      <h3>
        {bookable ? (
          <button type="button" className="z1-title-button" onClick={() => onBook(event)}>
            {event.title}
          </button>
        ) : (
          event.title
        )}
      </h3>
      <p className="z1-venue">
        {event.venue ? `${event.venue} · ${event.city}` : event.city}
      </p>
      {!past && (
        <div
          className="z1-event-description"
          dangerouslySetInnerHTML={{ __html: event.descriptionHtml }}
        />
      )}
      <div className="z1-card-bottom">
        {past ? (
          <>
            <span>Wish you were here?</span>
            <button type="button" className="z1-pill z1-outline" onClick={() => onNotify(event)}>
              Notify
            </button>
          </>
        ) : bookingClosed ? (
          <>
            <span className="z1-sold-out">Bookings closed</span>
            <button type="button" className="z1-pill z1-outline" onClick={() => onNotify(event)}>
              Notify
            </button>
          </>
        ) : event.soldOut ? (
          <>
            <span className="z1-sold-out">Sold out</span>
            <button type="button" className="z1-pill z1-outline" onClick={() => onNotify(event)}>
              Notify
            </button>
          </>
        ) : (
          <>
            <span>
              From <strong>{formatMoney(event.minPrice, event.currencyCode)}</strong> / ticket
            </span>
            <button type="button" className="z1-pill" data-book="" onClick={() => onBook(event)}>
              Book tickets <span aria-hidden="true">↗</span>
            </button>
          </>
        )}
      </div>
    </article>
  )
}
