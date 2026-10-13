import { duration, longDate, rupiah, timeOf } from '../lib/format.js'

const FACILITY_LABELS = {
  AC: 'AC',
  WiFi: 'Wi-Fi',
  'USB Charger': 'Colokan USB',
  'Reclining Seat': 'Kursi rebah',
  'Recliner 140°': 'Recliner 140°',
  'Kasur Recliner': 'Kasur recliner',
  Toilet: 'Toilet',
  Snack: 'Snack',
  Hiburan: 'Hiburan',
  Selimut: 'Selimut',
  Bantal: 'Bantal',
  'Makan Malam': 'Makan malam',
}

function ScheduleRow({ schedule }) {
  const facilities = (Array.isArray(schedule.bus?.facilities) ? schedule.bus.facilities : [])
    .slice(0, 4)

  return (
    <li className="result-row">
      <div className="result-row__time">
        <span className="result-row__depart">{timeOf(schedule.departureTime)}</span>
        <span className="result-row__arrive">{timeOf(schedule.arrivalTime)}</span>
      </div>

      <div className="result-row__route">
        <span className="result-row__city">{schedule.origin}</span>
        <span className="result-row__arrow" aria-hidden="true">
          →
        </span>
        <span className="result-row__city">{schedule.destination}</span>
        <span className="result-row__meta">
          {duration(schedule.durationMinutes)} · {schedule.distanceKm} km
        </span>
      </div>

      <div className="result-row__bus">
        <strong>{schedule.bus?.name ?? 'Armada Jokam Trans'}</strong>
        <span className="result-row__meta">
          {schedule.bus?.class} · {schedule.bus?.plate}
        </span>
        {facilities.length > 0 && (
          <span className="result-row__facilities">
            {facilities.map((f) => (
              <span key={f} className="badge badge--accent">
                {FACILITY_LABELS[f] ?? f}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="result-row__seats">
        <strong className={schedule.seatsAvailable > 0 ? 'is-available' : 'is-full'}>
          {schedule.seatsAvailable > 0 ? `${schedule.seatsAvailable} kursi` : 'Penuh'}
        </strong>
        <span className="result-row__meta">dari {schedule.totalSeats} kursi</span>
      </div>

      <div className="result-row__price">
        <span className="price price--lg">{rupiah(schedule.price)}</span>
        <span className="result-row__meta">per orang</span>
      </div>
    </li>
  )
}

/** Hasil pencarian jadwal — muncul tepat di bawah panel pencarian. */
export default function SearchResults({ result, error }) {
  if (!result && !error) return null

  return (
    <section className="section container" id="hasil" aria-live="polite">
      {error && <div className="alert alert--danger">{error}</div>}

      {result && (
        <>
          <div className="section__head">
            <span className="section__eyebrow">Hasil pencarian</span>
            <h2>
              {result.query.origin || 'Semua kota'}
              {result.query.destination ? ` → ${result.query.destination}` : ''}
            </h2>
            <p className="section__sub text-muted">
              {longDate(result.query.date)} · {result.count} jadwal ditemukan
            </p>
          </div>

          {result.schedules.length === 0 ? (
            <div className="empty">
              <p className="empty__title">Belum ada jadwal untuk pilihan ini.</p>
              <p className="text-muted">
                Coba tanggal lain, atau longgarkan pilihan kota.
              </p>
            </div>
          ) : (
            <ul className="results">
              {result.schedules.slice(0, 12).map((s) => (
                <ScheduleRow key={s.id} schedule={s} />
              ))}
            </ul>
          )}

          {result.schedules.length > 12 && (
            <p className="text-muted section__note">
              Menampilkan 12 dari {result.count} jadwal — persempit pilihan kota
              atau tanggal untuk hasil yang lebih sedikit.
            </p>
          )}
        </>
      )}
    </section>
  )
}
