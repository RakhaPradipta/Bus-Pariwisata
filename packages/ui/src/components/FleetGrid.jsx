import { CLASS_PHOTO, PHOTO_NOTICE, photoOf, photoSrc } from '../lib/photos.js'
import { FacilityList } from '../lib/facilities.jsx'
import { UsersIcon } from '../lib/Icons.jsx'

/** Deretan armada: satu kartu per unit aktif, fasilitas dari database. */
export default function FleetGrid({ fleet, loading }) {
  return (
    <section className="section container" id="armada">
      <div className="section__head">
        <span className="section__eyebrow">Armada</span>
        <h2>Deretan armada Jokam Trans</h2>
        <p className="section__sub text-muted">
          {PHOTO_NOTICE} Foto kabin diurutkan berdasarkan kelas unit; data unit,
          plat, dan fasilitas diambil dari database.
        </p>
      </div>

      <div className="fleet-grid">
        {loading &&
          Array.from({ length: 3 }, (_, i) => (
            <div key={`skeleton-${i}`} className="fleet-card">
              <span className="skeleton fleet-card__skeleton-photo" />
              <span className="fleet-card__body">
                <span className="skeleton fleet-card__skeleton-line" />
                <span className="skeleton fleet-card__skeleton-line route-card__skeleton-line--short" />
              </span>
            </div>
          ))}

        {!loading &&
          fleet.map((bus) => {
            const photo = photoOf(CLASS_PHOTO[bus.class] ?? 'armadaAntarKota')
            return (
              <article key={bus.id} className="fleet-card">
                <figure className="fleet-card__figure">
                  <img
                    src={photoSrc(CLASS_PHOTO[bus.class] ?? 'armadaAntarKota')}
                    alt={`Ilustrasi kabin kelas ${bus.class}`}
                    loading="lazy"
                  />
                  <figcaption className="photo-credit">
                    <span className="photo-chip">Ilustrasi</span>
                    {photo.credit}
                  </figcaption>
                </figure>

                <div className="fleet-card__body">
                  <div className="fleet-card__top">
                    <h3 className="fleet-card__name">{bus.name}</h3>
                    <span className="badge badge--brand">{bus.class}</span>
                  </div>

                  <div className="fleet-card__meta">
                    <span className="plate">
                      <span className="plate__no">{bus.plate}</span>
                      <span className="plate__tab">JT</span>
                    </span>
                    <span className="fleet-card__seats">
                      <UsersIcon size={14} /> {bus.totalSeats} kursi
                    </span>
                  </div>

                  <FacilityList facilities={bus.facilities} showLabel limit={8} />
                </div>
              </article>
            )
          })}
      </div>
    </section>
  )
}
