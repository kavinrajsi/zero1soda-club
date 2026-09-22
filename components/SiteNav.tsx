'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { SITE } from '@/lib/site'

const LINKS = [
  { label: 'Happening now', href: '#Z1Upcoming' },
  { label: 'Shop Zero1 Soda', href: SITE.storeUrl, external: true },
  { label: 'Join the community', href: SITE.whatsappUrl, external: true },
]

export default function SiteNav() {
  const menu = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  // The drawer is only a drawer below 760px; above that the links are inline.
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const onChange = () => {
      if (!media.matches && menu.current?.open) menu.current.close()
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  function openMenu() {
    menu.current?.showModal()
    setOpen(true)
  }

  function closeMenu() {
    menu.current?.close()
  }

  function renderLink(link: (typeof LINKS)[number], onClick?: () => void) {
    const external = link.external
      ? { target: '_blank', rel: 'noopener noreferrer' }
      : {}
    return (
      <a key={link.label} className="z1-pill z1-white" href={link.href} onClick={onClick} {...external}>
        {link.label}
      </a>
    )
  }

  return (
    <>
      <nav className="z1-nav" aria-label="Club Zero1">
        <a className="z1-logo" href="#Zero1Top" aria-label="Club Zero1 home">
          <Image
            className="z1-brand-mark"
            src="/images/club-zero1-logo.png"
            alt="Club Zero1"
            width={1390}
            height={638}
            priority
          />
        </a>
        <div className="z1-nav-links">{LINKS.map((link) => renderLink(link))}</div>
        <button
          type="button"
          className="z1-menu-toggle"
          aria-label="Open menu"
          aria-controls="Z1Menu"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={openMenu}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </nav>
      <dialog
        className="z1-mobile-menu"
        id="Z1Menu"
        ref={menu}
        aria-labelledby="Z1MenuTitle"
        onClose={() => setOpen(false)}
      >
        <div className="z1-menu-top">
          <h2 id="Z1MenuTitle">CLUB ZERO1</h2>
          <button
            type="button"
            className="z1-menu-close"
            aria-label="Close menu"
            autoFocus
            onClick={closeMenu}
          >
            ×
          </button>
        </div>
        <nav className="z1-drawer-links" aria-label="Mobile navigation">
          {LINKS.map((link) => renderLink(link, closeMenu))}
        </nav>
      </dialog>
    </>
  )
}
