'use client'

import { useEffect, useRef, useState } from 'react'
import {
  collectErrors,
  FIELD_LIMITS,
  type FieldErrors,
  validateCity,
  validateConsent,
  validateEmail,
  validateName,
  validatePhone,
} from '@/lib/validation'

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (!open) return
    setBusy(false)
    setError('')
    setDone('')
    setFieldErrors({})
    setSelectedCity(city)
    dialog.current?.showModal()
  }, [open, city])

  function setFieldError(field: string, message: string | null) {
    setFieldErrors((current) => {
      const next = { ...current }
      if (message) next[field] = message
      else delete next[field]
      return next
    })
  }

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    if (busy) return
    const form = formEvent.currentTarget
    const data = new FormData(form)
    const name = String(data.get('name') || '')
    const email = String(data.get('email') || '')
    const phone = String(data.get('phone') || '')
    const chosenCity = String(data.get('city') || '')

    const problems = collectErrors({
      name: validateName(name),
      phone: validatePhone(phone),
      email: validateEmail(email),
      city: validateCity(chosenCity),
      consent: validateConsent(data.get('consent') === 'Yes'),
    })

    setFieldErrors(problems)
    if (Object.keys(problems).length > 0) {
      setError('')
      return
    }

    setBusy(true)
    setError('')

    try {
      const response = await fetch('/api/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          city: chosenCity.trim(),
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
        <form onSubmit={submit} noValidate>
          <div className="z1-form-grid">
            <label className={fieldErrors.name ? 'z1-field z1-field--invalid' : 'z1-field'}>
              Name
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={FIELD_LIMITS.name}
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.name)}
                onBlur={(event) => setFieldError('name', validateName(event.target.value))}
              />
              {fieldErrors.name && <span className="z1-field-error">{fieldErrors.name}</span>}
            </label>
            <label className={fieldErrors.phone ? 'z1-field z1-field--invalid' : 'z1-field'}>
              Contact number
              <input
                type="tel"
                name="phone"
                inputMode="numeric"
                autoComplete="tel"
                required
                maxLength={FIELD_LIMITS.phone}
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.phone)}
                onBlur={(event) => setFieldError('phone', validatePhone(event.target.value))}
              />
              {fieldErrors.phone && <span className="z1-field-error">{fieldErrors.phone}</span>}
            </label>
            <label
              className={`z1-full ${fieldErrors.email ? 'z1-field z1-field--invalid' : 'z1-field'}`}
            >
              Email
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={FIELD_LIMITS.email}
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.email)}
                onBlur={(event) => setFieldError('email', validateEmail(event.target.value))}
              />
              {fieldErrors.email && <span className="z1-field-error">{fieldErrors.email}</span>}
            </label>
            <label
              className={`z1-full ${fieldErrors.city ? 'z1-field z1-field--invalid' : 'z1-field'}`}
            >
              City of choice
              <select
                name="city"
                disabled={busy}
                value={selectedCity}
                aria-invalid={Boolean(fieldErrors.city)}
                onChange={(e) => {
                  setSelectedCity(e.target.value)
                  setFieldError('city', validateCity(e.target.value))
                }}
              >
                <option value="">Select your city</option>
                {cities.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {fieldErrors.city && <span className="z1-field-error">{fieldErrors.city}</span>}
            </label>
          </div>
          <label className={`z1-consent${fieldErrors.consent ? ' z1-consent--invalid' : ''}`}>
            <input
              type="checkbox"
              name="consent"
              value="Yes"
              disabled={busy}
              aria-invalid={Boolean(fieldErrors.consent)}
              onChange={(event) =>
                setFieldError('consent', validateConsent(event.target.checked))
              }
            />
            <span>
              I agree to be contacted about Zero1 events.
              {fieldErrors.consent && (
                <span className="z1-field-error">{fieldErrors.consent}</span>
              )}
            </span>
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
