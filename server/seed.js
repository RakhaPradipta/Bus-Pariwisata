/**
 * Data awal (seed) untuk aplikasi Jokam Trans.
 * Idempotent: hanya mengisi bila tabel masih kosong.
 *
 * Jalankan manual:  npm run seed:reset
 */
import { randomBytes } from 'node:crypto'
import { db, initSchema } from './db.js'
import { hashPassword } from './auth.js'
import { seatCount } from './seatmap.js'

// Alfabet sama dengan generator kode di server/index.js supaya format tiket
// data contoh identik dengan pemesanan sungguhan: 27T-XXXXXX.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function bookingCode() {
  let code = ''
  for (const byte of randomBytes(6)) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  return `27T-${code}`
}

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
    name: 'Jokam Trans Executive',
    plate: 'B 1727 TRS',
    class: 'Eksekutif',
    seat_rows: 11,
    seat_cols: 4,
    aisle_after: 2,
    facilities: ['AC', 'WiFi', 'USB Charger', 'Reclining Seat', 'Snack', 'Toilet'],
  },
  {
    name: 'Jokam Trans Executive Plus',
    plate: 'B 5727 TRS',
    class: 'Eksekutif',
    seat_rows: 10,
    seat_cols: 4,
    aisle_after: 2,
    facilities: ['AC', 'WiFi', 'USB Charger', 'Reclining Seat', 'Toilet'],
  },
  {
    name: 'Jokam Trans VIP',
    plate: 'B 2727 TRS',
    class: 'VIP',
    seat_rows: 8,
    seat_cols: 3,
    aisle_after: 2,
    facilities: ['AC', 'WiFi', 'USB Charger', 'Recliner 140°', 'Selimut', 'Toilet', 'Hiburan'],
  },
  {
    name: 'Jokam Trans Sleeper',
    plate: 'B 3727 TRS',
    class: 'Sleeper',
    seat_rows: 6,
    seat_cols: 3,
    aisle_after: 1,
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
    name: 'Jokam Trans Ekonomi',
    plate: 'B 4727 TRS',
    class: 'Ekonomi',
    seat_rows: 12,
    seat_cols: 4,
    aisle_after: 2,
    facilities: ['AC', 'USB Charger'],
  },
]

const CLASS_MULTIPLIER = { Ekonomi: 0.8, Eksekutif: 1, VIP: 1.35, Sleeper: 1.9 }
const DEPARTURE_SLOTS = ['06:00', '08:30', '11:00', '14:00', '17:30', '20:00', '21:30']
const SEED_DAYS = 45

const localDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Menambahkan menit ke string waktu lokal `YYYY-MM-DD HH:mm`. */
function addMinutes(dateTime, minutes) {
  const [date, time] = dateTime.split(' ')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const dt = new Date(y, mo - 1, d, h, mi + minutes)
  return `${localDate(dt)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

export function isSeeded() {
  return db.prepare('SELECT COUNT(*) AS n FROM buses').get().n > 0
}

export function seed() {
  initSchema()
  if (isSeeded()) return { skipped: true }

  const insertRoute = db.prepare(
    `INSERT INTO routes (origin, destination, distance_km, duration_minutes, base_price)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const insertBus = db.prepare(
    `INSERT INTO buses (name, plate, class, seat_rows, seat_cols, aisle_after, facilities)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertSchedule = db.prepare(
    `INSERT INTO schedules (route_id, bus_id, departure_time, arrival_time, price)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const insertBooking = db.prepare(
    `INSERT INTO bookings (code, schedule_id, contact_name, contact_phone, contact_email, total_price)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  const insertSeat = db.prepare(
    `INSERT INTO booking_seats (booking_id, seat_number, passenger_name, passenger_phone)
     VALUES (?, ?, ?, ?)`,
  )

  /** @type {{id:number,busId:number,price:number}[]} */
  const schedules = []

  db.exec('BEGIN')
  try {
    const routeIds = ROUTES.map(
      ([origin, destination, distance_km, duration_minutes, base_price]) =>
        Number(
          insertRoute.run(origin, destination, distance_km, duration_minutes, base_price)
            .lastInsertRowid,
        ),
    )

    const busIds = []
    const busInfo = []
    for (const b of BUSES) {
      const id = Number(
        insertBus.run(
          b.name,
          b.plate,
          b.class,
          b.seat_rows,
          b.seat_cols,
          b.aisle_after,
          JSON.stringify(b.facilities),
        ).lastInsertRowid,
      )
      busIds.push(id)
      busInfo.push({ id, ...b })
    }

    // Jadwal: untuk tiap rute, 3 keberangkatan/hari selama SEED_DAYS hari ke depan.
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let day = 0; day < SEED_DAYS; day++) {
      const date = new Date(today)
      date.setDate(today.getDate() + day)
      const dateStr = localDate(date)

      ROUTES.forEach(([, , , duration], routeIndex) => {
        for (let slot = 0; slot < 3; slot++) {
          const bus = busInfo[(routeIndex + day + slot) % busInfo.length]
          const departure = `${dateStr} ${DEPARTURE_SLOTS[(routeIndex + slot * 2 + 1) % DEPARTURE_SLOTS.length]}`
          const price = Math.round(
            (ROUTES[routeIndex][4] * (CLASS_MULTIPLIER[bus.class] ?? 1)) / 1000,
          ) * 1000
          const id = Number(
            insertSchedule.run(
              routeIds[routeIndex],
              bus.id,
              departure,
              addMinutes(departure, duration),
              price,
            ).lastInsertRowid,
          )
          schedules.push({ id, busId: bus.id, price })
        }
      })
    }

    // Beberapa pemesanan demo agar peta kursi & dashboard admin tidak kosong.
    const names = [
      ['Andi Pratama', '081234567890'],
      ['Siti Nurhaliza', '081298765432'],
      ['Budi Santoso', '085712345678'],
      ['Dewi Lestari', '082187654321'],
      ['Rizky Ramadhan', '089612345678'],
      ['Putri Amelia', '081377889900'],
    ]
    const busById = new Map(busInfo.map((b) => [b.id, b]))
    const takenSeats = new Map() // scheduleId -> Set(seatNumber)

    for (let i = 0; i < 24; i++) {
      const schedule = schedules[(i * 37) % schedules.length]
      const bus = busById.get(schedule.busId)
      const total = seatCount(bus)
      const taken = takenSeats.get(schedule.id) ?? new Set()

      const seats = new Set()
      let cursor = (i * 7) % total
      while (seats.size < 2) {
        const seatNumber = (cursor % total) + 1
        if (!taken.has(seatNumber)) seats.add(seatNumber)
        cursor += 5
      }
      seats.forEach((s) => taken.add(s))
      takenSeats.set(schedule.id, taken)

      const [name, phone] = names[i % names.length]
      const bookingId = Number(
        insertBooking.run(
          bookingCode(),
          schedule.id,
          name,
          phone,
          `${name.split(' ')[0].toLowerCase()}@example.com`,
          schedule.price * seats.size,
        ).lastInsertRowid,
      )
      for (const seatNumber of seats) {
        insertSeat.run(bookingId, seatNumber, name, phone)
      }
    }

    // Akun admin default.
    db.prepare('INSERT INTO admins (username, password_hash, name) VALUES (?, ?, ?)').run(
      process.env.ADMIN_USERNAME ?? 'admin',
      hashPassword(process.env.ADMIN_PASSWORD ?? 'admin123'),
      'Administrator Jokam Trans',
    )

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  return {
    skipped: false,
    routes: ROUTES.length,
    buses: BUSES.length,
    schedules: schedules.length,
  }
}

/** Menghapus seluruh data lalu mengisi ulang. */
export function resetAndSeed() {
  initSchema()
  db.exec(`
    DELETE FROM booking_seats;
    DELETE FROM bookings;
    DELETE FROM sessions;
    DELETE FROM schedules;
    DELETE FROM buses;
    DELETE FROM routes;
    DELETE FROM admins;
    DELETE FROM sqlite_sequence;
  `)
  return seed()
}

// Mode CLI: `node server/seed.js --reset`
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const reset = process.argv.includes('--reset')
  const result = reset ? resetAndSeed() : seed()
  console.log(reset ? '♻️  Database direset & diisi ulang.' : '🌱 Seed selesai.')
  console.log(result)
}
