#!/usr/bin/env node
/**
 * Creates the `event` metafield definitions Club Zero1 reads, and prints what is
 * still missing. Safe to re-run: definitions that already exist are left alone.
 *
 *   SHOPIFY_STORE_DOMAIN=zero1soda.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *   npm run shopify:setup
 *
 * Pass --check to only report, without creating anything.
 */
import { readFileSync } from 'node:fs'

const API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || '2026-07'
const CHECK_ONLY = process.argv.includes('--check')

loadEnvFile('.env.local')

const domain = process.env.SHOPIFY_STORE_DOMAIN
const token = process.env.SHOPIFY_ADMIN_TOKEN

if (!domain || !token) {
  console.error('Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN (Admin API access token).')
  process.exit(1)
}

const DEFINITIONS = [
  { key: 'city', name: 'Event city', type: 'single_line_text_field' },
  { key: 'venue', name: 'Event venue', type: 'single_line_text_field' },
  { key: 'starts_at', name: 'Event starts at', type: 'date_time' },
  { key: 'ends_at', name: 'Event ends at', type: 'date_time' },
  { key: 'cancelled', name: 'Event cancelled', type: 'boolean' },
]

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match) continue
      const value = match[2].replace(/^["']|["']$/g, '')
      if (!process.env[match[1]]) process.env[match[1]] = value
    }
  } catch {
    // no .env.local — env vars may come from the shell
  }
}

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

async function existingDefinitions() {
  const data = await graphql(
    `query { metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: "event") { nodes { key name type { name } access { storefront } } } }`
  )
  return new Map(data.metafieldDefinitions.nodes.map((node) => [node.key, node]))
}

async function createDefinition(definition) {
  const data = await graphql(
    `mutation Create($input: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $input) {
        createdDefinition { key }
        userErrors { field message code }
      }
    }`,
    {
      input: {
        namespace: 'event',
        key: definition.key,
        name: definition.name,
        type: definition.type,
        ownerType: 'PRODUCT',
        pin: true,
        access: { storefront: 'PUBLIC_READ' },
      },
    }
  )
  const errors = data.metafieldDefinitionCreate.userErrors
  if (errors.length) throw new Error(errors.map((e) => `${e.code}: ${e.message}`).join('; '))
}

async function countEventProducts() {
  const type = process.env.SHOPIFY_EVENT_PRODUCT_TYPE || 'Event ticket'
  const data = await graphql(
    `query Events($query: String!) { products(first: 50, query: $query) { nodes { title productType } } }`,
    { query: `product_type:'${type}'` }
  )
  return { type, products: data.products.nodes }
}

const existing = await existingDefinitions()

for (const definition of DEFINITIONS) {
  const current = existing.get(definition.key)
  if (current) {
    const visible = current.access?.storefront === 'PUBLIC_READ'
    console.log(
      `  ok   event.${definition.key} (${current.type.name})${visible ? '' : '  ⚠ not readable by the Storefront API'}`
    )
    continue
  }
  if (CHECK_ONLY) {
    console.log(`  MISSING event.${definition.key} (${definition.type})`)
    continue
  }
  await createDefinition(definition)
  console.log(`  created event.${definition.key} (${definition.type})`)
}

const { type, products } = await countEventProducts()
console.log(`\nProducts with product type "${type}": ${products.length}`)
for (const product of products) console.log(`  · ${product.title}`)
if (products.length === 0) {
  console.log(
    `\nCreate one product per event, set its product type to "${type}", fill the event.* metafields,\n` +
      'and publish it to the sales channel your Storefront API token belongs to.'
  )
}
