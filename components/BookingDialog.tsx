'use client'

import { useEffect, useRef, useState } from 'react'
import type { ClubEvent } from '@/lib/types'
import { formatEventDate, formatEventTime, formatMoney } from '@/lib/format'
import { SITE } from '@/lib/site'

type Props = {
  event: ClubEvent | null
  onClose: () => void
}

const MAX = SITE.maxTicketsPerCheckout

export default function BookingDialog({ event, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!event) return
    const firstAvailable = event.variants.find((variant) => variant.availableForSale)
    setVariantId(firstAvailable?.id || '')
    setQuantity(1)
    setError('')
    setStatus('')
    setBusy(false)
    dialog.current?.showModal()
  }, [event])

  if (!event) return null

  const variant = event.variants.find((item) => item.id === variantId) || null
  const stockCeiling = variant?.quantityAvailable ?? MAX
  const maxQuantity = Math.max(1, Math.min(MAX, stockCeiling))
  const subtotal = variant ? formatMoney(variant.price * quantity, variant.currencyCode) : '—'

  function close() {
    if (busy) return
    dialog.current?.close()
  }

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (busy || !event || !variant) return

    const form = formEvent.currentTarget
    if (!form.reportValidity()) return

    const data = new FormData(form)
    setBusy(true)
    setError('')
    setStatus('Reserving your tickets…')

    try {
      if (event.endsAt * 1000 <= Date.now()) {
        throw new Error('This event has ended. Please choose another event.')
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: variant.id,
          quantity,
          event: {
            title: event.title,
            city: event.city,
            venue: event.venue,
            startsAt: event.startsAt,
          },
          booker: {
            name: String(data.get('name') || '').trim(),
            email: String(data.get('email') || '').trim(),
            phone: String(data.get('phone') || '').trim(),
          },
        }),
      })

      const payload = (await response.json()) as { checkoutUrl?: string; error?: string }
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || 'We could not start your checkout. Please try again.')
      }

      setStatus('Tickets reserved. Opening Shopify checkout…')
      window.location.assign(payload.checkoutUrl)
    } catch (submitError) {
      setStatus('')
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <dialog className="z1-dialog" ref={dialog} onClose={onClose} aria-labelledby="Z1BookingTitle">
      <button type="button" className="z1-close" aria-label="Close booking" onClick={close}>
        ×
      </button>
      <p className="z1-kicker">
        {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt, event.endsAt)}
      </p>
      <h2 id="Z1BookingTitle">{event.title}</h2>
      <p className="z1-venue">{event.venue ? `${event.venue} · ${event.city}` : event.city}</p>
      <div
        className="z1-description"
        dangerouslySetInnerHTML={{ __html: event.descriptionHtml }}
      />

      <form onSubmit={submit} noValidate={false}>
        <div className="z1-form-grid z1-booker-fields">
          <label>
            Name
            <input name="name" autoComplete="name" required maxLength={120} disabled={busy} />
          </label>
          <label>
            Contact number
            <input type="tel" name="phone" autoComplete="tel" required maxLength={30} disabled={busy} />
          </label>
          <label className="z1-full">
            Email
            <input type="email" name="email" autoComplete="email" required maxLength={254} disabled={busy} />
          </label>
          {event.variants.length > 1 && (
            <label className="z1-full">
              Ticket type
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                disabled={busy}
                required
              >
                {event.variants.map((item) => (
                  <option key={item.id} value={item.id} disabled={!item.availableForSale}>
                    {item.title} — {formatMoney(item.price, item.currencyCode)}
                    {item.availableForSale ? '' : ' (sold out)'}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="z1-quantity-row">
          <span>Tickets</span>
          <div className="z1-stepper">
            <button
              type="button"
              aria-label="Remove one ticket"
              disabled={busy || quantity <= 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={maxQuantity}
              value={quantity}
              disabled={busy}
              onChange={(e) =>
                setQuantity(Math.min(maxQuantity, Math.max(1, Number(e.target.value) || 1)))
              }
              aria-label="Number of tickets"
            />
            <button
              type="button"
              aria-label="Add one ticket"
              disabled={busy || quantity >= maxQuantity}
              onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
            >
              +
            </button>
          </div>
        </div>

        <p className="z1-help">
          Up to {maxQuantity} ticket{maxQuantity === 1 ? '' : 's'} per checkout.
          {variant?.quantityAvailable !== null && variant?.quantityAvailable !== undefined
            ? ` ${variant.quantityAvailable} left.`
            : ''}
        </p>

        <label className="z1-consent">
          <input type="checkbox" name="consent" value="Yes" required disabled={busy} />
          <span>I agree to be contacted about this booking and future Zero1 events.</span>
        </label>

        <div className="z1-subtotal">
          <span>Subtotal</span>
          <strong>{subtotal}</strong>
        </div>

        <p className="z1-error" role="alert">
          {error}
        </p>
        <p role="status">{status}</p>

        <button type="submit" className="z1-pill z1-submit" disabled={busy || !variant}>
          {busy ? 'Working…' : 'Continue to checkout'} <span aria-hidden="true">↗</span>
        </button>
        <a className="z1-cart-link" href={`${SITE.storeUrl}/cart`} target="_blank" rel="noopener noreferrer">
          Checkout is completed securely on zero1soda.com
        </a>
      </form>
    </dialog>
  )
}
