import { longDate, rupiah, timeOf, todayInput } from '../lib/format.js'

/** Satu jadwal = satu kartu. */
function ScheduleCard({ schedule }) {
  return (
    <article className="sched-card">
      <span className="sched-card__time">{timeOf(schedule.departureTime)}</span>
      <span className="sched-card__route">
        {schedule.origin} <i aria-hidden="true">→</i> {schedule.destination}
      </span>
      <span className="sched-card__bus">{schedule.bus?.name}</span>
      <span className="sched-card__foot">
        <span className="badge badge--brand">{schedule.bus?.class}</span>
        {schedule.seatsAvailable > 0 ? (
          <span className="badge badge--success">{schedule.seatsAvailable} kursi</span>
        ) : (
          <span className="badge badge--danger">Penuh</span>
        )}
        <strong className="sched-card__price">{rupiah(schedule.price)}</strong>
      </span>
    </article>
  )
}

/**
 * Deret kartu berjalan tanpa putus: isi diduplikasi satu putaran penuh,
 * lalu track digeser -50% sehingga sambungannya mulus.
 * `direction` = arah gerak: `right` (ke kanan) atau `left` (ke kiri).
 */
function MarqueeRow({ items, direction, loading }) {
  if (loading) {
    return (
      <div className="marquee" aria-hidden="true">
        <div className="marquee__track marquee__track--static">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="skeleton sched-card__skeleton" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`marquee marquee--${direction}`}>
      <div className="marquee__track">
        {items.map((s) => (
          <ScheduleCard key={s.id} schedule={s} />
        ))}
        {items.map((s) => (
          <ScheduleCard key={`${s.id}-dup`} schedule={s} />
        ))}
      </div>
    </div>
  )
}

/** Papan jadwal hari ini — dua baris kartu berjalan, berlawanan arah. */
export default function ScheduleBoard({ schedules, count, loading }) {
  const half = Math.ceil(schedules.length / 2) || 1
  const rowTop = schedules.slice(0, half)
  const rowBottom = schedules.slice(half)

  return (
    <section className="section" id="jadwal">
      <div className="container section__head">
        <span className="section__eyebrow">Jadwal</span>
        <h2>Keberangkatan hari ini</h2>
        <p className="section__sub text-muted">
          {longDate(todayInput())} · {count} jadwal aktif — satu kartu satu
          jadwal, berjalan otomatis.
        </p>
      </div>

      <div className="marquee-stack" aria-label="Daftar jadwal keberangkatan hari ini">
        <MarqueeRow items={rowTop} direction="right" loading={loading} />
        <MarqueeRow items={rowBottom} direction="left" loading={loading} />
      </div>

      {!loading && schedules.length > 0 && (
        <div className="container section__foot">
          <p className="text-muted section__note">
            Semua {count} jadwal hari ini tampil di dua baris — arahkan kursor ke
            kartu untuk menjeda.
          </p>
          <a className="btn btn--outline btn--sm" href="#cari-jadwal">
            Cari jadwal lain
          </a>
        </div>
      )}
    </section>
  )
}
