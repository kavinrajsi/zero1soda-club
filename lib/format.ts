const TIME_ZONE = 'Asia/Kolkata'

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/** "20 Oct 2030" — fixed to IST so server and client render identically. */
export function formatEventDate(unixSeconds: number): string {
  return dateFormatter.format(new Date(unixSeconds * 1000))
}

/** "7:00 PM – 9:00 PM IST", collapsing the range when it fits on one clock time. */
export function formatEventTime(startsAt: number, endsAt: number): string {
  const start = timeFormatter.format(new Date(startsAt * 1000))
  const end = timeFormatter.format(new Date(endsAt * 1000))
  return start === end ? `${start} IST` : `${start} – ${end} IST`
}

export function formatMoney(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)
}
