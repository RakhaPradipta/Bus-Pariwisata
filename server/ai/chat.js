/**
 * Asisten "Tanya 27" — orkestrator + endpoint SSE.
 *
 * Cara kerjanya sengaja bertingkat:
 *   1. Aturan + database menjawab lebih dulu. Ini jalur utama, gratis, instan,
 *      dan tidak mungkin mengarang harga atau kursi.
 *   2. Bila kunci API model tersedia, model hanya diminta MEMPARAFRASE
 *      jawaban yang sudah benar dari langkah 1. Angka tidak pernah dikarang
 *      karena model dilarang menghitung ulang.
 *
 * Prinsip: tidak ada satu pun angka yang berasal dari model.
 */
import express from 'express'
import { randomUUID } from 'node:crypto'
import { db, getBookedSeats } from '../db.js'
import { querySchedules, findAlternatives, listCities, rankSeats, getScheduleById } from '../queries.js'
import { analyze, buildCityIndex, mergeSlots, looksLikeSearch } from './nlu.js'
import { CONTACT, CAPABILITIES, matchFaq, outOfScopeReply } from './knowledge.js'
import { isConfigured, providerInfo, rephrase } from './provider.js'

const MAX_MESSAGE_LENGTH = 500
const MAX_CARDS = 4
const RATE_LIMIT = Number(process.env.AI_RATE_LIMIT ?? 30)
const RATE_WINDOW_MS = 5 * 60 * 1000
const SESSION_TTL_MS = 30 * 60 * 1000
const MAX_SESSIONS = 500

/* ------------------------------------------------------------------ */
/* Utilitas                                                            */
/* ------------------------------------------------------------------ */

const rupiah = (value) => `Rp ${Number(value).toLocaleString('id-ID')}`
const clock = (dateTime) => String(dateTime).slice(11, 16)

function localDate(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

function longDate(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function minutes(value) {
  const total = Number(value) || 0
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `${h} jam ${m} menit` : `${h} jam`
}

/** Indeks kota di-cache singkat agar tiap pesan tidak menembak database. */
let cityCache = { at: 0, data: null }

function cityIndex() {
  const now = Date.now()
  if (!cityCache.data || now - cityCache.at > 60_000) {
    const cities = listCities()
    cityCache = { at: now, data: { ...buildCityIndex(cities), cities } }
  }
  return cityCache.data
}

const routeExists = (origin, destination) =>
  Boolean(db.prepare('SELECT 1 FROM routes WHERE origin = ? AND destination = ?').get(origin, destination))

function topCities(limit = 6) {
  return db
    .prepare(
      `SELECT city, COUNT(*) AS n FROM (
         SELECT origin AS city FROM routes UNION ALL SELECT destination FROM routes
       ) GROUP BY city ORDER BY n DESC, city LIMIT ?`,
    )
    .all(limit)
    .map((r) => r.city)
}

/* ------------------------------------------------------------------ */
/* Sesi + pembatasan laju                                              */
/* ------------------------------------------------------------------ */

const sessions = new Map()
const buckets = new Map()

function getSession(id) {
  const now = Date.now()
  for (const [key, value] of sessions) {
    if (now - value.updatedAt > SESSION_TTL_MS) sessions.delete(key)
  }
  if (sessions.size > MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0]
    if (oldest) sessions.delete(oldest[0])
  }

  const key = typeof id === 'string' && id.length <= 64 ? id : randomUUID()
  const existing = sessions.get(key)
  if (existing) {
    existing.updatedAt = now
    return existing
  }
  const session = {
    id: key,
    updatedAt: now,
    slots: {},
    schedules: [],
    transcript: [],
  }
  sessions.set(key, session)
  return session
}

/** Pembatas laju sederhana per alamat IP (tanpa dependency tambahan). */
function allowRequest(ip) {
  const now = Date.now()
  const hits = (buckets.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (hits.length >= RATE_LIMIT) {
    buckets.set(ip, hits)
    return false
  }
  hits.push(now)
  buckets.set(ip, hits)
  return true
}

function logTurn(sessionId, role, content, intent, mode) {
  try {
    db.prepare(
      `INSERT INTO chat_logs (session_id, role, content, intent, mode) VALUES (?, ?, ?, ?, ?)`,
    ).run(sessionId, role, String(content).slice(0, 2000), intent ?? null, mode ?? null)
  } catch {
    /* pencatatan tidak boleh menggagalkan percakapan */
  }
}

/* ------------------------------------------------------------------ */
/* Penyusun jawaban (deterministik)                                    */
/* ------------------------------------------------------------------ */

function clarifyRoute(slots) {
  const sample = topCities(5).join(', ')
  const missing = !slots.origin && !slots.destination
    ? 'kota asal dan kota tujuan'
    : !slots.origin
      ? 'kota asal Anda'
      : 'kota tujuan Anda'

  return {
    text: `Siap, saya carikan. Saya masih perlu ${missing} — misalnya "Jakarta ke Yogyakarta besok". Kota yang kami layani antara lain ${sample}, dan masih ada beberapa lagi.`,
    suggestions: ['Jakarta ke Yogyakarta besok', 'Aturan bagasi berapa kg?', 'Cara ubah jadwal?'],
  }
}

function searchCards(list, dateLabel, passengers = 1) {
  return list.slice(0, MAX_CARDS).map((schedule) => ({
    type: 'schedule',
    passengers,
    id: schedule.id,
    origin: schedule.origin,
    destination: schedule.destination,
    departureTime: schedule.departureTime,
    arrivalTime: schedule.arrivalTime,
    price: schedule.price,
    seatsAvailable: schedule.seatsAvailable,
    totalSeats: schedule.totalSeats,
    durationMinutes: schedule.durationMinutes,
    dateLabel,
    bus: { name: schedule.bus.name, class: schedule.bus.class, plate: schedule.bus.plate },
  }))
}

function answerSearch(session, slots, note) {
  const { origin, destination, busClass } = slots
  if (!origin || !destination) return clarifyRoute(slots)

  const today = localDate()
  const date = slots.date ?? today
  const dateLabel = slots.dateLabel ?? (date === today ? 'hari ini' : longDate(date))
  const notPast = (schedule) =>
    date !== today || new Date(schedule.departureTime.replace(' ', 'T')).getTime() > Date.now()

  let list = querySchedules({ origin, destination, date, busClass, limit: 60 }).filter(notPast)

  // Kelas yang diminta tidak ada di rute ini: jangan langsung menyerah,
  // tawarkan kelas yang benar-benar tersedia pada rute yang sama.
  let classFallback = null
  if (!list.length && busClass) {
    const broad = querySchedules({ origin, destination, date, limit: 60 }).filter(notPast)
    if (broad.length) {
      classFallback = { requested: busClass, classes: [...new Set(broad.map((s) => s.bus.class))] }
      list = broad
    }
  }

  if (!list.length) return answerAlternatives(session, slots, date, dateLabel, busClass)

  const cheapest = list.reduce((a, b) => (b.price < a.price ? b : a))
  const roomiest = list.reduce((a, b) => (b.seatsAvailable > a.seatsAvailable ? b : a))
  const full = list.every((s) => s.seatsAvailable <= 0)

  session.schedules = list.slice(0, MAX_CARDS).map((s) => ({
    id: s.id,
    origin: s.origin,
    destination: s.destination,
    departureTime: s.departureTime,
    price: s.price,
    seatsAvailable: s.seatsAvailable,
  }))

  const lines = []
  if (classFallback)
    lines.push(
      `Tidak ada jadwal kelas ${classFallback.requested} untuk rute ini, tetapi tersedia kelas ${classFallback.classes.join(' dan ')}.`,
    )
  lines.push(
    `Ada ${list.length} keberangkatan ${origin} → ${destination} untuk ${dateLabel}${
      classFallback ? '' : busClass ? ` kelas ${busClass}` : ''
    }.`,
  )
  lines.push(
    `Keberangkatan paling awal ${clock(list[0].departureTime)}, paling akhir ${clock(list[list.length - 1].departureTime)}.`,
  )
  lines.push(`Tarif termurah ${rupiah(cheapest.price)} (berangkat ${clock(cheapest.departureTime)}).`)
  if (full) lines.push('Catatan: semua keberangkatan pada tanggal ini kursinya sudah habis.')
  else lines.push(`Kursi terbanyak masih tersedia ${roomiest.seatsAvailable} di keberangkatan ${clock(roomiest.departureTime)}.`)
  if (note) lines.push(note)

  const suggestions = []
  if (!full && slots.passengers > 1)
    suggestions.push(`Carikan ${slots.passengers} kursi berdampingan`)
  if (!busClass) suggestions.push('Yang kelas VIP saja')
  suggestions.push('Besok ada jadwal?')

  return {
    text: lines.join(' '),
    facts: lines.join('\n'),
    cards: searchCards(list, dateLabel, slots.passengers ?? 1),
    actions: [
      {
        label: 'Buka halaman pencarian',
        to: `/rute?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(destination)}&date=${date}&penumpang=${slots.passengers ?? 1}`,
      },
    ],
    suggestions: suggestions.slice(0, 3),
  }
}

function answerAlternatives(session, slots, date, dateLabel, busClass) {
  const { sameOrigin, sameDestination, transfers } = findAlternatives({
    origin: slots.origin,
    destination: slots.destination,
    date,
    limit: 3,
  })

  const lines = [
    `Belum ada jadwal langsung ${slots.origin} → ${slots.destination} pada ${dateLabel}${busClass ? ` untuk kelas ${busClass}` : ''}.`,
  ]
  const cards = []

  if (sameOrigin.length) {
    lines.push(
      `Dari ${slots.origin}, tujuan terdekat yang tersedia: ${sameOrigin
        .slice(0, 2)
        .map((s) => `${s.destination} (${rupiah(s.price)})`)
        .join(' dan ')}.`,
    )
    cards.push(...sameOrigin.slice(0, 2).map((s) => ({ ...toCard(s), type: 'route', dateLabel, note: `keberangkatan ${clock(s.departureTime)}` })))
  }

  if (sameDestination.length) {
    lines.push(
      `${sameDestination
        .slice(0, 2)
        .map((s) => `Dari ${s.origin} menuju ${slots.destination} tersedia (${rupiah(s.price)})`)
        .join('; ')}.`,
    )
    cards.push(...sameDestination.slice(0, 2).map((s) => ({ ...toCard(s), type: 'route', dateLabel, note: `keberangkatan ${clock(s.departureTime)}` })))
  }

  for (const transfer of transfers) {
    const leg = (s) => ({
      origin: s.origin,
      destination: s.destination,
      departureTime: s.departureTime,
      arrivalTime: s.arrivalTime,
      price: s.price,
    })
    cards.push({
      type: 'transfer',
      via: transfer.via,
      layoverMinutes: transfer.layoverMinutes,
      leg1: leg(transfer.leg1),
      leg2: leg(transfer.leg2),
    })
    lines.push(
      `Bisa juga lewat ${transfer.via}: ${slots.origin} → ${transfer.via} berangkat ${clock(transfer.leg1.departureTime)} tiba ${clock(transfer.leg1.arrivalTime)} (${rupiah(transfer.leg1.price)}), lalu ${transfer.via} → ${slots.destination} berangkat ${clock(transfer.leg2.departureTime)} (${rupiah(transfer.leg2.price)}) — waktu transit sekitar ${minutes(transfer.layoverMinutes)}. Total kedua tiket ${rupiah(transfer.leg1.price + transfer.leg2.price)}.`,
    )
  }

  if (!cards.length && !transfers.length) {
    lines.push(`Silakan hubungi ${CONTACT.phone} untuk memastikan ketersediaan rute khusus.`)
  }

  session.schedules = []

  return {
    text: lines.join(' '),
    facts: lines.join('\n'),
    cards: cards.slice(0, MAX_CARDS),
    actions: [
      { label: 'Lihat semua rute', to: '/rute' },
      { label: 'Ubah tanggal', to: `/rute?from=${encodeURIComponent(slots.origin)}&to=${encodeURIComponent(slots.destination)}` },
    ],
    suggestions: ['Coba tanggal lain', 'Aturan bagasi berapa kg?', 'Cara ubah jadwal?'],
  }
}

function toCard(schedule) {
  return {
    id: schedule.id,
    origin: schedule.origin,
    destination: schedule.destination,
    departureTime: schedule.departureTime,
    arrivalTime: schedule.arrivalTime,
    price: schedule.price,
    seatsAvailable: schedule.seatsAvailable,
    totalSeats: schedule.totalSeats,
    durationMinutes: schedule.durationMinutes,
    bus: { name: schedule.bus.name, class: schedule.bus.class, plate: schedule.bus.plate },
  }
}

/**
 * Pilih keberangkatan untuk saran kursi: keberangkatan paling awal dalam
 * konteks pencarian yang masih menyisakan kursi. Keberangkatan pertama bisa
 * saja sudah penuh, dan penumpang tidak perlu buntu karenanya.
 */
function pickSeatTarget(session) {
  let full = null
  for (const candidate of session.schedules ?? []) {
    const row = getScheduleById(candidate.id)
    if (!row) continue
    if (row.seatsAvailable > 0) return { target: row, full }
    if (!full) full = row
  }
  return { target: null, full }
}

function answerSeats(session, slots) {
  let picked = pickSeatTarget(session)

  // Belum ada konteks jadwal, tapi rutenya disebut — cari dulu.
  if (!picked.target && slots.origin && slots.destination) {
    const search = answerSearch(session, slots, null)
    if (!search.cards?.length) return search
    picked = pickSeatTarget(session)
  }
  const { target, full } = picked

  if (!target) {
    return {
      text: `Boleh, saya bantu pilih kursi. Sebutkan rute dan tanggal keberangkatan Anda dulu — misalnya "Jakarta ke Yogyakarta besok" — lalu saya tunjukkan kursi yang paling nyaman.`,
      suggestions: ['Jakarta ke Yogyakarta besok', 'Cara ubah jadwal?', 'Aturan bagasi berapa kg?'],
    }
  }

  const count = Math.max(1, Math.min(slots.passengers ?? 2, 6))
  const booked = getBookedSeats(target.id)
  const groups = rankSeats(target.bus, booked, count)

  if (!groups.length) {
    return {
      text: `Semua kursi pada keberangkatan ${clock(target.departureTime)} ${target.origin} → ${target.destination} sudah terisi. Coba keberangkatan lain, saya bisa carikan yang masih ada kursi kosong.`,
      suggestions: ['Cari jadwal lain', 'Besok ada jadwal?', 'Cara batalkan tiket?'],
    }
  }

  const best = groups[0]
  const lines = [
    full
      ? `Catatan: keberangkatan ${clock(full.departureTime)} sudah penuh, jadi ini keberangkatan terdekat yang masih ada kursi kosong.`
      : '',
    `Untuk keberangkatan ${clock(target.departureTime)} ${target.origin} → ${target.destination} (${target.bus.name} kelas ${target.bus.class}), kursi paling nyaman untuk ${count} orang: ${best.seats.join(', ')}.`,
    best.reasons.length ? `Alasannya: ${best.reasons.join(' dan ')}.` : '',
    groups[1] ? `Alternatif lain: kursi ${groups[1].seats.join(', ')}.` : '',
    `Masih ada ${target.seatsAvailable} kursi kosong dari ${target.totalSeats}.`,
  ].filter(Boolean)

  return {
    text: lines.join(' '),
    facts: lines.join('\n'),
    cards: [toCard(target)],
    actions: [
      {
        label: count > 1 ? `Pesan kursi ${best.seats.join(', ')}` : `Pesan kursi ${best.seats[0]}`,
        to: `/pesan/${target.id}?penumpang=${count}`,
      },
    ],
    suggestions: ['Tampilkan kursi lain', 'Besok ada jadwal?', 'Aturan bagasi berapa kg?'],
  }
}

function answerTicket(slots) {
  if (!slots.bookingCode) {
    return {
      text: `Tentu. Sebutkan kode pemesanan Anda yang berformat 27T-XXXXXX, misalnya 27T-AB12CD. Kodenya tertera pada e-tiket Anda.`,
      actions: [{ label: 'Buka halaman lacak tiket', to: '/lacak' }],
      suggestions: ['Aturan bagasi berapa kg?', 'Cara batalkan tiket?', 'Jakarta ke Yogyakarta besok'],
    }
  }

  const booking = db
    .prepare(
      `SELECT b.code, b.status, b.total_price AS totalPrice,
              s.departure_time AS departureTime, r.origin, r.destination,
              (SELECT COUNT(*) FROM booking_seats bs WHERE bs.booking_id = b.id) AS seatCount
         FROM bookings b
         JOIN schedules s ON s.id = b.schedule_id
         JOIN routes r ON r.id = s.route_id
        WHERE b.code = ?`,
    )
    .get(slots.bookingCode)

  if (!booking) {
    return {
      text: `Kode ${slots.bookingCode} tidak terdaftar di sistem kami. Coba periksa kembali penulisannya (huruf/angka sering tertukar), atau lacak ulang dari halaman Lacak Tiket.`,
      actions: [{ label: 'Lacak tiket', to: '/lacak' }],
      suggestions: ['Cara batalkan tiket?', 'Aturan bagasi berapa kg?', 'Hubungi layanan pelanggan'],
    }
  }

  const status = booking.status === 'cancelled' ? 'sudah dibatalkan' : 'aktif dan terkonfirmasi'
  return {
    text: `Ketemu. Kode ${booking.code} statusnya ${status}: ${booking.origin} → ${booking.destination}, berangkat ${longDate(booking.departureTime)} pukul ${clock(booking.departureTime)}, ${booking.seatCount} kursi, total ${rupiah(booking.totalPrice)}.`,
    facts: `Kode ${booking.code}; status ${status}; rute ${booking.origin} → ${booking.destination}; berangkat ${longDate(booking.departureTime)} pukul ${clock(booking.departureTime)}; ${booking.seatCount} kursi; total ${rupiah(booking.totalPrice)}.`,
    actions: [{ label: 'Buka e-tiket', to: `/tiket/${booking.code}` }],
    suggestions: ['Cara ubah jadwal?', 'Aturan bagasi berapa kg?', 'Cara batalkan tiket?'],
  }
}

function answerFleet() {
  const buses = db
    .prepare('SELECT name, class, seat_rows AS seatRows, seat_cols AS seatCols FROM buses WHERE is_active = 1 ORDER BY id')
    .all()
  const list = buses.map((b) => `${b.name} (${b.class}, ${b.seatRows * b.seatCols} kursi)`)
  const lines = [
    `Kami mengoperasikan ${buses.length} armada: ${list.join('; ')}.`,
    'Fasilitas tiap kelas berbeda — AC, kursi reclining, colokan, WiFi, hingga kabin sleeper untuk perjalanan malam.',
  ]
  return {
    text: lines.join(' '),
    facts: lines.join('\n'),
    actions: [{ label: 'Lihat detail armada', to: '/#armada' }],
    suggestions: ['Jakarta ke Yogyakarta besok', 'Harga termurahnya berapa?', 'Aturan bagasi berapa kg?'],
  }
}

function answerFaq(item) {
  const lines = [item.a]
  return {
    text: lines.join(' '),
    facts: `Pertanyaan: ${item.q}\nJawaban resmi: ${item.a}`,
    actions:
      item.id === 'kontak'
        ? []
        : [{ label: `Hubungi ${CONTACT.phone}`, href: CONTACT.phoneHref }],
    suggestions: ['Jakarta ke Yogyakarta besok', 'Cara batalkan tiket?', 'Berapa kapasitas bagasi?'],
  }
}

function answerGreeting() {
  return {
    text: `Halo! Saya asisten Jokam Trans. Saya bisa membantu: ${CAPABILITIES.join(', ')}. Mau mulai dari mana?`,
    suggestions: ['Jakarta ke Yogyakarta besok', 'Sarankan kursi paling nyaman', 'Aturan bagasi berapa kg?'],
  }
}

function answerHelp() {
  return {
    text: `Saya bisa: ${CAPABILITIES.join(', ')}. Cukup tulis kebutuhan Anda dengan bahasa sehari-hari — misalnya "besok dari Bandung ke Semarang untuk 2 orang".`,
    suggestions: ['Jakarta ke Yogyakarta besok', 'Cara lacak tiket?', 'Cara batalkan tiket?'],
  }
}

function answerUnknown() {
  return {
    text: outOfScopeReply(),
    actions: [{ label: `Telepon ${CONTACT.phone}`, href: CONTACT.phoneHref }],
    suggestions: ['Jakarta ke Yogyakarta besok', 'Aturan bagasi berapa kg?', 'Cara lacak tiket?'],
  }
}

/* ------------------------------------------------------------------ */
/* Orkestrasi                                                          */
/* ------------------------------------------------------------------ */

/**
 * Apakah pesan ini sekadar melengkapi pencarian sebelumnya
 * ("besok", "yang VIP saja", "3 orang") — bukan pertanyaan baru.
 */
function looksLikeRefinement(analysis) {
  if (analysis.citiesMentioned.length) return true

  const hasSlot = Boolean(analysis.slots.date || analysis.slots.busClass || analysis.slots.passengersGiven)
  if (!hasSlot) return false

  // Pesan pendek yang isinya hanya keterangan tambahan, atau pesan yang
  // memang memakai kata seputar perjalanan seperti "besok ada jadwal?".
  const words = analysis.normalized.split(' ').filter(Boolean)
  return words.length <= 4 || looksLikeSearch(analysis.normalized)
}

/** Menentukan maksud akhir, termasuk melanjutkan percakapan sebelumnya. */
function resolveIntent(analysis, session) {
  if (analysis.intent !== 'tidak_dikenal') return { intent: analysis.intent, refined: false }
  if (!looksLikeRefinement(analysis)) return { intent: analysis.intent, refined: false }

  const refineable = Boolean(session.slots.origin && session.slots.destination)
  return refineable ? { intent: 'cari_jadwal', refined: true } : { intent: analysis.intent, refined: false }
}

function buildAnswer(session, message) {
  const { index, known } = cityIndex()
  const analysis = analyze(message, { cityIndex: { index, known }, hasRoute: routeExists })
  const { intent, refined } = resolveIntent(analysis, session)

  // Menyebut rute lengkap yang berbeda = pencarian baru; filter lama
  // (kelas, tanggal) jangan ikut terbawa.
  const fullNewRoute =
    analysis.citiesMentioned.length >= 2 &&
    (analysis.slots.origin !== session.slots.origin ||
      analysis.slots.destination !== session.slots.destination)

  // FAQ menang atas "pencarian tanpa kota", tetapi TIDAK boleh menabrak
  // pesan lanjutan seperti "kalau yang VIP saja".
  const faq = matchFaq(message)
  const effectiveIntent =
    intent === 'cari_jadwal' && !refined && analysis.citiesMentioned.length === 0 && faq ? 'faq' : intent

  session.slots = mergeSlots(session.slots, analysis.slots)
  if (fullNewRoute) {
    session.slots.busClass = analysis.slots.busClass ?? null
    session.slots.date = analysis.slots.date ?? null
    session.slots.dateLabel = analysis.slots.dateLabel ?? null
  }
  const slots = session.slots

  const base = { intent: effectiveIntent, note: analysis.note ?? null }

  switch (effectiveIntent) {
    case 'cari_jadwal':
      return { ...base, ...answerSearch(session, slots, analysis.note) }
    case 'sarankan_kursi':
      return { ...base, ...answerSeats(session, slots) }
    case 'lacak_tiket':
      return { ...base, ...answerTicket(slots) }
    case 'tanya_armada':
      return { ...base, ...answerFleet() }
    case 'faq':
      return { ...base, ...answerFaq(faq) }
    case 'sapaan':
      return { ...base, ...answerGreeting() }
    case 'bantuan':
      return { ...base, ...answerHelp() }
    default:
      if (faq) return { ...base, intent: 'faq', ...answerFaq(faq) }
      return { ...base, ...answerUnknown() }
  }
}

/* ------------------------------------------------------------------ */
/* Router Express                                                      */
/* ------------------------------------------------------------------ */

export function assistantRouter() {
  const router = express.Router()

  router.get('/assistant/info', (_req, res) => {
    res.json({
      mode: isConfigured() ? 'llm' : 'rules',
      provider: providerInfo(),
      capabilities: CAPABILITIES,
      contact: CONTACT,
    })
  })

  router.post('/chat', async (req, res) => {
    const raw = req.body?.message
    const message = typeof raw === 'string' ? raw.trim() : ''

    if (!message) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' })
    if (message.length > MAX_MESSAGE_LENGTH)
      return res.status(400).json({ error: `Pesan maksimal ${MAX_MESSAGE_LENGTH} karakter.` })
    if (!allowRequest(req.ip ?? 'unknown'))
      return res
        .status(429)
        .json({ error: 'Terlalu banyak pesan. Coba lagi beberapa menit lagi atau hubungi layanan pelanggan.' })

    const session = getSession(req.body?.sessionId)

    /* --- Server-Sent Events --- */
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    const send = (event, data) => {
      if (res.writableEnded) return
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      } catch {
        /* klien sudah menutup koneksi */
      }
    }

    const abort = new AbortController()
    req.on('close', () => abort.abort())

    let answer
    try {
      answer = buildAnswer(session, message)
    } catch (error) {
      console.error('[ai] gagal menyusun jawaban', error)
      answer = { text: outOfScopeReply(), intent: 'error', actions: [], suggestions: [] }
    }

    logTurn(session.id, 'user', message, answer.intent, isConfigured() ? 'llm' : 'rules')
    session.transcript.push({ role: 'user', content: message })
    session.transcript = session.transcript.slice(-8)

    const canRephrase = isConfigured() && Boolean(answer.facts)
    send('meta', {
      sessionId: session.id,
      mode: canRephrase ? 'llm' : 'rules',
      intent: answer.intent,
    })

    if (canRephrase) {
      let produced = false
      for await (const chunk of rephrase({
        text: answer.text,
        facts: answer.facts,
        question: message,
        signal: abort.signal,
      })) {
        if (abort.signal.aborted) break
        produced = true
        send('chunk', { text: chunk })
      }
      if (!produced) send('chunk', { text: answer.text })
    } else if (answer.text) {
      send('chunk', { text: answer.text, paced: true })
    }

    if (answer.cards?.length) send('cards', { items: answer.cards })
    if (answer.actions?.length) send('actions', { items: answer.actions })
    send('done', { suggestions: answer.suggestions ?? [] })

    logTurn(session.id, 'assistant', answer.text, answer.intent, canRephrase ? 'llm' : 'rules')
    session.transcript.push({ role: 'assistant', content: answer.text })

    if (!res.writableEnded) res.end()
  })

  return router
}
