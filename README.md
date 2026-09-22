# Club Zero1

Events site for Club Zero1, hosted on Vercel at **club.zero1soda.com**.
Products and checkout stay on Shopify (`zero1soda`); this app is a headless
storefront for the events catalogue.

Built from the approved `Club Zero1 — Events preview.html` design: the CSS,
markup and copy are the same, the Shopify plumbing is new.

## How it works

```
club.zero1soda.com (Vercel, Next.js)
  ├── page  ── Storefront API ──► products with product type "Event ticket"
  └── /api/checkout ── cartCreate ──► redirect to cart.checkoutUrl
                                        └── checkout runs on zero1soda.com
```

- Event data comes from Shopify **products**, one product per event. Date, city
  and venue live in `event.*` product metafields.
- Booking creates a **new Shopify cart** server-side and redirects the buyer to
  Shopify's hosted checkout. The Storefront token never reaches the browser.
- "Register your interest" writes a tagged Shopify customer through the Admin
  API (optional — see below).

## Shopify setup

### 1. Metafield definitions

The app reads five product metafields in the `event` namespace. Create them once:

```bash
SHOPIFY_STORE_DOMAIN=zero1soda.myshopify.com \
SHOPIFY_APP_CLIENT_ID=… SHOPIFY_APP_CLIENT_SECRET=… \
npm run shopify:setup          # add --check to report without creating
```

| Metafield | Type | Example |
|---|---|---|
| `event.city` | `single_line_text_field` | `Coimbatore` |
| `event.venue` | `single_line_text_field` | `Coz Cafe` |
| `event.starts_at` | `date_time` | `2026-10-12T19:00:00` |
| `event.ends_at` | `date_time` | `2026-10-12T21:00:00` |
| `event.cancelled` | `boolean` | `false` |

The script creates them with Storefront access `PUBLIC_READ`. If you create them
by hand in **Settings → Custom data → Products**, turn on *Storefront access* —
without it the API returns `null` and every event is skipped.

Times without a timezone are read as IST. `ends_at` defaults to start + 2h.
An event with no `starts_at` is not rendered.

### 2. One product per event

- Product type: **`Event ticket`** (exact match, override with `SHOPIFY_EVENT_PRODUCT_TYPE`).
- Price = ticket price. Variants = ticket types (General entry, Early bird, …).
- Inventory = seats. Track inventory so sold-out events show as sold out.
- Featured image = event poster; falls back to `/public/images/event-placeholder.png`.
- Publish the product to the sales channel your Storefront token belongs to,
  otherwise the Storefront API cannot see it.
- Cancelled an event? Set `event.cancelled` to `true` — it disappears from the page.

### 3. Tokens

Shopify stopped allowing new **admin-created custom apps on 1 January 2026**, so
`Settings → Apps → Develop apps` is no longer the route. Existing legacy apps
still work; new credentials come from the Headless channel and the Dev Dashboard.

**Storefront API token (required)** — Shopify admin → Apps → install the
**Headless** channel → **Create storefront**. It issues a public and a private
token and manages its own channel permissions. Put the private one in
`SHOPIFY_STOREFRONT_PRIVATE_TOKEN` (it is server-side only, which is where every
call in this app runs); `SHOPIFY_STOREFRONT_TOKEN` takes the public token if you
prefer. In the storefront's **Storefront API permissions**, keep read access to
products and inventory and write access to checkouts. Publish event products to
this Headless storefront, or the API returns nothing.

**Admin API credentials (optional — interest form only)** — Dev Dashboard
(`dev.shopify.com/dashboard/<org-id>/apps`) → create an app → on a version,
select scopes `read_customers` and `write_customers` → Release → Install on the
store. Copy **Client ID** and **Client secret** from the app's Settings into
`SHOPIFY_APP_CLIENT_ID` / `SHOPIFY_APP_CLIENT_SECRET`. There is no token to copy:
`lib/shopify.ts` exchanges those credentials for a 24-hour token through the
client credentials grant and caches it in memory.

The client credentials grant only works when the app and the store are in the
**same Shopify organization** (`shop_not_permitted` otherwise). If zero1soda is
not in the org that owns the app, distribute the app to the store with custom
distribution and use the authorization code grant instead — or skip the form and
leave the Admin credentials unset, which shows a "not connected yet" message.

## Local development

```bash
cp .env.example .env.local     # fill in SHOPIFY_STORE_DOMAIN + a storefront token
npm install
npm run dev                    # http://localhost:3000
```

Without Shopify env vars the page renders sample events behind a yellow
"Sample data" banner, so the design can be reviewed before the store is ready.

```bash
npm run build       # production build
npm run typecheck   # tsc --noEmit
```

## Deploying to Vercel

```bash
npx vercel link        # or import the repo at vercel.com/new
npx vercel env add SHOPIFY_STORE_DOMAIN production
npx vercel env add SHOPIFY_STOREFRONT_PRIVATE_TOKEN production
npx vercel env add SHOPIFY_APP_CLIENT_ID production      # optional
npx vercel env add SHOPIFY_APP_CLIENT_SECRET production  # optional
npx vercel --prod
```

Set the `NEXT_PUBLIC_*` variables too (see `.env.example`) — they are read at
build time for links and metadata.

### DNS for club.zero1soda.com

1. Vercel project → Settings → Domains → add `club.zero1soda.com`.
2. At the DNS host for `zero1soda.com`, add the record Vercel shows —
   normally `CNAME club → cname.vercel-dns.com`.
3. Leave the apex/`www` records alone: they must keep pointing at Shopify.

The Shopify store keeps serving `www.zero1soda.com`, including checkout.

## Differences from the Liquid preview

The preview was written to run **inside** the Shopify theme. Three things could
not carry over to a separate domain, and were rebuilt:

1. **Cart.** The preview used the Ajax Cart API (`/cart/add.js`) and the shared
   theme cart. Cross-origin that is impossible, so each booking now creates its
   own cart via `cartCreate`. Consequence: a Club Zero1 booking does **not**
   merge with a soda cart started on `www.zero1soda.com`, and the "10 tickets
   already in your cart" check is now a per-checkout limit
   (`SITE.maxTicketsPerCheckout`), not a store-wide one.
2. **Interest form.** The preview posted to Shopify's `/contact` endpoint.
   It now posts to `/api/interest`, which tags a Shopify customer
   (`club-zero1`, `club-city:<city>`) through the Admin API. It deliberately does
   not touch email marketing consent — segment the list by the tag instead, so an
   existing customer who opted out stays opted out.
3. **Fonts and images.** The preview embedded Anton, Poppins and every photo as
   base64. Fonts now load through `next/font`; the logo, mascot and gallery
   photos were decoded into `public/images/`. Replace the gallery photos and
   `event-placeholder.png` with final artwork when it is ready.

## Layout

```
app/
  page.tsx              server component: fetches events, renders nav + hero
  layout.tsx            fonts, metadata
  globals.css           design CSS, scoped to .z1
  api/checkout/route.ts cartCreate → checkoutUrl
  api/interest/route.ts tagged Shopify customer
components/
  SiteNav.tsx           header + mobile drawer
  ClubPage.tsx          filter, upcoming/past split, gallery, dialogs
  EventCard.tsx         one event card
  BookingDialog.tsx     ticket form → checkout
  InterestDialog.tsx    notify-me form
lib/
  shopify.ts            Storefront + Admin fetch helpers
  events.ts             events query and mapping
  sample-events.ts      placeholder data until Shopify is wired up
  format.ts             IST date/time and money formatting
  site.ts               links, gallery, ticket limit
scripts/
  setup-shopify.mjs     creates the event.* metafield definitions
```
