#!/usr/bin/env node
/**
 * Subscribes this app to orders/create so every order gets a ticket key.
 *
 * The subscription must be created with THIS app's credentials: Shopify signs
 * webhook payloads with the client secret of the app that owns the
 * subscription, and /api/webhooks/orders verifies against that same secret.
 *
 *   SHOPIFY_STORE_DOMAIN=zero1soda.myshopify.com \
 *   SHOPIFY_APP_CLIENT_ID=… SHOPIFY_APP_CLIENT_SECRET=… \
 *   node scripts/register-webhook.mjs [--list]
 */
import { readFileSync } from 'node:fs'

const API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || '2026-07'
const LIST_ONLY = process.argv.includes('--list')

loadEnvFile('.env.local')

const domain = process.env.SHOPIFY_STORE_DOMAIN
// Shopify refuses callbacks on any domain attached to the store, which includes
// club.zero1soda.com, so this defaults to the project's vercel.app alias.
const base = process.env.WEBHOOK_CALLBACK_BASE || process.env.NEXT_PUBLIC_SITE_URL || ''
const callbackUrl = `${base.replace(/\/$/, '')}/api/webhooks/orders`

if (!base) {
  console.error('Set WEBHOOK_CALLBACK_BASE, e.g. https://zero1soda-club-sigma.vercel.app')
  process.exit(1)
}

if (!domain) {
  console.error('Set SHOPIFY_STORE_DOMAIN.')
  process.exit(1)
}

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match) continue
      if (!process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    // env may come from the shell
  }
}

async function adminToken() {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN
  const response = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_APP_CLIENT_ID,
      client_secret: process.env.SHOPIFY_APP_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  })
  const body = await response.text()
  try {
    const payload = JSON.parse(body)
    if (payload.access_token) return payload.access_token
    throw new Error(JSON.stringify(payload))
  } catch {
    const reason = body.match(/<title>([^<]+)<\/title>/)?.[1] || `HTTP ${response.status}`
    throw new Error(`Token request failed: ${reason}`)
  }
}

const token = await adminToken()

async function graphql(query, variables = {}) {
  const response = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  })
  const payload = await response.json()
  if (!response.ok || payload.errors) {
    throw new Error(`${response.status} ${JSON.stringify(payload.errors || payload)}`)
  }
  return payload.data
}

const existing = await graphql(
  `query { webhookSubscriptions(first: 25, topics: [ORDERS_CREATE]) { nodes { id topic uri } } }`
)

console.log(`Existing orders/create subscriptions owned by this app: ${existing.webhookSubscriptions.nodes.length}`)
for (const node of existing.webhookSubscriptions.nodes) {
  console.log(`  · ${node.uri}`)
}

if (LIST_ONLY) process.exit(0)

if (existing.webhookSubscriptions.nodes.some((n) => n.uri === callbackUrl)) {
  console.log(`\nAlready subscribed to ${callbackUrl} — nothing to do.`)
  process.exit(0)
}

const result = await graphql(
  `mutation Subscribe($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
      webhookSubscription { id }
      userErrors { field message }
    }
  }`,
  { topic: 'ORDERS_CREATE', subscription: { callbackUrl, format: 'JSON' } }
)

const errors = result.webhookSubscriptionCreate.userErrors
if (errors.length) {
  console.error('\nFailed:', errors.map((e) => e.message).join('; '))
  process.exit(1)
}

console.log(`\nSubscribed orders/create → ${callbackUrl}`)
