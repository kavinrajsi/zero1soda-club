# Club Zero1 Shopify app

Holds the thank-you page extension that shows ticket QR codes right after
checkout. It is a separate project from the Next.js site: its own
`package.json`, excluded from the site's `tsconfig.json`, deployed with the
Shopify CLI rather than Vercel.

`extensions/club-tickets` calls `https://club.zero1soda.com/api/thank-you/tickets`
with a session token plus the buyer's checkout token; see
`app/api/thank-you/tickets/route.ts` for why both are needed.

## First-time setup

`shopify.app.toml` is not hand-written. It must be pulled from the live app so a
deploy never overwrites the app's scopes, redirect URLs or webhooks:

```sh
cd shopify-app
npm install
npx shopify app config link   # pick the existing Club Zero1 app, not "create new"
```

Check the pulled `shopify.app.toml` before the first deploy.

## Deploy

1. Partner / Dev Dashboard → the app → API access → allow network access in
   checkout UI extensions.
2. `npx shopify app deploy` (releases a new app version).
3. Shopify admin → Settings → Checkout → Customize → Thank you page → add the
   "Club tickets" block, then Save.
