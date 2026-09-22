/** Store-facing links and copy that are not worth a Shopify round trip. */
export const SITE = {
  storeUrl: process.env.NEXT_PUBLIC_STORE_URL || 'https://www.zero1soda.com',
  whatsappUrl:
    process.env.NEXT_PUBLIC_WHATSAPP_URL ||
    'https://chat.whatsapp.com/C1pghxGXy76AoYbMByMZK8?mode=gi_t',
  /** Cities offered in the "notify me" form on top of the ones with live events. */
  notifyCities: (process.env.NEXT_PUBLIC_NOTIFY_CITIES || 'Bengaluru,Chennai,Coimbatore')
    .split(',')
    .map((city) => city.trim())
    .filter(Boolean),
  maxTicketsPerCheckout: 10,
  gallery: [
    { src: '/images/gallery-1.png', caption: 'Workshop moments' },
    { src: '/images/gallery-2.png', caption: 'The Zero1 community' },
    { src: '/images/gallery-3.png', caption: 'Try something new' },
  ],
}
