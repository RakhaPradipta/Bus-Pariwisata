import { CONTACT } from '../../../../server/ai/knowledge.js'
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from '../lib/Icons.jsx'

const NAV = [
  { href: '#jadwal', label: 'Jadwal hari ini' },
  { href: '#rute-populer', label: 'Rute populer' },
  { href: '#armada', label: 'Armada' },
  { href: '#fasilitas', label: 'Fasilitas' },
  { href: '#pariwisata', label: 'Pariwisata & carter' },
]

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__col site-footer__col--brand">
          <span className="brand brand--footer">
            <span className="brand__mark" aria-hidden="true">
              JT
            </span>
            JOKAM TRANS
          </span>
          <p className="text-muted">
            Bus antar kota &amp; pariwisata. Tiket dipesan online, jadwal dan
            ketersediaan kursi diambil langsung dari database armada.
          </p>
        </div>

        <div className="site-footer__col">
          <h4 className="site-footer__heading">Jelajahi</h4>
          <nav className="site-footer__links" aria-label="Navigasi footer">
            {NAV.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="site-footer__col">
          <h4 className="site-footer__heading">Hubungi kami</h4>
          <ul className="site-footer__contact">
            <li>
              <PhoneIcon size={14} />
              <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
            </li>
            <li>
              <MailIcon size={14} />
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </li>
            <li>
              <ClockIcon size={14} />
              <span>{CONTACT.hours}</span>
            </li>
            <li>
              <MapPinIcon size={14} />
              <span>{CONTACT.pool}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="container site-footer__bottom">
        <span className="text-muted">
          © {new Date().getFullYear()} Jokam Trans
        </span>
        <span className="text-muted">
          Foto pada halaman ini adalah ilustrasi suasana — kredit lengkap pemilik
          foto ada di CREDITS.md.
        </span>
      </div>
    </footer>
  )
}
