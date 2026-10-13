/**
 * Smoke test end-to-end.
 *
 * Menjalankan server di port terpisah sebagai child process, lalu menguji
 * alur utama: cari jadwal → peta kursi → booking → tiket → panel admin.
 *
 * Jalankan: npm run smoke
 */
import { spawn } from 'node:child_process'

const PORT = Number(process.env.SMOKE_PORT ?? 4123)
const BASE = `http://localhost:${PORT}`

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const request = async (path, options) => {
  const res = await fetch(`${BASE}${path}`, options)
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

const post = (path, data, headers = {}) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data),
  })

/** Menunggu server siap menerima request. */
async function waitForServer(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const { body } = await request('/api/health')
      if (body?.ok) return true
    } catch {
      /* belum siap */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Membaca balasan asisten (Server-Sent Events) sampai aliran selesai. */
async function chat(message, sessionId = 'smoke') {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  })
  if (res.status !== 200) return { status: res.status, events: [], text: '' }

  const raw = await res.text()
  const events = []
  for (const frame of raw.split('\n\n')) {
    if (!frame.trim()) continue
    let event = 'message'
    let data = null
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) {
        try {
          data = JSON.parse(line.slice(5).trim())
        } catch {
          data = null
        }
      }
    }
    if (data) events.push({ event, data })
  }

  const text = events
    .filter((e) => e.event === 'chunk')
    .map((e) => e.data.text)
    .join('')
  const cards = events.find((e) => e.event === 'cards')?.data.items ?? []
  const intent = events.find((e) => e.event === 'meta')?.data.intent ?? null
  return { status: res.status, events, text, cards, intent }
}

const server = spawn(
  process.execPath,
  ['--disable-warning=ExperimentalWarning', 'server/index.js'],
  { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] },
)

const serverLog = []
server.stdout.on('data', (chunk) => serverLog.push(chunk.toString()))
server.stderr.on('data', (chunk) => serverLog.push(chunk.toString()))

try {
  if (!(await waitForServer())) throw new Error('Server tidak siap dalam batas waktu')
  console.log(`\n🔎 Smoke test API ${BASE}\n`)

  /* ---------- Publik ---------- */
  console.log('Publik:')
  const health = await request('/api/health')
  check('GET /api/health', health.status === 200 && health.body.ok)

  const cities = await request('/api/cities')
  check('GET /api/cities', cities.status === 200 && cities.body.cities.length > 0,
    `${cities.body.cities.length} kota`)

  const popular = await request('/api/routes/popular')
  check('GET /api/routes/popular', popular.status === 200 && popular.body.routes.length > 0,
    `${popular.body.routes.length} rute`)

  const date = tomorrow()
  const search = await request(`/api/schedules?origin=Jakarta&destination=Surabaya&date=${date}`)
  check('GET /api/schedules (cari rute)', search.status === 200 && search.body.count > 0,
    `${search.body.count} jadwal`)

  // Jadwal paling awal bisa saja sudah penuh oleh pengujian sebelumnya, jadi
  // pakai jadwal yang masih paling banyak menyisakan kursi.
  const schedule = [...search.body.schedules].sort(
    (a, b) => b.seatsAvailable - a.seatsAvailable,
  )[0]
  check('Data jadwal lengkap',
    Number.isInteger(schedule.totalSeats) && Number.isInteger(schedule.seatsAvailable) &&
    schedule.bus?.name && schedule.price > 0,
    `${schedule.bus.name} • ${schedule.seatsAvailable}/${schedule.totalSeats} kursi • Rp${schedule.price}`)

  const detail = await request(`/api/schedules/${schedule.id}`)
  check('GET /api/schedules/:id (peta kursi)',
    detail.status === 200 && detail.body.seatMap.length === schedule.totalSeats,
    `${detail.body.seatMap.length} kursi di peta`)

  /* ---------- Booking ---------- */
  console.log('\nBooking:')
  const booked = new Set(detail.body.bookedSeats)
  const freeSeats = detail.body.seatMap
    .map((s) => s.number)
    .filter((n) => !booked.has(n))
    .slice(0, 2)

  const contact = { name: 'Uji Otomatis', phone: '08123456789', email: 'qa@27trans.test' }
  const created = await post('/api/bookings', {
    scheduleId: schedule.id,
    contact,
    passengers: freeSeats.map((n, i) => ({ seatNumber: n, name: `Penumpang ${i + 1}` })),
  })
  check('POST /api/bookings', created.status === 201 && Boolean(created.body.booking?.code),
    created.status === 201
      ? `${created.body.booking.code} • Rp${created.body.booking.totalPrice}`
      : `status ${created.status}: ${created.body?.error}`)

  // Tanpa kode pemesanan, sisa pengujian booking tidak bisa dilanjutkan.
  const code = created.body.booking?.code
  if (!code) {
    console.error(
      '\n💥 Pemesanan uji tidak bisa dibuat — kemungkinan semua kursi pada jadwal uji\n' +
        '   sudah terisi oleh pengujian sebelumnya. Jalankan `npm run seed:reset`\n' +
        '   untuk menyegarkan data contoh, lalu ulangi `npm run smoke`.',
    )
    throw new Error('pemesanan uji gagal dibuat')
  }

  check('Harga = harga jadwal × jumlah kursi',
    created.body.booking.totalPrice === schedule.price * freeSeats.length)

  const ticket = await request(`/api/bookings/${code}`)
  check('GET /api/bookings/:code (tiket)',
    ticket.status === 200 && ticket.body.booking.seats.length === freeSeats.length,
    `kursi ${ticket.body.booking.seats.map((s) => s.seatNumber).join(', ')}`)

  const dup = await post('/api/bookings', {
    scheduleId: schedule.id,
    contact,
    passengers: freeSeats.map((n) => ({ seatNumber: n, name: 'Bentrok' })),
  })
  check('Kursi bentrok ditolak (409)', dup.status === 409, dup.body.error)

  const invalid = await post('/api/bookings', { scheduleId: schedule.id, contact: { name: 'X' }, passengers: [] })
  check('Validasi form kosong (400)', invalid.status === 400, invalid.body.error)

  const notFound = await request('/api/bookings/KODE-NGASAL')
  check('Kode tiket ngasal → 404', notFound.status === 404)

  /* ---------- Admin ---------- */
  console.log('\nAdmin:')
  const badLogin = await post('/api/admin/login', { username: 'admin', password: 'salah' })
  check('Login password salah → 401', badLogin.status === 401)

  const login = await post('/api/admin/login', { username: 'admin', password: 'admin123' })
  check('POST /api/admin/login', login.status === 200 && login.body.token)
  const auth = { Authorization: `Bearer ${login.body.token}` }

  const stats = await request('/api/admin/stats', { headers: auth })
  check('GET /api/admin/stats',
    stats.status === 200 && stats.body.totalBookings > 0,
    `${stats.body.totalBookings} pemesanan • Rp${stats.body.revenue} • ${stats.body.activeSchedules} jadwal aktif`)

  const adminBookings = await request('/api/admin/bookings', { headers: auth })
  check('GET /api/admin/bookings', adminBookings.status === 200 && adminBookings.body.bookings.length > 0,
    `${adminBookings.body.bookings.length} baris`)

  const adminSchedules = await request('/api/admin/schedules', { headers: auth })
  check('GET /api/admin/schedules', adminSchedules.status === 200 && adminSchedules.body.schedules.length > 0,
    `${adminSchedules.body.schedules.length} jadwal`)

  check('Akses admin tanpa token → 401',
    (await request('/api/admin/stats')).status === 401)

  const newSchedule = await post('/api/admin/schedules', {
    routeId: schedule.routeId,
    busId: schedule.bus.id,
    departureTime: `${date}T23:45`,
    price: 123000,
  }, auth)
  check('POST /api/admin/schedules (tambah jadwal)', newSchedule.status === 201)

  const dupSchedule = await post('/api/admin/schedules', {
    routeId: schedule.routeId,
    busId: schedule.bus.id,
    departureTime: `${date}T23:45`,
    price: 123000,
  }, auth)
  check('Jadwal duplikat ditolak (409)', dupSchedule.status === 409)

  check('DELETE /api/admin/schedules/:id',
    (await request(`/api/admin/schedules/${newSchedule.body.id}`, { method: 'DELETE', headers: auth })).status === 200)

  check('DELETE jadwal yang sudah dipesan → 409',
    (await request(`/api/admin/schedules/${schedule.id}`, { method: 'DELETE', headers: auth })).status === 409)

  /* ---------- Asisten AI ---------- */
  console.log('\nAsisten:')
  const info = await request('/api/assistant/info')
  check('GET /api/assistant/info',
    info.status === 200 && info.body.mode === 'rules' && info.body.capabilities.length > 0,
    `mode: ${info.body.mode} (tanpa kunci API)`)

  check('Alternatif tanpa parameter → 400',
    (await request('/api/routes/alternatives')).status === 400)

  const alt = await request('/api/routes/alternatives?origin=Solo&destination=Banyuwangi&date=' + date)
  check('GET /api/routes/alternatives',
    alt.status === 200 && Array.isArray(alt.body.sameOrigin) && Array.isArray(alt.body.transfers),
    `${alt.body.sameOrigin.length + alt.body.sameDestination.length} alternatif, ${alt.body.transfers.length} transit`)

  const cheapest = Math.min(...search.body.schedules.map((s) => s.price))
  const ask = await chat(`besok dari jakarta ke surabaya buat 2 orang`)
  check('POST /api/chat (cari jadwal)',
    ask.status === 200 && ask.intent === 'cari_jadwal' && ask.cards.length > 0,
    `intent ${ask.intent} • ${ask.cards.length} kartu`)
  check('Harga asisten = harga termurah dari API',
    ask.text.includes(`Rp ${cheapest.toLocaleString('id-ID')}`),
    `Rp ${cheapest.toLocaleString('id-ID')}`)

  const seats = await chat('sarankan kursi paling nyaman')
  check('Asisten menyarankan kursi (deterministik)',
    seats.status === 200 && /kursi paling nyaman/i.test(seats.text) && seats.cards.length === 1,
    seats.text.slice(0, 90))

  const baggage = await chat('aturan bagasi berapa kg?')
  check('Kebijakan bagasi menyebut angka resmi (20 kg)',
    baggage.status === 200 && baggage.text.includes('20 kg'))

  const offTopic = await chat('coba ramal cuaca besok dong')
  check('Pertanyaan di luar wewenang ditolak tanpa mengarang harga',
    offTopic.status === 200 && !/Rp\s?\d/.test(offTopic.text), offTopic.text.slice(0, 80))

  const tracked = await chat(`lacak tiket ${code}`)
  check('Lacak tiket lewat asisten',
    tracked.status === 200 && tracked.text.includes(code), code)

  const unknownCode = await chat('lacak tiket 27T-ZZZZZZ')
  check('Kode tidak terdaftar → asisten jujur',
    unknownCode.status === 200 && /tidak terdaftar/i.test(unknownCode.text))

  check('Asisten tanpa kode → 400',
    (await chat('')).status === 400)

  check('Asisten menolak pesan terlalu panjang → 400',
    (await chat('a'.repeat(501))).status === 400)

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} lulus, ${failed} gagal\n`)
} catch (err) {
  console.error('\n💥 Error:', err.message)
  failed++
} finally {
  server.kill()
  setTimeout(() => {
    if (serverLog.length && failed > 0) console.error(serverLog.join(''))
    process.exit(failed === 0 ? 0 : 1)
  }, 300)
}
