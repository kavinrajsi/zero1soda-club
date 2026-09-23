/**
 * Booking and interest form rules. Shared by the dialogs and the routes behind
 * them so a field can never pass in the browser and fail on the server, or the
 * reverse. No Node APIs here — this runs in both places.
 */

export const FIELD_LIMITS = {
  name: 120,
  email: 254,
  phone: 20,
  city: 100,
} as const

/** Letters, spaces and the marks real names carry. No digits. */
const NAME_SHAPE = /^[\p{L}][\p{L}\p{M}'’.\- ]*$/u
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

export function validateName(value: string): string | null {
  const name = value.trim()
  if (!name) return 'Enter your name.'
  if (name.length < 2) return 'Name looks too short.'
  if (name.length > FIELD_LIMITS.name) return 'Name is too long.'
  if (!NAME_SHAPE.test(name)) return 'Use letters only — no numbers or symbols.'
  return null
}

export function validateEmail(value: string): string | null {
  const email = value.trim()
  if (!email) return 'Enter your email address.'
  if (email.length > FIELD_LIMITS.email) return 'Email address is too long.'
  if (!EMAIL_SHAPE.test(email)) return 'That email address looks wrong.'
  if (email.includes('..')) return 'That email address looks wrong.'
  return null
}

/**
 * Indian mobile numbers: ten digits starting 6-9, with an optional +91, 91 or
 * leading 0 that we drop. Returns the bare ten digits, or null when it is not
 * a number we can call.
 */
export function normalisePhone(value: string): string | null {
  const digits = value.replace(/[^\d]/g, '')
  const local = digits.replace(/^(?:0|91|091)/, '')
  return /^[6-9]\d{9}$/.test(local) ? local : null
}

export function validatePhone(value: string): string | null {
  const phone = value.trim()
  if (!phone) return 'Enter your contact number.'
  if (phone.length > FIELD_LIMITS.phone) return 'Contact number is too long.'
  if (!normalisePhone(phone)) return 'Enter a 10-digit mobile number.'
  return null
}

export function validateCity(value: string): string | null {
  return value.trim() ? null : 'Choose your city.'
}

export function validateConsent(checked: boolean): string | null {
  return checked ? null : 'Tick the box to continue.'
}

export function validateTicketType(variantId: string, available: boolean): string | null {
  if (!variantId) return 'Choose a ticket type.'
  if (!available) return 'That ticket type is sold out. Pick another.'
  return null
}

export function validateQuantity(value: number, max: number): string | null {
  if (!Number.isInteger(value) || value < 1) return 'Choose at least one ticket.'
  if (value > max) return `Only ${max} ticket${max === 1 ? '' : 's'} left for this event.`
  return null
}

export type FieldErrors = Record<string, string>

/** Runs every rule and returns only the fields that failed. */
export function collectErrors(
  checks: Record<string, string | null>
): FieldErrors {
  const errors: FieldErrors = {}
  for (const [field, error] of Object.entries(checks)) {
    if (error) errors[field] = error
  }
  return errors
}
