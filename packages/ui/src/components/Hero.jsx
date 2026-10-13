import {
  compactDay,
  dateInputPlus,
  number,
} from '../lib/format.js'
import { PHOTOS, photoSrc } from '../lib/photos.js'
import { ArrowLeftRightIcon } from '../lib/Icons.jsx'

const QUICK_DATES = [
  { label: 'Hari ini', days: 0 },
  { label: 'Besok', days: 1 },
  { label: 'Lusa', days: 2 },
]

const HERO = PHOTOS.heroJalanTol

export default function Hero({
  cities,
  query,
  onField,
  onSwap,
  onSubmit,
  onQuickDate,
  searching,
  loading,
  stats,
}) {
  return (
    <section
      className="hero"
      id="top"
      style={{
        backgroundImage: `linear-gradient(rgba(5, 5, 5, 0.62), rgba(5, 5, 5, 0.9)), url('${photoSrc('heroJalanTol')}')`,
      }}
    >
      <div className="container hero__inner">
        <p className="hero__eyebrow">Bus antar kota • Tiket online • Pariwisata</p>
        <h1 className="hero__title">
          Pesan tiket bus Jokam Trans, <span className="hl">berangkat tepat waktu.</span>
        </h1>
        <p className="hero__lead">
          Pilih jadwal keberangkatan, lihat sisa kursi, dan harga resmi langsung
          dari data armada — tanpa biaya tersembunyi.
        </p>

        <form className="search-panel" id="cari-jadwal" onSubmit={onSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="from">
              Dari
            </label>
            <select
              className="select"
              id="from"
              value={query.origin}
              onChange={(e) => onField('origin', e.target.value)}
              disabled={loading}
            >
              <option value="">Semua kota</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            className="search-panel__swap"
            type="button"
            onClick={onSwap}
            aria-label="Tukar kota asal dan tujuan"
            title="Tukar kota asal & tujuan"
          >
            <ArrowLeftRightIcon size={18} />
          </button>

          <div className="field">
            <label className="field__label" htmlFor="to">
              Ke
            </label>
            <select
              className="select"
              id="to"
              value={query.destination}
              onChange={(e) => onField('destination', e.target.value)}
              disabled={loading}
            >
              <option value="">Semua kota</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="field search-panel__date">
            <label className="field__label" htmlFor="date">
              Tanggal
            </label>
            <input
              className="input"
              id="date"
              type="date"
              value={query.date}
              onChange={(e) => onField('date', e.target.value)}
            />
          </div>

          <button
            className="btn btn--accent btn--lg search-panel__submit"
            type="submit"
            disabled={searching}
          >
            {searching ? 'Mencari…' : 'Cari Jadwal'}
          </button>

          <div className="search-panel__quick">
            <span className="search-panel__quick-label">Cepat:</span>
            {QUICK_DATES.map((item) => {
              const value = dateInputPlus(item.days)
              const active = query.date === value
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`chip${active ? ' chip--active' : ''}`}
                  onClick={() => onQuickDate(value)}
                >
                  {item.label}
                  <span className="search-panel__quick-day">{compactDay(value)}</span>
                </button>
              )
            })}
          </div>
        </form>

        <div className="stats">
          <div className="stats__item">
            <strong className="stats__num">{number(stats.cities)}</strong>
            <span className="stats__label">Kota terlayani</span>
          </div>
          <div className="stats__item">
            <strong className="stats__num">{number(stats.routes)}</strong>
            <span className="stats__label">Trayek aktif</span>
          </div>
          <div className="stats__item">
            <strong className="stats__num">{number(stats.fleet)}</strong>
            <span className="stats__label">Unit armada</span>
          </div>
          <div className="stats__item">
            <strong className="stats__num">{number(stats.today)}</strong>
            <span className="stats__label">Jadwal hari ini</span>
          </div>
        </div>

        <p className="photo-credit photo-credit--hero">
          <span className="photo-chip">Ilustrasi</span>
          {HERO.subject} — {HERO.credit}
        </p>
      </div>
    </section>
  )
}
