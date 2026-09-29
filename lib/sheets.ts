import { createSign } from 'node:crypto'

/**
 * Append-only log of every submission to a Google Sheet, for the team to read
 * and export. Shopify stays the source of truth: a failed append is logged and
 * dropped, never surfaced to the visitor.
 */

export type SheetTab = 'Interest' | 'Bookings' | 'Orders' | 'Check-ins'

type Cell = string | number

export function isSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SHEETS_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  )
}

let cachedToken: { token: string; expiresAt: number } | null = null

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

/** Service account JWT bearer grant; tokens live an hour. */
async function accessToken(): Promise<string> {
  // Refresh five minutes early so a token never expires mid-request.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60_000) {
    return cachedToken.token
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL as string
  // Vercel and .env files keep the PEM on one line with literal \n.
  const key = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY as string).replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  )
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key)
  const assertion = `${header}.${claims}.${base64url(signature)}`

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  })
  const payload = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google token request ${response.status}: ${JSON.stringify(payload)}`)
  }

  cachedToken = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  }
  return cachedToken.token
}

async function appendRow(tab: SheetTab, values: Cell[]) {
  // Quoted so tab names with a hyphen parse as one sheet name.
  const range = encodeURIComponent(`'${tab}'!A1`)
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}` +
    `/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`

  // RAW stores every value as typed, so a name like "=HYPERLINK(...)" stays text.
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await accessToken()}`,
    },
    body: JSON.stringify({ values: [values] }),
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`Sheets append ${response.status}: ${await response.text()}`)
  }
}

/** India time as "29/09/2026 08:00 PM". */
export function istTime(date: Date | string = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
      .formatToParts(new Date(date))
      .map((part) => [part.type, part.value])
  )
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod.toUpperCase()}`
}

/** Appends one row. No-op when unconfigured; never throws. */
export async function logToSheet(tab: SheetTab, values: Cell[]) {
  if (!isSheetsConfigured()) return
  try {
    await appendRow(tab, [istTime(), ...values])
  } catch (error) {
    console.error(`[club-zero1] sheet append failed (${tab})`, error)
  }
}
