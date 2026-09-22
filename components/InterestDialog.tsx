'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  open: boolean
  eventName: string
  city: string
  cities: string[]
  onClose: () => void
}

export default function InterestDialog({ open, eventName, city, cities, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [selectedCity, setSelectedCity] = useState(city)

  useEffect(() => {
    if (!open) return
    setBusy(false)
    setError('')
    setDone('')
    setSelectedCity(city)
    dialog.current?.showModal()
  }, [open, city])

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (busy) return
    const form = formEvent.currentTarget
    if (!form.reportValidity()) return

    const data = new FormData(form)
    setBusy(true)
    setError('')

    try {
      const response = await fetch('/api/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') || '').trim(),
          email: String(data.get('email') || '').trim(),
          phone: String(data.get('phone') || '').trim(),
          city: String(data.get('city') || '').trim(),
          event: eventName,
        }),
      })

      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'We could not save your details. Please try again.')
      }
      setDone('Thanks — we will be in touch when there is something for you.')
      form.reset()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog className="z1-dialog" ref={dialog} onClose={onClose} aria-labelledby="Z1InterestTitle">
      <button
        type="button"
        className="z1-close"
        aria-label="Close notification form"
        onClick={() => dialog.current?.close()}
      >
        ×
      </button>
      <p className="z1-kicker">DON&rsquo;T MISS THE NEXT ONE</p>
      <h2 id="Z1InterestTitle">KEEP ME IN THE LOOP.</h2>
      <p>Tell us your city. We&rsquo;ll be in touch when there&rsquo;s something for you.</p>

      {done ? (
        <p className="z1-message" role="status">
          {done}
        </p>
      ) : (
        <form onSubmit={submit}>
          <div className="z1-form-grid">
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
            <label className="z1-full">
              City of choice
              <select
                name="city"
                required
                disabled={busy}
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                <option value="">Select your city</option>
                {cities.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="z1-consent">
            <input type="checkbox" name="consent" value="Yes" required disabled={busy} />
            <span>I agree to be contacted about Zero1 events.</span>
          </label>
          <p className="z1-error" role="alert">
            {error}
          </p>
          <button type="submit" className="z1-pill z1-submit" disabled={busy}>
            {busy ? 'Sending…' : 'Register interest'}
          </button>
        </form>
      )}
    </dialog>
  )
}
