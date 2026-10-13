/**
 * API server Jokam Trans (Express + node:sqlite).
 * Semua operasi database bersifat sinkron, jadi tidak ada masalah async/race.
 */
import express from 'express'
import cors from 'cors'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomInt } from 'node:crypto'
import { db, initSchema, getBookedSeats } from './db.js'
import { seed } from './seed.js'
import { buildSeatMap, isValidSeat } from './seatmap.js'
import {
  serializeBus,
  querySchedules,
  findAlternatives,
} from './queries.js'
import { assistantRouter } from './ai/chat.js'
import {
  createSession,
  destroySession,
  hashPassword,
  requireAdmin,
  verifyPassword,
} from './auth.js'

const PORT = Number(process.env.PORT ?? 4000)
const app = express()

app.use(cors())
app.use(express.json({ limit: '256kb' }))

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateBookingCode() {
  const exists = db.prepare('SELECT 1 FROM bookings WHERE code = ?')
  for (let attempt = 0; attempt < 20; attempt++) {
    let suffix = ''
    for (let i = 0; i < 6; i++) suffix += ALPHABET[randomInt(ALPHABET.length)]
    const code = `27T-${suffix}`
    if (!exists.get(code)) return code
  }
  throw new Error('Gagal membuat kode pemesanan unik')
}

// Nama: huruf (termasuk non-latin), angka, spasi, dan tanda baca umum.
const NAME_MATCH = /^[\p{L}\p{N} .,'()/-]{2,60}$/u
const PHONE_MATCH = /^[0-9+()\-\s]{8,20}$/
const EMAIL_MATCH = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Validasi ringan; mengembalikan pesan error atau null bila lolos. */
function validatePassengerFields(contact, passengers) {
  if (!contact?.name || !NAME_MATCH.test(String(contact.name).trim()))
    return 'Nama pemesan wajib diisi (2–60 karakter).'
  if (!contact?.phone || !PHONE_MATCH.test(String(contact.phone).trim()))
    return 'Nomor WhatsApp/HP pemesan tidak valid.'
  if (contact.email && !EMAIL_MATCH.test(String(contact.email).trim()))
    return 'Format email pemesan tidak valid.'
  if (!Array.isArray(passengers) || passengers.length === 0)
    return 'Minimal pilih satu kursi.'
  if (passengers.length > 6) return 'Maksimal 6 kursi per pemesanan.'
  for (const p of passengers) {
    if (!Number.isInteger(p?.seatNumber)) return 'Nomor kursi tidak valid.'
    if (!p?.name || !NAME_MATCH.test(String(p.name).trim()))
      return `Nama penumpang kursi ${p?.seatNumber ?? '?'} tidak valid.`
  }
  return null
}

function publicTicket(bookingCode) {
  const booking = db
    .prepare('SELECT * FROM bookings WHERE code = ?')
    .get(bookingCode)
  if (!booking) return null

  const schedule = db
    .prepare(
      `SELECT s.id, s.departure_time AS departureTime, s.arrival_time AS arrivalTime, s.price,
              r.origin, r.destination, r.distance_km AS distanceKm, r.duration_minutes AS durationMinutes,
              b.id AS busId, b.name AS busName, b.class AS busClass, b.plate,
              b.seat_rows AS seatRows, b.seat_cols AS seatCols, b.aisle_after AS aisleAfter, b.facilities
         FROM schedules s
         JOIN routes r ON r.id = s.route_id
         JOIN buses b ON b.id = s.bus_id
        WHERE s.id = ?`,
    )
    .get(booking.schedule_id)

  const seats = db
    .prepare(
      `SELECT seat_number AS seatNumber, passenger_name AS passengerName,
              passenger_phone AS passengerPhone
         FROM booking_seats WHERE booking_id = ? ORDER BY seat_number`,
    )
    .all(booking.id)

  return {
    code: booking.code,
    status: booking.status,
    createdAt: booking.created_at,
    contact: {
      name: booking.contact_name,
      phone: booking.contact_phone,
      email: booking.contact_email,
    },
    totalPrice: booking.total_price,
    seatCount: seats.length,
    seats,
    schedule: {
      id: schedule.id,
      departureTime: schedule.departureTime,
      arrivalTime: schedule.arrivalTime,
      price: schedule.price,
      origin: schedule.origin,
      destination: schedule.destination,
      distanceKm: schedule.distanceKm,
      durationMinutes: schedule.durationMinutes,
    },
    bus: serializeBus(schedule),
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

app.get('/api/health', (_req, res) => res.json({ ok: true, service: '27-trans-api' }))

app.get('/api/cities', (_req, res) => {
  const rows = db.prepare('SELECT origin, destination FROM routes').all()
  const cities = new Set()
  rows.forEach((r) => {
    cities.add(r.origin)
    cities.add(r.destination)
  })
  res.json({ cities: [...cities].sort((a, b) => a.localeCompare(b, 'id')) })
})

app.get('/api/routes', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, 
              (SELECT COUNT(*) FROM schedules s WHERE s.route_id = r.id AND s.is_active = 1) AS scheduleCount
         FROM routes r ORDER BY r.origin, r.destination`,
    )
    .all()
  res.json({
    routes: rows.map((r) => ({
      id: r.id,
      origin: r.origin,
      destination: r.destination,
      distanceKm: r.distance_km,
      durationMinutes: r.duration_minutes,
      basePrice: r.base_price,
      scheduleCount: r.scheduleCount,
    })),
  })
})

/** Rute populer untuk halaman beranda (berdasarkan jumlah jadwal). */
app.get('/api/routes/popular', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.origin, r.destination, r.distance_km AS distanceKm,
              r.duration_minutes AS durationMinutes, MIN(s.price) AS priceFrom
         FROM routes r
         JOIN schedules s ON s.route_id = r.id AND s.is_active = 1
        GROUP BY r.id
        ORDER BY r.distance_km DESC
        LIMIT 6`,
    )
    .all()
  res.json({ routes: rows })
})

/** Daftar armada untuk halaman publik (tanpa data sensitif). */
app.get('/api/fleet', (_req, res) => {
  const rows = db.prepare('SELECT * FROM buses WHERE is_active = 1 ORDER BY id').all()
  res.json({
    fleet: rows.map((b) => ({
      id: b.id,
      name: b.name,
      class: b.class,
      plate: b.plate,
      seatRows: b.seat_rows,
      seatCols: b.seat_cols,
      aisleAfter: b.aisle_after,
      totalSeats: b.seat_rows * b.seat_cols,
      facilities: JSON.parse(b.facilities ?? '[]'),
    })),
  })
})

/**
 * Penyelamat hasil pencarian kosong.
 * Ketika rute yang diminta tidak ada, kembalikan alternatif NYATA dari
 * database (tujuan lain dari kota asal, kota lain ke tujuan yang sama,
 * atau perjalanan satu kali transit) supaya calon penumpang tidak buntu.
 */
app.get('/api/routes/alternatives', (req, res) => {
  const origin = req.query.origin?.trim() || null
  const destination = req.query.destination?.trim() || null
  const date = req.query.date?.trim() || null

  if (!origin || !destination)
    return res.status(400).json({ error: 'Parameter origin dan destination wajib diisi.' })

  res.json({
    origin,
    destination,
    date,
    ...findAlternatives({ origin, destination, date, limit: 4 }),
  })
})

app.get('/api/schedules', (req, res) => {
  const { origin, destination, date, busClass } = req.query
  const schedules = querySchedules({
    origin: origin?.trim() || null,
    destination: destination?.trim() || null,
    date: date?.trim() || null,
    busClass: busClass?.trim() || null,
    limit: 120,
  })
  res.json({ count: schedules.length, schedules })
})

app.get('/api/schedules/:id', (req, res) => {
  const id = Number(req.params.id)
  const row = db
    .prepare(
      `SELECT s.id, s.departure_time AS departureTime, s.arrival_time AS arrivalTime, s.price, s.is_active,
              r.id AS routeId, r.origin, r.destination, r.distance_km AS distanceKm,
              r.duration_minutes AS durationMinutes,
              b.id AS busId, b.name AS busName, b.class AS busClass, b.plate,
              b.seat_rows AS seatRows, b.seat_cols AS seatCols, b.aisle_after AS aisleAfter, b.facilities
         FROM schedules s
         JOIN routes r ON r.id = s.route_id
         JOIN buses b ON b.id = s.bus_id
        WHERE s.id = ?`,
    )
    .get(id)

  if (!row) return res.status(404).json({ error: 'Jadwal tidak ditemukan.' })

  const bus = serializeBus(row)
  const bookedSeats = getBookedSeats(id)

  res.json({
    schedule: {
      id: row.id,
      routeId: row.routeId,
      departureTime: row.departureTime,
      arrivalTime: row.arrivalTime,
      price: row.price,
      origin: row.origin,
      destination: row.destination,
      distanceKm: row.distanceKm,
      durationMinutes: row.durationMinutes,
      bus,
      totalSeats: bus.totalSeats,
      seatsAvailable: bus.totalSeats - bookedSeats.length,
    },
    seatMap: buildSeatMap(bus),
    bookedSeats,
  })
})

app.post('/api/bookings', (req, res) => {
  const { scheduleId, contact, passengers } = req.body ?? {}

  const error = validatePassengerFields(contact, passengers)
  if (error) return res.status(400).json({ error })

  const id = Number(scheduleId)
  const schedule = db
    .prepare(
      `SELECT s.id, s.price, s.is_active, s.departure_time AS departureTime,
              b.seat_rows AS seatRows, b.seat_cols AS seatCols
         FROM schedules s JOIN buses b ON b.id = s.bus_id WHERE s.id = ?`,
    )
    .get(id)

  if (!schedule || !schedule.is_active)
    return res.status(404).json({ error: 'Jadwal tidak tersedia.' })

  if (new Date(schedule.departureTime.replace(' ', 'T')).getTime() < Date.now())
    return res.status(400).json({ error: 'Jadwal sudah berangkat. Pilih jadwal lain.' })

  const bus = { seat_rows: schedule.seatRows, seat_cols: schedule.seatCols }
  const requested = passengers.map((p) => p.seatNumber)
  if (new Set(requested).size !== requested.length)
    return res.status(400).json({ error: 'Ada kursi yang dipilih lebih dari sekali.' })
  if (requested.some((n) => !isValidSeat(bus, n)))
    return res.status(400).json({ error: 'Nomor kursi di luar layout bus.' })

  const alreadyBooked = new Set(getBookedSeats(id))
  const conflict = requested.filter((n) => alreadyBooked.has(n))
  if (conflict.length)
    return res
      .status(409)
      .json({ error: `Kursi ${conflict.join(', ')} baru saja dipesan orang lain.` })

  const code = generateBookingCode()
  const totalPrice = schedule.price * requested.length

  db.exec('BEGIN')
  try {
    const bookingId = Number(
      db
        .prepare(
          `INSERT INTO bookings (code, schedule_id, contact_name, contact_phone, contact_email, total_price)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          code,
          id,
          String(contact.name).trim(),
          String(contact.phone).trim(),
          contact.email ? String(contact.email).trim() : null,
          totalPrice,
        ).lastInsertRowid,
    )

    const insertSeat = db.prepare(
      `INSERT INTO booking_seats (booking_id, seat_number, passenger_name, passenger_phone)
       VALUES (?, ?, ?, ?)`,
    )
    for (const p of passengers) {
      insertSeat.run(bookingId, p.seatNumber, p.name.trim(), p.phone?.trim() || null)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  res.status(201).json({ booking: publicTicket(code) })
})

app.get('/api/bookings/:code', (req, res) => {
  const ticket = publicTicket(req.params.code.toUpperCase())
  if (!ticket) return res.status(404).json({ error: 'Kode pemesanan tidak ditemukan.' })
  res.json({ booking: ticket })
})

/* ------------------------------------------------------------------ */
/* Admin API                                                           */
/* ------------------------------------------------------------------ */

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body ?? {}
  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi.' })

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username.trim())
  if (!admin || !verifyPassword(password, admin.password_hash))
    return res.status(401).json({ error: 'Username atau password salah.' })

  const { token, expiresAt } = createSession(admin.id)
  res.json({
    token,
    expiresAt,
    admin: { id: admin.id, username: admin.username, name: admin.name },
  })
})

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  destroySession(req.token)
  res.json({ ok: true })
})

app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ admin: req.admin }))

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const totalBookings = db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n
  const revenue = db
    .prepare("SELECT COALESCE(SUM(total_price), 0) AS v FROM bookings WHERE status = 'paid'")
    .get().v
  const bookingsToday = db
    .prepare('SELECT COUNT(*) AS n FROM bookings WHERE substr(created_at, 1, 10) = ?')
    .get(todayStr).n
  const activeSchedules = db.prepare('SELECT COUNT(*) AS n FROM schedules WHERE is_active = 1').get().n
  const departuresToday = db
    .prepare("SELECT COUNT(*) AS n FROM schedules WHERE substr(departure_time, 1, 10) = ?")
    .get(todayStr).n
  const seatsSold = db.prepare('SELECT COUNT(*) AS n FROM booking_seats').get().n

  const topRoutes = db
    .prepare(
      `SELECT r.origin, r.destination, COUNT(bs.id) AS seats
         FROM booking_seats bs
         JOIN bookings b ON b.id = bs.booking_id
         JOIN schedules s ON s.id = b.schedule_id
         JOIN routes r ON r.id = s.route_id
        GROUP BY r.id
        ORDER BY seats DESC
        LIMIT 5`,
    )
    .all()

  res.json({
    totalBookings,
    revenue,
    bookingsToday,
    activeSchedules,
    departuresToday,
    seatsSold,
    topRoutes,
  })
})

app.get('/api/admin/routes', requireAdmin, (_req, res) => {
  res.json({ routes: db.prepare('SELECT * FROM routes ORDER BY origin, destination').all() })
})

app.get('/api/admin/buses', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM buses ORDER BY id').all()
  res.json({
    buses: rows.map((b) => ({
      id: b.id,
      name: b.name,
      plate: b.plate,
      class: b.class,
      seatRows: b.seat_rows,
      seatCols: b.seat_cols,
      aisleAfter: b.aisle_after,
      totalSeats: b.seat_rows * b.seat_cols,
      facilities: JSON.parse(b.facilities ?? '[]'),
      isActive: !!b.is_active,
    })),
  })
})

app.get('/api/admin/schedules', requireAdmin, (req, res) => {
  const schedules = querySchedules({
    date: req.query.date?.trim() || null,
    routeId: req.query.routeId ? Number(req.query.routeId) : null,
    limit: 200,
  })
  res.json({ count: schedules.length, schedules })
})

app.post('/api/admin/schedules', requireAdmin, (req, res) => {
  const { routeId, busId, departureTime, price, arrivalTime } = req.body ?? {}
  if (!routeId || !busId || !departureTime || !price)
    return res.status(400).json({ error: 'Rute, bus, waktu berangkat, dan harga wajib diisi.' })

  const route = db.prepare('SELECT * FROM routes WHERE id = ?').get(Number(routeId))
  if (!route) return res.status(400).json({ error: 'Rute tidak ditemukan.' })

  const departure = String(departureTime).replace('T', ' ').slice(0, 16)
  const arrival = arrivalTime
    ? String(arrivalTime).replace('T', ' ').slice(0, 16)
    : addScheduleMinutes(departure, route.duration_minutes)

  try {
    const info = db
      .prepare(
        `INSERT INTO schedules (route_id, bus_id, departure_time, arrival_time, price)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(Number(routeId), Number(busId), departure, arrival, Math.round(Number(price)))
    res.status(201).json({ id: Number(info.lastInsertRowid) })
  } catch {
    res.status(409).json({ error: 'Jadwal dengan rute, bus, dan waktu yang sama sudah ada.' })
  }
})

app.put('/api/admin/schedules/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  const current = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id)
  if (!current) return res.status(404).json({ error: 'Jadwal tidak ditemukan.' })

  const { departureTime, arrivalTime, price, isActive } = req.body ?? {}
  db.prepare(
    `UPDATE schedules
        SET departure_time = ?, arrival_time = ?, price = ?, is_active = ?
      WHERE id = ?`,
  ).run(
    departureTime ? String(departureTime).replace('T', ' ').slice(0, 16) : current.departure_time,
    arrivalTime ? String(arrivalTime).replace('T', ' ').slice(0, 16) : current.arrival_time,
    price != null ? Math.round(Number(price)) : current.price,
    isActive != null ? (isActive ? 1 : 0) : current.is_active,
    id,
  )
  res.json({ ok: true })
})

app.delete('/api/admin/schedules/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  const booked = db
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings WHERE schedule_id = ? AND status = 'paid'`,
    )
    .get(id).n
  if (booked > 0)
    return res
      .status(409)
      .json({ error: `Tidak bisa dihapus: sudah ada ${booked} pemesanan pada jadwal ini.` })

  const info = db.prepare('DELETE FROM schedules WHERE id = ?').run(id)
  if (info.changes === 0) return res.status(404).json({ error: 'Jadwal tidak ditemukan.' })
  res.json({ ok: true })
})

app.get('/api/admin/bookings', requireAdmin, (req, res) => {
  const { date, scheduleId } = req.query
  const conditions = []
  const params = []
  if (date) {
    conditions.push('substr(s.departure_time, 1, 10) = ?')
    params.push(date)
  }
  if (scheduleId) {
    conditions.push('b.schedule_id = ?')
    params.push(Number(scheduleId))
  }

  const rows = db
    .prepare(
      `SELECT b.id, b.code, b.contact_name AS contactName, b.contact_phone AS contactPhone,
              b.total_price AS totalPrice, b.status, b.created_at AS createdAt,
              s.departure_time AS departureTime, r.origin, r.destination,
              (SELECT COUNT(*) FROM booking_seats bs WHERE bs.booking_id = b.id) AS seatCount,
              (SELECT GROUP_CONCAT(bs.seat_number) FROM booking_seats bs WHERE bs.booking_id = b.id) AS seats
         FROM bookings b
         JOIN schedules s ON s.id = b.schedule_id
         JOIN routes r ON r.id = s.route_id
        ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
        ORDER BY b.created_at DESC
        LIMIT 200`,
    )
    .all(...params)

  res.json({
    bookings: rows.map((r) => ({
      ...r,
      seats: r.seats ? r.seats.split(',').map(Number).sort((a, b) => a - b) : [],
    })),
  })
})

app.patch('/api/admin/bookings/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  const { status } = req.body ?? {}
  if (!['paid', 'cancelled'].includes(status))
    return res.status(400).json({ error: 'Status tidak valid.' })

  const info = db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, id)
  if (info.changes === 0) return res.status(404).json({ error: 'Pemesanan tidak ditemukan.' })
  res.json({ ok: true })
})

app.post('/api/admin/password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {}
  if (!newPassword || String(newPassword).length < 6)
    return res.status(400).json({ error: 'Password baru minimal 6 karakter.' })

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id)
  if (!verifyPassword(currentPassword ?? '', admin.password_hash))
    return res.status(401).json({ error: 'Password saat ini salah.' })

  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(
    hashPassword(String(newPassword)),
    admin.id,
  )
  res.json({ ok: true })
})

/* ------------------------------------------------------------------ */
/* Asisten AI (aturan + database, opsional ditingkatkan oleh LLM)       */
/* ------------------------------------------------------------------ */

app.use('/api', assistantRouter())

function addScheduleMinutes(dateTime, minutes) {
  const [date, time] = String(dateTime).split(' ')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const dt = new Date(y, mo - 1, d, h, mi + Number(minutes))
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}

/* ------------------------------------------------------------------ */
/* Static build (produksi) + error handler                             */
/* ------------------------------------------------------------------ */

// `fileURLToPath` (bukan `url.pathname`) agar path valid di Windows sekalipun.
const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url))

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))

  // SPA fallback: semua rute non-API dikembalikan ke index.html agar
  // router sisi klien (React Router) yang menangani navigasi &
  // refresh halaman dalam.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api')) return next()
    res.sendFile('index.html', { root: DIST_DIR }, (err) => {
      if (err) next()
    })
  })
}

app.use((_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }))

app.use((err, _req, res, _next) => {
  console.error('[api]', err)
  res.status(500).json({ error: 'Terjadi kesalahan di server.' })
})

/* ------------------------------------------------------------------ */
/* Bootstrap                                                           */
/* ------------------------------------------------------------------ */

initSchema()
const seedResult = seed()

const server = app.listen(PORT, () => {
  if (!seedResult.skipped) {
    console.log(
      `Seed: ${seedResult.routes} rute, ${seedResult.buses} bus, ${seedResult.schedules} jadwal`,
    )
    console.log('Admin default -> username: admin | password: admin123')
  }
  console.log(`Jokam Trans API siap di http://localhost:${PORT}`)
})

/*
 * Diagnostik startup.
 * Sebelumnya, bila port sudah dipakai proses lain, proses ini keluar tanpa
 * penjelasan apa pun — sehingga tampak di browser sebagai "data tidak muncul".
 * Sekarang penyebabnya dicetak dengan jelas beserta jalan keluarnya.
 */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      [
        '',
        `Port ${PORT} sedang dipakai proses lain.`,
        'Kemungkinan ada server lama yang belum ditutup.',
        '',
        'Cara mengatasi:',
        `  1. Tutup proses lama pemakai port ${PORT}, atau`,
        `  2. Jalankan di port lain:  PORT=${PORT + 1} npm run server`,
        `     (jalankan frontend dengan  API_PORT=${PORT + 1} npm run web)`,
        '',
      ].join('\n'),
    )
  } else {
    console.error('[api] gagal membuka server:', err)
  }
  process.exit(1)
})

/* Kegagalan tak terduga tidak boleh mematikan server tanpa jejak. */
process.on('unhandledRejection', (reason) => {
  console.error('[api] promise tidak tertangani:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[api] kesalahan tidak tertangani:', err)
  server.close(() => process.exit(1))
  setTimeout(() => process.exit(1), 2000).unref()
})

/* Tutup koneksi dengan rapi agar port cepat bebas (penting di Windows). */
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 1500).unref()
  })
}
