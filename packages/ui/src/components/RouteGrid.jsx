import { duration, rupiah } from '../lib/format.js'
import { CITY_PHOTO, photoOf, photoSrc } from '../lib/photos.js'
import { ArrowRightIcon } from '../lib/Icons.jsx'

/** Grid rute populer — foto kota tujuan + tarif terendah dari database. */
export default function RouteGrid({ routes, loading, onPick }) {
  return (
    <section className="section container" id="rute-populer">
      <div className="section__head">
        <span className="section__eyebrow">Rute populer</span>
        <h2>Trayek paling banyak jadwalnya</h2>
        <p className="section__sub text-muted">
          Diurutkan dari jumlah jadwal aktif — tarif terendah di antara semua
          jadwal trayek tersebut.
        </p>
      </div>

      <div className="route-grid">
        {loading &&
          Array.from({ length: 6 }, (_, i) => (
            <div key={`skeleton-${i}`} className="route-card route-card--skeleton">
              <span className="skeleton route-card__skeleton-photo" />
              <span className="skeleton route-card__skeleton-line" />
              <span className="skeleton route-card__skeleton-line route-card__skeleton-line--short" />
            </div>
          ))}

        {!loading &&
          routes.map((r) => {
            const photoKey = CITY_PHOTO[r.destination] ?? CITY_PHOTO[r.origin]
            const photo = photoOf(photoKey)
            return (
              <button
                key={r.id}
                type="button"
                className="route-card"
                onClick={() => onPick(r)}
              >
                <span className="route-card__photo">
                  <img src={photoSrc(photoKey)} alt={photo.subject} loading="lazy" />
                  <span className="photo-chip">Ilustrasi</span>
                </span>
                <span className="route-card__body">
                  <span className="route-card__cities">
                    {r.origin} <span aria-hidden="true">→</span> {r.destination}
                  </span>
                  <span className="route-card__meta">
                    {duration(r.durationMinutes)} · {r.distanceKm} km
                  </span>
                  <span className="route-card__price">
                    mulai <strong>{rupiah(r.priceFrom)}</strong>
                  </span>
                </span>
                <span className="route-card__foot">
                  <span className="photo-credit">{photo.credit}</span>
                  <span className="route-card__cta" aria-hidden="true">
                    Pilih <ArrowRightIcon size={14} />
                  </span>
                </span>
              </button>
            )
          })}
      </div>
    </section>
  )
}
