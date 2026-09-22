#!/usr/bin/env node
/**
 * Splices docs/order-email-snippet.liquid into a copy of the Shopify order
 * confirmation template, so you can paste one finished file back into
 * Settings → Notifications → Order confirmation → Edit code.
 *
 *   1. Copy the template in Shopify (Edit code → Email body → select all)
 *   2. npm run email:merge -- --paste      (reads the clipboard)
 *   3. Copy docs/order-confirmation.merged.liquid back into Shopify
 *
 * Without --paste it reads docs/order-confirmation.liquid instead.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const SOURCE = 'docs/order-confirmation.liquid'
const SNIPPET = 'docs/order-email-snippet.liquid'
const OUTPUT = 'docs/order-confirmation.merged.liquid'

const FROM_CLIPBOARD = process.argv.includes('--paste')
const WAIT_SECONDS = 180

const clipboard = () => execFileSync('pbpaste', { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
const looksLikeTemplate = (text) => text.includes('{%') && text.includes('</html>')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let template
if (FROM_CLIPBOARD) {
  template = clipboard()

  // Copying the command itself overwrites the template, so rather than failing,
  // wait for the copy to happen while the user is in Shopify.
  if (!looksLikeTemplate(template)) {
    console.log('Waiting for you to copy the template…')
    console.log('Shopify → Settings → Notifications → Order confirmation → Edit code,')
    console.log('click inside the Email body box, then select all and copy.\n')

    const deadline = Date.now() + WAIT_SECONDS * 1000
    while (Date.now() < deadline) {
      await sleep(1500)
      const current = clipboard()
      if (looksLikeTemplate(current)) {
        template = current
        break
      }
    }
  }

  if (!looksLikeTemplate(template)) {
    console.error(`\nGave up after ${WAIT_SECONDS}s — the clipboard never held the template.`)
    console.error('Alternative: paste it into docs/order-confirmation.liquid and run without --paste.')
    process.exit(1)
  }

  writeFileSync(SOURCE, template)
  console.log(`Captured ${template.split('\n').length} lines into ${SOURCE}.`)
} else {
  try {
    template = readFileSync(SOURCE, 'utf8')
  } catch {
    console.error(
      `Missing ${SOURCE}.\nEither paste the template into it, or copy it in Shopify and run:\n` +
        '  npm run email:merge -- --paste'
    )
    process.exit(1)
  }
}

if (template.trim().length < 500) {
  console.error(`${SOURCE} looks empty. Paste the full template into it first.`)
  process.exit(1)
}

if (template.includes('club.ticket_key')) {
  console.error('That template already contains the ticket block. Nothing to do.')
  process.exit(1)
}

const snippet = readFileSync(SNIPPET, 'utf8').trimEnd()

// Anchor on the section that opens the Customer information block: the tickets
// belong after the order summary and before the address details.
const marker = '<h3>Customer information</h3>'
const markerAt = template.indexOf(marker)
if (markerAt === -1) {
  console.error(`Could not find "${marker}" in ${SOURCE}.`)
  console.error('The template may be customised; insert the snippet by hand instead.')
  process.exit(1)
}

const sectionOpen = template.lastIndexOf('<table class="row section">', markerAt)
if (sectionOpen === -1) {
  console.error('Found the heading but not the section table that opens it.')
  process.exit(1)
}

const lineStart = template.lastIndexOf('\n', sectionOpen) + 1
const indent = template.slice(lineStart, sectionOpen)

const block = `${indent}{%- comment -%} Club Zero1 event tickets — see docs/order-email-snippet.liquid {%- endcomment -%}\n${snippet}\n\n`
const merged = template.slice(0, lineStart) + block + template.slice(lineStart)

writeFileSync(OUTPUT, merged)

const lines = merged.slice(0, lineStart).split('\n').length
console.log(`Wrote ${OUTPUT}`)
console.log(`Ticket block inserted at line ${lines}, just above the Customer information section.`)
console.log(`\nCopy the whole file back into Shopify → Settings → Notifications → Order confirmation.`)
