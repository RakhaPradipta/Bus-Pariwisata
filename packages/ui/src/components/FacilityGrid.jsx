import { useMemo } from 'react'
import { FACTS } from '../../../../server/ai/knowledge.js'
import { FacilityIcon } from '../lib/facilities.jsx'
import {
  BusIcon,
  ClockIcon,
  LuggageIcon,
  ShieldIcon,
  TicketIcon,
} from '../lib/Icons.jsx'

/** Fakta kebijakan — hanya dari basis pengetahuan resmi (tanpa angka karangan). */
const FACT_CARDS = [
  { icon: LuggageIcon, title: 'Bagasi gratis', text: FACTS.baggage },
  {
    icon: ClockIcon,
    title: 'Datang tepat waktu',
    text: `${FACTS.arrival} ${FACTS.doorClose}`,
  },
  { icon: TicketIcon, title: 'E-tiket seketika', text: FACTS.ticket },
  { icon: ShieldIcon, title: 'Harga tanpa kejutan', text: FACTS.payment },
  { icon: BusIcon, title: 'Ketepatan jadwal', text: FACTS.punctuality },
]

/** Susun fasilitas unik + kelas mana yang memilikinya, dari data armada. */
function useFacilityCoverage(fleet) {
  return useMemo(() => {
    const order = []
    const map = new Map()
    for (const bus of fleet) {
      for (const facility of bus.facilities ?? []) {
        if (!map.has(facility)) {
          map.set(facility, { classes: new Set(), units: 0 })
          order.push(facility)
        }
        const entry = map.get(facility)
        entry.classes.add(bus.class)
        entry.units += 1
      }
    }
    return order.map((name) => ({
      name,
      classes: [...map.get(name).classes],
      all: map.get(name).units === fleet.length,
    }))
  }, [fleet])
}

export default function FacilityGrid({ fleet, loading }) {
  const coverage = useFacilityCoverage(fleet)

  return (
    <section className="section container" id="fasilitas">
      <div className="section__head">
        <span className="section__eyebrow">Fasilitas</span>
        <h2>Fasilitas onboard &amp; aturan perjalanan</h2>
        <p className="section__sub text-muted">
          Cakupan fasilitas dihitung dari unit armada aktif; aturan perjalanan
          diambil dari basis pengetahuan resmi Jokam Trans.
        </p>
      </div>

      <div className="facility-grid">
        {loading &&
          Array.from({ length: 8 }, (_, i) => (
            <span key={`skeleton-${i}`} className="skeleton facility-card__skeleton" />
          ))}

        {!loading &&
          coverage.map((item) => (
            <div key={item.name} className="facility-card">
              <span className="facility-card__icon">
                <FacilityIcon name={item.name} size={22} />
              </span>
              <strong className="facility-card__name">{item.name}</strong>
              <span className="facility-card__classes">
                {item.all
                  ? 'Semua kelas armada'
                  : `Kelas ${item.classes.join(', ')}`}
              </span>
            </div>
          ))}
      </div>

      <div className="fact-grid">
        {FACT_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.title} className="fact-card">
              <span className="fact-card__icon">
                <Icon size={20} />
              </span>
              <div>
                <h3 className="fact-card__title">{card.title}</h3>
                <p className="fact-card__text">{card.text}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
