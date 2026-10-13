import { useEffect, useState } from 'react'
import { CONTACT } from '../../../../server/ai/knowledge.js'
import { PhoneIcon } from '../lib/Icons.jsx'

const NAV = [
  { href: '#jadwal', label: 'Jadwal' },
  { href: '#armada', label: 'Armada' },
  { href: '#fasilitas', label: 'Fasilitas' },
  { href: '#pariwisata', label: 'Pariwisata' },
]

export default function Header() {
  const [open, setOpen] = useState(false)

  // Tutup menu saat viewport membesar ke desktop, dan kunci scroll saat terbuka.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 860) setOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open ])

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <a className="brand" href="#top" onClick={() => setOpen(false)}>
          <span className="brand__mark" aria-hidden="true">
            JT
          </span>
          <span className="brand__text">
            <span className="brand__name">Jokam Trans</span>
            <span className="brand__tag">Antar Kota • Pariwisata</span>
          </span>
        </a>

        <div className="header-actions">
          <a
            className="header-phone"
            href={CONTACT.phoneHref}
            aria-label={`Telepon ${CONTACT.phone}`}
          >
            {CONTACT.phone}
          </a>
          <nav
            className="site-nav"
            data-open={open ? 'true' : 'false'}
            aria-label="Navigasi utama"
            id="navigasi-utama"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="site-nav__link"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <a
              className="btn btn--accent btn--sm site-nav__cta"
              href={CONTACT.phoneHref}
              onClick={() => setOpen(false)}
            >
              <PhoneIcon size={14} />
              <span className="header-cta__full">Hubungi Kami</span>
              <span className="header-cta__short">Hubungi</span>
            </a>
          </nav>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="navigasi-utama"
            aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="nav-toggle__bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
