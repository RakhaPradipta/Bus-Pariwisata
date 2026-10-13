/**
 * Helper query bersama.
 *
 * Dipisahkan dari `index.js` supaya bisa dipakai ulang oleh lapisan AI
 * tanpa mengimpor modul yang langsung menjalankan server (menghindari
 * impor melingkar). Semua fungsi di sini hanya membaca database.
 */
import { db } from './db.js'

/** Mengubah baris join (schedules + routes + buses) menjadi objek bus publik. */
export function serializeBus(row) {
  return {
    id: row.busId,
    name: row.busName,
    class: row.busClass,
    plate: row.plate,
    seatRows: row.seatRows,
    seatCols: row.seatCols,
    aisleAfter: row.aisleAfter,
    totalSeats: row.seatRows * row.seatCols,
    facilities: JSON.parse(row.facilities ?? '[]'),
  }
}

/** Jumlah kursi terisi untuk semua jadwal sekaligus (menghindari N+1). */
export function bookedCountMap() {
  const rows = db
    .prepare(
      `SELECT b.schedule_id AS scheduleId, COUNT(*) AS n
         FROM booking_seats bs
         JOIN bookings b ON b.id = bs.booking_id
        WHERE b.status = 'paid'
        GROUP BY b.schedule_id`,
    )
    .all()
  return new Map(rows.map((r) => [r.scheduleId, r.n]))
}

/** Query jadwal dengan filter opsional. */
export function querySchedules({ origin, destination, date, busClass, routeId, scheduleId, limit } = {}) {
  const conditions = ['s.is_active = 1']
  const params = []
  if (scheduleId) {
    conditions.push('s.id = ?')
    params.push(scheduleId)
  }
  if (origin) {
    conditions.push('r.origin = ?')
    params.push(origin)
  }
  if (destination) {
    conditions.push('r.destination = ?')
    params.push(destination)
  }
  if (date) {
    conditions.push('substr(s.departure_time, 1, 10) = ?')
    params.push(date)
  }
  if (busClass) {
    conditions.push('b.class = ?')
    params.push(busClass)
  }
  if (routeId) {
    conditions.push('s.route_id = ?')
    params.push(routeId)
  }

  const sql = `
    SELECT s.id, s.departure_time AS departureTime, s.arrival_time AS arrivalTime, s.price,
           r.id AS routeId, r.origin, r.destination, r.distance_km AS distanceKm,
           r.duration_minutes AS durationMinutes,
           b.id AS busId, b.name AS busName, b.class AS busClass, b.plate,
           b.seat_rows AS seatRows, b.seat_cols AS seatCols, b.aisle_after AS aisleAfter, b.facilities
      FROM schedules s
      JOIN routes r ON r.id = s.route_id
      JOIN buses b ON b.id = s.bus_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.departure_time
     ${limit ? 'LIMIT ?' : ''}`

  const rows = db.prepare(sql).all(...params, ...(limit ? [limit] : []))
  const booked = bookedCountMap()

  return rows.map((row) => {
    const bus = serializeBus(row)
    const bookedSeats = booked.get(row.id) ?? 0
    return {
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
      seatsAvailable: bus.totalSeats - bookedSeats,
    }
  })
}

/** Satu jadwal berdasarkan id, dengan bentuk yang sama seperti hasil pencarian. */
export function getScheduleById(id) {
  return querySchedules({ scheduleId: Number(id), limit: 1 })[0] ?? null
}

/** Daftar kota yang dilayani, terurut. */
export function listCities() {
  const rows = db.prepare('SELECT origin, destination FROM routes').all()
  const cities = new Set()
  rows.forEach((r) => {
    cities.add(r.origin)
    cities.add(r.destination)
  })
  return [...cities].sort((a, b) => a.localeCompare(b, 'id'))
}

/* ------------------------------------------------------------------ */
/* Penyelamat hasil pencarian kosong                                   */
/* ------------------------------------------------------------------ */

const MIN_TRANSFER_MINUTES = 45
const MAX_LAYOVER_MINUTES = 600

/** Menambah menit pada string waktu lokal "YYYY-MM-DD HH:mm". */
function addMinutes(dateTime, minutes) {
  const [datePart, timePart] = String(dateTime).split(' ')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  const dt = new Date(y, mo - 1, d, h, mi + Number(minutes))
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`
}

/** Selisih menit antara dua string waktu lokal. */
function minutesBetween(from, to) {
  const parse = (value) => {
    const [datePart, timePart] = String(value).split(' ')
    const [y, mo, d] = datePart.split('-').map(Number)
    const [h, mi] = timePart.split(':').map(Number)
    return new Date(y, mo - 1, d, h, mi).getTime()
  }
  return Math.round((parse(to) - parse(from)) / 60000)
}

/**
 * Mencari perjalanan pengganti ketika rute yang diminta tidak tersedia.
 * Semua alternatif berasal dari database — tidak ada rute karangan.
 *
 * Tiga strategi, berurutan dari yang paling nyaman bagi penumpang:
 *   1. dari kota asal yang sama ke tujuan lain,
 *   2. dari kota lain ke tujuan yang sama,
 *   3. satu kali transit lewat kota yang menghubungkan keduanya.
 */
export function findAlternatives({ origin, destination, date, limit = 4 } = {}) {
  const originRoutes = origin
    ? db.prepare('SELECT DISTINCT destination FROM routes WHERE origin = ?').all(origin)
    : []
  const destinationRoutes = destination
    ? db.prepare('SELECT DISTINCT origin FROM routes WHERE destination = ?').all(destination)
    : []
  const originTargets = new Set(originRoutes.map((r) => r.destination))
  const destinationSources = new Set(destinationRoutes.map((r) => r.origin))

  const sameOrigin = origin
    ? querySchedules({ origin, date, limit: 60 }).filter(
        (s) => s.destination !== destination && !destinationSources.has(s.destination),
      )
    : []
  const sameDestination = destination
    ? querySchedules({ destination, date, limit: 60 }).filter(
        (s) => s.origin !== origin && !originTargets.has(s.origin),
      )
    : []

  // Transit: kota X yang bisa dicapai dari asal DAN meneruskan ke tujuan.
  // Sambungan hanya dianggap valid bila leg kedua benar-benar berangkat
  // setelah leg pertama tiba (plus waktu pindah minimum) — bukan sekadar
  // ada jadwal di tanggal yang sama.
  const transfers = []
  if (origin && destination) {
    for (const city of originTargets) {
      if (!destinationSources.has(city)) continue
      if (city === destination || city === origin) continue

      const leg1List = querySchedules({ origin, destination: city, date, limit: 20 })
      const leg2List = querySchedules({ origin: city, destination, date, limit: 20 })

      // Pilih sambungan termurah di antara semua pasangan yang waktunya
      // benar-benar bisa disambung; bila harganya sama, ambil yang tercepat.
      let best = null
      for (const leg1 of leg1List) {
        // Format waktu "YYYY-MM-DD HH:mm" bisa dibandingkan sebagai teks.
        const earliest = addMinutes(leg1.arrivalTime, MIN_TRANSFER_MINUTES)
        for (const leg2 of leg2List) {
          if (leg2.departureTime < earliest) continue
          const layover = minutesBetween(leg1.arrivalTime, leg2.departureTime)
          if (layover > MAX_LAYOVER_MINUTES) continue

          const totalPrice = leg1.price + leg2.price
          const totalMinutes = leg1.durationMinutes + layover + leg2.durationMinutes
          if (
            !best ||
            totalPrice < best.totalPrice ||
            (totalPrice === best.totalPrice && totalMinutes < best.totalMinutes)
          ) {
            best = { via: city, leg1, leg2, layoverMinutes: layover, totalPrice, totalMinutes }
          }
        }
      }

      if (best) transfers.push(best)
      if (transfers.length >= 2) break
    }
  }

  return {
    sameOrigin: dedupeRoutes(sameOrigin).slice(0, limit),
    sameDestination: dedupeRoutes(sameDestination).slice(0, limit),
    transfers,
  }
}

/** Ambil tarif termurah per rute agar daftar alternatif tidak berulang. */
function dedupeRoutes(schedules) {
  const byRoute = new Map()
  for (const schedule of schedules) {
    const key = `${schedule.origin}→${schedule.destination}`
    const current = byRoute.get(key)
    if (!current || schedule.price < current.price) byRoute.set(key, schedule)
  }
  return [...byRoute.values()].sort((a, b) => a.departureTime.localeCompare(b.departureTime))
}

/* ------------------------------------------------------------------ */
/* Penilai kursi (deterministik, bukan tebakan model)                  */
/* ------------------------------------------------------------------ */

const WINDOW_BONUS = 26
const AISLE_BONUS = 16
const MIDDLE_ROW_BONUS = 14
const FRONT_ROW_PENALTY = -18
const LAST_ROW_PENALTY = -34

/**
 * Memberi skor tiap kursi berdasarkan posisinya di dalam bodi bus.
 * Kursi dinilai "lebih nyaman" bila di sisi jendela, bukan baris paling
 * depan (ruang kaki sempit & dekat pintu) maupun baris paling belakang
 * (paling terasa guncangan), dan berada di baris tengah.
 */
export function rankSeats(bus, bookedSeats, count = 1) {
  const rows = Number(bus?.seatRows ?? 0)
  const cols = Number(bus?.seatCols ?? 0)
  const aisleAfter = Number(bus?.aisleAfter ?? 0)
  if (!rows || !cols) return []

  const taken = new Set(bookedSeats ?? [])
  const scored = []

  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      const number = (row - 1) * cols + col
      if (taken.has(number)) continue

      let score = 0
      const reasons = []
      const isWindow = col === 1 || col === cols
      const isAisle = col === aisleAfter || col === aisleAfter + 1

      if (isWindow) {
        score += WINDOW_BONUS
        reasons.push('di sisi jendela')
      } else if (isAisle) {
        score += AISLE_BONUS
        reasons.push('mudah dijangkau dari lorong')
      }
      if (row === 1) {
        score += FRONT_ROW_PENALTY
        reasons.push('baris paling depan')
      } else if (row === rows) {
        score += LAST_ROW_PENALTY
        reasons.push('baris paling belakang')
      } else {
        score += MIDDLE_ROW_BONUS
        if (row >= 3 && row <= rows - 2) reasons.push('baris tengah — paling stabil')
      }

      scored.push({ number, row, col, score, isWindow, isAisle, reasons })
    }
  }

  if (!scored.length) return []

  const wanted = Math.max(1, Math.min(Number(count) || 1, 6))
  const groups = []

  if (wanted === 1) {
    for (const seat of scored.sort((a, b) => b.score - a.score).slice(0, 3)) {
      groups.push({ seats: [seat.number], score: seat.score, reasons: seat.reasons })
    }
    return groups
  }

  // Beberapa kursi: utamakan yang berdampingan dan berada di sisi lorong
  // yang sama, supaya satu rombongan tidak terpisah.
  for (const row of [...new Set(scored.map((s) => s.row))]) {
    const inRow = scored.filter((s) => s.row === row).sort((a, b) => a.col - b.col)
    const blocks = inRow.reduce((acc, seat) => {
      const key = seat.col <= aisleAfter ? 'kiri' : 'kanan'
      acc[key] = acc[key] ?? []
      acc[key].push(seat)
      return acc
    }, {})

    for (const seats of Object.values(blocks)) {
      for (let start = 0; start + wanted <= seats.length; start++) {
        const group = seats.slice(start, start + wanted)
        // Hanya menerima kursi yang benar-benar bersebelahan.
        const contiguous = group.every((s, i) => i === 0 || s.col === group[i - 1].col + 1)
        if (!contiguous) continue
        const avg = group.reduce((sum, s) => sum + s.score, 0) / group.length
        groups.push({
          seats: group.map((s) => s.number),
          score: avg + 18, // bonus karena berdampingan
          reasons: group[0].reasons.slice(0, 2),
        })
      }
    }
  }

  if (!groups.length) {
    const fallback = scored.sort((a, b) => b.score - a.score).slice(0, wanted)
    groups.push({
      seats: fallback.map((s) => s.number).sort((a, b) => a - b),
      score: fallback.reduce((sum, s) => sum + s.score, 0) / fallback.length,
      reasons: ['kursi terbaik yang masih tersedia (tidak berdampingan)'],
    })
  }

  return groups.sort((a, b) => b.score - a.score).slice(0, 3)
}
