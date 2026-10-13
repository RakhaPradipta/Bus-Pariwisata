/**
 * Data demo Jokam Trans untuk hosting statis (mis. Vercel).
 *
 * Dipakai HANYA bila browser tidak dapat mencapai API Express — mis. hasil
 * build `dist/` dibuka sebagai situs statis tanpa server. Datanya meniru
 * `server/seed.js` (rute, armada, slot jam, pengali kelas yang sama) dan
 * bentuk responsnya identik dengan `server/queries.js`, sehingga tampilan
 * tidak berubah sama sekali.
 *
 * Penjadwalan deterministik dari tanggal: tanggal yang sama selalu
 * menghasilkan jadwal yang sama. Bukan data live — pemesanan, admin, dan
 * asisten tetap membutuhkan server (`npm run server`).
 */

const ROUTES = [
  ['Jakarta', 'Bandung', 150, 180, 130000],
  ['Jakarta', 'Cirebon', 220, 210, 150000],
  ['Jakarta', 'Semarang', 450, 420, 260000],
  ['Jakarta', 'Yogyakarta', 550, 540, 320000],
  ['Jakarta', 'Solo', 580, 570, 340000],
  ['Jakarta', 'Surabaya', 760, 720, 400000],
  ['Jakarta', 'Malang', 850, 840, 430000],
  ['Bandung', 'Semarang', 380, 390, 230000],
  ['Bandung', 'Yogyakarta', 430, 450, 250000],
  ['Bandung', 'Surabaya', 650, 630, 340000],
  ['Cirebon', 'Semarang', 230, 225, 160000],
  ['Purwokerto', 'Jakarta', 320, 330, 200000],
  ['Semarang', 'Surabaya', 350, 330, 200000],
  ['Solo', 'Surabaya', 260, 240, 165000],
  ['Yogyakarta', 'Surabaya', 320, 300, 190000],
  ['Yogyakarta', 'Malang', 430, 420, 240000],
  ['Surabaya', 'Malang', 95, 120, 75000],
  ['Surabaya', 'Banyuwangi', 300, 330, 185000],
]

const BUSES = [
  {
    id: 1,
    name: 'Jokam Trans Executive',
    plate: 'B 1727 TRS',
    class: 'Eksekutif',
    seatRows: 11,
    seatCols: 4,
    aisleAfter: 2,
    facilities: ['AC', 'WiFi', 'USB Charger', 'Reclining Seat', 'Snack', 'Toilet'],
  },
  {
    id: 2,
    name: 'Jokam Trans Executive Plus',
    plate: 'B 5727 TRS',
    class: 'Eksekutif',
    seatRows: 10,
    seatCols: 4,
    aisleAfter: 2,
    facilities: ['AC', 'WiFi', 'USB Charger', 'Reclining Seat', 'Toilet'],
  },
  {
    id: 3,
    name: 'Jokam Trans VIP',
    plate: 'B 2727 TRS',
    class: 'VIP',
    seatRows: 8,
    seatCols: 3,
    aisleAfter: 2,
    facilities: ['AC', 'WiFi', 'USB Charger', 'Recliner 140°', 'Selimut', 'Toilet', 'Hiburan'],
  },
  {
    id: 4,
    name: 'Jokam Trans Sleeper',
    plate: 'B 3727 TRS',
    class: 'Sleeper',
    seatRows: 6,
    seatCols: 3,
    aisleAfter: 1,
    facilities: [
      'AC',
      'WiFi',
      'USB Charger',
      'Kasur Recliner',
      'Selimut',
      'Bantal',
      'Toilet',
      'Makan Malam',
    ],
  },
  {
    id: 5,
    name: 'Jokam Trans Ekonomi',
    plate: 'B 4727 TRS',
    class: 'Ekonomi',
    seatRows: 12,
    seatCols: 4,
    aisleAfter: 2,
    facilities: ['AC', 'USB Charger'],
  },
]

const CLASS_MULTIPLIER = { Ekonomi: 0.8, Eksekutif: 1, VIP: 1.35, Sleeper: 1.9 }
const DEPARTURE_SLOTS = ['06:00', '08:30', '11:00', '14:00', '17:30', '20:00', '21:30']
const SLOTS_PER_DAY = 3

/** Hash string deterministik (FNV-1a) → bilangan 32-bit. */
function hashString(value) {
  let h = 2166136261
  const str = String(value)
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Selisih hari (bilangan bulat) antara tanggal `YYYY-MM-DD` dan hari ini. */
function dayOffset(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr ?? ''))
  if (!match) return 0
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

function addMinutes(dateTime, minutes) {
  const [date, time] = String(dateTime).split(' ')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const dt = new Date(y, mo - 1, d, h, mi + Number(minutes))
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`
}

function priceFor(basePrice, busClass) {
  return Math.round((basePrice * (CLASS_MULTIPLIER[busClass] ?? 1)) / 1000) * 1000
}

function publicBus(bus) {
  return {
    id: bus.id,
    name: bus.name,
    class: bus.class,
    plate: bus.plate,
    seatRows: bus.seatRows,
    seatCols: bus.seatCols,
    aisleAfter: bus.aisleAfter,
    totalSeats: bus.seatRows * bus.seatCols,
    facilities: [...bus.facilities],
  }
}

/** Jadwal demo untuk satu tanggal — 3 keberangkatan per rute, seperti seed. */
function schedulesForDate(dateStr) {
  const offset = dayOffset(dateStr)
  const out = []

  ROUTES.forEach(([origin, destination, distanceKm, durationMinutes, basePrice], routeIndex) => {
    for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
      const bus = BUSES[(routeIndex + offset + slot) % BUSES.length]
      const time = DEPARTURE_SLOTS[(routeIndex + slot * 2 + 1) % DEPARTURE_SLOTS.length]
      const departureTime = `${dateStr} ${time}`
      const totalSeats = bus.seatRows * bus.seatCols
      // Kursi tersedia pseudo-acak namun stabil per tanggal + rute + slot.
      const seatsAvailable = hashString(`${dateStr}|${routeIndex}|${slot}`) % (totalSeats + 1)
      out.push({
        id: (routeIndex + 1) * 100 + slot,
        routeId: routeIndex + 1,
        departureTime,
        arrivalTime: addMinutes(departureTime, durationMinutes),
        price: priceFor(basePrice, bus.class),
        origin,
        destination,
        distanceKm,
        durationMinutes,
        bus: publicBus(bus),
        totalSeats,
        seatsAvailable,
      })
    }
  })

  return out.sort((a, b) => a.departureTime.localeCompare(b.departureTime))
}

export function demoCities() {
  const cities = new Set()
  ROUTES.forEach(([origin, destination]) => {
    cities.add(origin)
    cities.add(destination)
  })
  return { cities: [...cities].sort((a, b) => a.localeCompare(b, 'id')) }
}

export function demoFleet() {
  return { fleet: BUSES.map(publicBus) }
}

export function demoRoutes() {
  return {
    routes: ROUTES.map(([origin, destination, distanceKm, durationMinutes, basePrice], i) => ({
      id: i + 1,
      origin,
      destination,
      distanceKm,
      durationMinutes,
      basePrice,
      scheduleCount: SLOTS_PER_DAY,
    })),
  }
}

export function demoPopularRoutes() {
  // Meniru `GET /api/routes/popular`: 6 rute terjauh + tarif termurah.
  const cheapest = Math.min(...Object.values(CLASS_MULTIPLIER))
  return {
    routes: ROUTES.map(([origin, destination, distanceKm, durationMinutes, basePrice], i) => ({
      id: i + 1,
      origin,
      destination,
      distanceKm,
      durationMinutes,
      priceFrom: Math.round((basePrice * cheapest) / 1000) * 1000,
    }))
      .sort((a, b) => b.distanceKm - a.distanceKm)
      .slice(0, 6),
  }
}

export function demoSearch(params = {}) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(params.date ?? '')) ? params.date : todayLocal()
  const origin = String(params.origin ?? '').trim() || null
  const destination = String(params.destination ?? '').trim() || null

  const schedules = schedulesForDate(date).filter(
    (s) =>
      (!origin || s.origin === origin) &&
      (!destination || s.destination === destination) &&
      (!params.busClass || s.bus?.class === params.busClass),
  )

  const limited = schedules.slice(0, 120)
  return { count: limited.length, schedules: limited }
}

/**
 * Melayani endpoint baca milik beranda dalam mode demo.
 * Melempar Error untuk endpoint tulis/admin/asisten yang butuh server.
 */
export async function demoRequest(path, { method = 'GET' } = {}) {
  const [pathname, queryString] = String(path).split('?')
  const params = Object.fromEntries(new URLSearchParams(queryString ?? ''))

  if (method === 'GET' && pathname === '/cities') return demoCities()
  if (method === 'GET' && pathname === '/routes') return demoRoutes()
  if (method === 'GET' && pathname === '/routes/popular') return demoPopularRoutes()
  if (method === 'GET' && pathname === '/fleet') return demoFleet()
  if (method === 'GET' && pathname === '/schedules') return demoSearch(params)
  if (method === 'GET' && pathname === '/health') return { ok: true, service: '27-trans-demo' }

  const err = new Error(
    'Fitur ini membutuhkan server API yang sedang berjalan (mode demo hanya untuk melihat-lihat).',
  )
  err.name = 'ApiError'
  err.status = 0
  throw err
}
