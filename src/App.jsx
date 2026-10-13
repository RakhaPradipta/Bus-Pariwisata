import { useEffect, useState } from 'react'
import { api } from '../packages/ui/src/lib/api.js'
import { todayInput } from '../packages/ui/src/lib/format.js'
import Header from '../packages/ui/src/components/Header.jsx'
import Hero from '../packages/ui/src/components/Hero.jsx'
import SearchResults from '../packages/ui/src/components/SearchResults.jsx'
import ScheduleBoard from '../packages/ui/src/components/ScheduleBoard.jsx'
import BrandTicker from '../packages/ui/src/components/BrandTicker.jsx'
import RouteGrid from '../packages/ui/src/components/RouteGrid.jsx'
import FleetGrid from '../packages/ui/src/components/FleetGrid.jsx'
import FacilityGrid from '../packages/ui/src/components/FacilityGrid.jsx'
import TourismBand from '../packages/ui/src/components/TourismBand.jsx'
import SiteFooter from '../packages/ui/src/components/SiteFooter.jsx'

/* ------------------------------------------------------------------ */
/* Beranda Jokam Trans.                                                    */
/* Semua angka yang tampil diambil langsung dari API (database) dan     */
/* kebijakan dari basis pengetahuan server — tidak ada angka karangan.  */
/* ------------------------------------------------------------------ */

export default function App() {
  const [cities, setCities] = useState([])
  const [routes, setRoutes] = useState([])
  const [popular, setPopular] = useState([])
  const [fleet, setFleet] = useState([])
  const [today, setToday] = useState({ count: 0, schedules: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [query, setQuery] = useState({
    origin: '',
    destination: '',
    date: todayInput(),
  })
  const [result, setResult] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)

  useEffect(() => {
    let alive = true

    Promise.all([
      api.cities(),
      api.routes(),
      api.popularRoutes(),
      api.fleet(),
      api.searchSchedules({ date: todayInput() }),
    ])
      .then(([c, r, p, f, s]) => {
        if (!alive) return
        setCities(c.cities ?? [])
        setRoutes(r.routes ?? [])
        setPopular(p.routes ?? [])
        setFleet(f.fleet ?? [])
        setToday({ count: s.count ?? 0, schedules: s.schedules ?? [] })
        setLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        setLoadError(err.message)
        setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [])

  const stats = {
    cities: cities.length,
    routes: routes.length,
    fleet: fleet.length,
    today: today.count,
  }

  function setField(field, value) {
    setQuery((q) => ({ ...q, [field]: value }))
  }

  function swapCities() {
    setQuery((q) => ({ ...q, origin: q.destination, destination: q.origin }))
  }

  function pickRoute(route) {
    setQuery((q) => ({ ...q, origin: route.origin, destination: route.destination }))
    document.getElementById('cari-jadwal')?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleSearch(event) {
    event.preventDefault()
    if (query.origin && query.destination && query.origin === query.destination) {
      setSearchError('Kota asal dan tujuan tidak boleh sama.')
      return
    }

    setSearching(true)
    setSearchError(null)
    try {
      const data = await api.searchSchedules({
        origin: query.origin || undefined,
        destination: query.destination || undefined,
        date: query.date,
      })
      setResult({ ...data, query: { ...query } })
      requestAnimationFrame(() => {
        document.getElementById('hasil')?.scrollIntoView({ behavior: 'smooth' })
      })
    } catch (err) {
      setResult(null)
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="shell">
      <Header />
      <main>
        {loadError && (
          <div className="container section">
            <div className="alert alert--danger" role="alert">
              {loadError} — pastikan API berjalan (npm run server), lalu muat
              ulang halaman.
            </div>
          </div>
        )}

        <Hero
          cities={cities}
          query={query}
          onField={setField}
          onSwap={swapCities}
          onSubmit={handleSearch}
          onQuickDate={(date) => setField('date', date)}
          searching={searching}
          loading={loading}
          stats={stats}
        />

        <SearchResults result={result} error={searchError} />

        <BrandTicker />

        <ScheduleBoard
          schedules={today.schedules}
          count={today.count}
          loading={loading}
        />

        <RouteGrid routes={popular} loading={loading} onPick={pickRoute} />

        <FleetGrid fleet={fleet} loading={loading} />

        <FacilityGrid fleet={fleet} loading={loading} />

        <TourismBand fleet={fleet} />
      </main>
      <SiteFooter />
    </div>
  )
}
