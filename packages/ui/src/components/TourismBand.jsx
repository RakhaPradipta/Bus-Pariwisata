import { CONTACT, FACTS } from '../../../../server/ai/knowledge.js'
import { PHOTOS, photoSrc } from '../lib/photos.js'
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from '../lib/Icons.jsx'

const PHOTO = PHOTOS.armadaTerminal

/** Bagian pariwisata & carter rombongan — semua klaim dari knowledge.js. */
export default function TourismBand({ fleet }) {
  const classes = [...new Set(fleet.map((bus) => bus.class))]

  return (
    <section
      className="tourism"
      id="pariwisata"
      style={{
        backgroundImage: `linear-gradient(rgba(5, 5, 5, 0.78), rgba(5, 5, 5, 0.92)), url('${photoSrc('armadaTerminal')}')`,
      }}
    >
      <div className="container tourism__inner">
        <div className="tourism__copy">
          <span className="section__eyebrow">Pariwisata</span>
          <h2 className="tourism__title">
            Sewa bus pariwisata, carter, dan perjalanan rombongan
          </h2>
          <p className="tourism__lead">
            Rombongan, acara kantor, ziarah, atau wisata keluarga? {FACTS.group}{' '}
            Untuk pemesanan online, satu pemesanan mencakup {FACTS.maxSeats}
          </p>

          <div className="tourism__classes">
            <span className="tourism__classes-label">Kelas yang tersedia:</span>
            {classes.map((cls) => (
              <span key={cls} className="badge badge--accent">
                {cls}
              </span>
            ))}
          </div>

          <p className="photo-credit photo-credit--tourism">
            <span className="photo-chip">Ilustrasi</span>
            {PHOTO.subject} — {PHOTO.credit}
          </p>
        </div>

        <div className="tourism__contact">
          <h3 className="tourism__contact-title">Hubungi kami</h3>
          <p className="tourism__contact-note">
            Layanan pelanggan siap membantu penawaran rombongan.
          </p>

          <a className="btn btn--accent btn--lg btn--block" href={CONTACT.phoneHref}>
            <PhoneIcon size={16} /> {CONTACT.phone}
          </a>

          <ul className="contact-list">
            <li>
              <span className="contact-list__icon">
                <MailIcon size={15} />
              </span>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </li>
            <li>
              <span className="contact-list__icon">
                <ClockIcon size={15} />
              </span>
              <span>{CONTACT.hours}</span>
            </li>
            <li>
              <span className="contact-list__icon">
                <MapPinIcon size={15} />
              </span>
              <span>{CONTACT.pool}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
