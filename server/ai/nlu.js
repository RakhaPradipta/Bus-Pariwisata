/**
 * Pemahaman bahasa alami berbasis aturan untuk Bahasa Indonesia.
 *
 * Semua yang bisa dijawab dengan aturan dikerjakan di sini: gratis, instan,
 * dan bisa diuji. Model bahasa hanya dipakai untuk kalimat yang tidak
 * berbentuk template — bukan untuk menebak maksud yang bisa dipastikan.
 */

/** Sinonim kata yang sering dipakai penumpang. Kunci harus huruf kecil. */
const ALIASES = {
  jogja: 'Yogyakarta',
  jogjakarta: 'Yogyakarta',
  yogya: 'Yogyakarta',
  yogyakarta: 'Yogyakarta',
  yk: 'Yogyakarta',
  sby: 'Surabaya',
  suroboyo: 'Surabaya',
  surabaya: 'Surabaya',
  jkt: 'Jakarta',
  jakarta: 'Jakarta',
  bdg: 'Bandung',
  bandung: 'Bandung',
  smg: 'Semarang',
  semarang: 'Semarang',
  solo: 'Solo',
  surakarta: 'Solo',
  mlg: 'Malang',
  malang: 'Malang',
  cirebon: 'Cirebon',
  cerbon: 'Cirebon',
  pwt: 'Purwokerto',
  purwokerto: 'Purwokerto',
  denpasar: 'Denpasar',
  bali: 'Denpasar',
  plm: 'Palembang',
  palembang: 'Palembang',
  bwi: 'Banyuwangi',
  banyuwangi: 'Banyuwangi',
}

const MONTHS = {
  januari: 1, jan: 1,
  februari: 2, feb: 2,
  maret: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  agustus: 8, agu: 8, ags: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10,
  november: 11, nov: 11,
  desember: 12, des: 12,
}

const WEEKDAYS = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  jum: 5,
  sabtu: 6,
  minggu: 0,
  ahad: 0,
}

const CLASS_WORDS = [
  { words: ['executive plus', 'executive+', 'exe plus'], value: 'Executive Plus' },
  { words: ['eksekutif', 'executive', 'exe'], value: 'Eksekutif' },
  { words: ['sleeper', 'tidur'], value: 'Sleeper' },
  { words: ['vip'], value: 'VIP' },
  { words: ['ekonomi', 'ekonomis', 'termurah', 'hemat'], value: 'Ekonomi' },
]

const SEAT_WORDS = [
  'nyaman',
  'terbaik',
  'paling bagus',
  'bagus',
  'rekomendasi',
  'saran',
  'jendela',
  'lorong',
  'dimana',
  'di mana',
  'posisi',
  'berdampingan',
  'berdekatan',
  'dampingan',
  'nyaman',
]
const BOOKING_INTENT_WORDS = ['jadwal', 'rute', 'berangkat', 'pesan', 'beli', 'tiket', 'harga', 'tarif', 'biaya', 'cari', 'ada gak', 'ada ga', 'tersedia']
const GREETING_WORDS = ['halo', 'hallo', 'hai', 'hi', 'selamat', 'pagi', 'siang', 'sore', 'malam', 'assalam', 'permisi', 'tes', 'test', 'woi']
const HELP_WORDS = ['bisa apa', 'apa yang bisa', 'bantuan', 'bantu apa', 'help', 'cara pakai', 'fitur']
const TRACK_WORDS = ['lacak', 'cek tiket', 'kode tiket', 'status tiket', 'kode pemesanan', 'tiket saya hilang', 'lupa kode']

// Tidak memakai \b di depan: pada pesan seperti "lacaktiket27T-AB12CD"
// huruf dan angka menyambung sehingga \b tidak pernah cocok di posisi itu.
// Bentuk bertanda hubung diprioritaskan; bentuk tanpa hubung diterima hanya
// bila diikuti pemisah, supaya tidak menebak batas kode dari teks yang menempel.
const CODE_WITH_DASH = /27t-([a-z0-9]{6})(?![\w-])/i
const CODE_PLAIN = /27t([a-z0-9]{6})(?![\w-])/i
// "TRX-" adalah kode data contoh versi lama; tetap diterima agar demo lama jalan.
const CODE_LEGACY = /trx-([a-z0-9]{6})(?![\w-])/i

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9\s:-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function localDate(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

function addDays(base, days) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  d.setDate(d.getDate() + days)
  return d
}

/** Jarak edit sederhana untuk mencocokkan salah ketik nama kota. */
function levenshtein(a, b) {
  if (a === b) return 0
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
    }
  }
  return matrix[a.length][b.length]
}

/**
 * Membangun indeks pencocokan kota.
 * Daftar kota resmi selalu berasal dari database; alias hanya preferensi.
 */
export function buildCityIndex(cities) {
  const index = new Map()
  const known = new Set(cities)

  for (const city of cities) index.set(normalize(city), city)
  for (const [alias, city] of Object.entries(ALIASES)) {
    if (known.has(city) && !index.has(alias)) index.set(alias, city)
  }

  return { index, known, cities }
}

/** Mencari kota di dalam teks (frasa 2 kata lebih dulu, lalu 1 kata, lalu fuzzy). */
function findCities(tokens, cityIndex) {
  const found = []
  const used = new Set()

  const tryMatch = (phrase, startIndex) => {
    const hit = cityIndex.index.get(phrase)
    if (hit) return hit
    // Toleransi salah ketik: makin panjang kata, makin longgar.
    if (phrase.length >= 8) {
      for (const [key, city] of cityIndex.index) {
        if (Math.abs(key.length - phrase.length) <= 3 && levenshtein(phrase, key) <= 2) return city
      }
    } else if (phrase.length >= 5) {
      for (const [key, city] of cityIndex.index) {
        if (key.length >= 5 && levenshtein(phrase, key) <= 1) return city
      }
    }
    return startIndex >= 0 ? null : null
  }

  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i)) continue
    const pair = `${tokens[i]} ${tokens[i + 1] ?? ''}`.trim()
    const pairHit = tokens[i + 1] ? tryMatch(pair, i) : null
    const hit = pairHit ?? tryMatch(tokens[i], i)

    if (hit) {
      found.push({ city: hit, tokenIndex: i })
      used.add(i)
      if (pairHit) used.add(i + 1)
    }
  }

  return found
}

/** Menentukan mana kota asal dan mana kota tujuan dari teks. */
function assignDirection(normalized, found, hasRoute) {
  const slots = { origin: null, destination: null }
  if (!found.length) return slots

  if (found.length === 1) {
    // "ke jogja" → tujuan; "dari jakarta" → asal.
    const before = normalized.slice(0, normalized.indexOf(found[0].city.toLowerCase()))
    if (/\bdari\b|\bstart\b|\bberangkat dari\b/.test(before)) slots.origin = found[0].city
    else if (/\bke\b|\bmenuju\b|\btujuan\b|\bto\b/.test(before)) slots.destination = found[0].city
    else slots.destination = found[0].city
    return slots
  }

  const [first, second] = found
  const beforeFirst = normalized.slice(0, normalized.indexOf(first.city.toLowerCase()))
  const between = normalized.slice(
    normalized.indexOf(first.city.toLowerCase()) + first.city.length,
    normalized.indexOf(second.city.toLowerCase()),
  )
  const toMarker = /\bke\b|\bmenuju\b|\btujuan\b/.test(between)
  const fromMarker = /\bdari\b/.test(beforeFirst)

  if (toMarker || fromMarker) {
    slots.origin = first.city
    slots.destination = second.city
    return slots
  }

  // Tanpa penanda arah, gunakan database: urutan mana yang benar-benar ada.
  if (hasRoute(first.city, second.city)) {
    slots.origin = first.city
    slots.destination = second.city
  } else if (hasRoute(second.city, first.city)) {
    slots.origin = second.city
    slots.destination = first.city
  } else {
    slots.origin = first.city
    slots.destination = second.city
  }
  return slots
}

/** Mengekstrak tanggal keberangkatan dari teks. */
function findDate(normalized, today) {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(normalized)
  if (iso) return { date: iso[0], label: 'tanggal yang Anda sebutkan' }

  const numeric = /(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/.exec(normalized)
  if (numeric) {
    const day = Number(numeric[1])
    const month = Number(numeric[2])
    const year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : today.getFullYear()
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { date: localDate(new Date(year, month - 1, day)), label: 'tanggal yang Anda sebutkan' }
    }
  }

  if (/\bhari ini\b|\bsore ini\b|\bmalam ini\b|\bpagi ini\b/.test(normalized))
    return { date: localDate(today), label: 'hari ini' }
  if (/\bbesok\b|\besok\b|\bbesuk\b/.test(normalized))
    return { date: localDate(addDays(today, 1)), label: 'besok' }
  if (/\blusa\b/.test(normalized)) return { date: localDate(addDays(today, 2)), label: 'lusa' }
  if (/\bminggu depan\b|\bpekan depan\b/.test(normalized))
    return { date: localDate(addDays(today, 7)), label: 'minggu depan' }
  if (/\bakhir bulan\b/.test(normalized)) {
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return { date: localDate(last), label: 'akhir bulan ini' }
  }

  const dayMonth = /\b(\d{1,2})\s+([a-z]{3,9})\b/.exec(normalized)
  if (dayMonth && MONTHS[dayMonth[2]]) {
    const day = Number(dayMonth[1])
    let year = today.getFullYear()
    let candidate = new Date(year, MONTHS[dayMonth[2]] - 1, day)
    if (candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      year += 1
      candidate = new Date(year, MONTHS[dayMonth[2]] - 1, day)
    }
    return { date: localDate(candidate), label: `${day} ${dayMonth[2]}` }
  }

  const dayOnly = /\btanggal\s+(\d{1,2})\b/.exec(normalized)
  if (dayOnly) {
    const day = Number(dayOnly[1])
    if (day >= 1 && day <= 31) {
      let candidate = new Date(today.getFullYear(), today.getMonth(), day)
      if (candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate()))
        candidate = new Date(today.getFullYear(), today.getMonth() + 1, day)
      return { date: localDate(candidate), label: `tanggal ${day}` }
    }
  }

  for (const [name, value] of Object.entries(WEEKDAYS)) {
    if (!new RegExp(`\\b${name}\\b`).test(normalized)) continue
    const delta = (value - today.getDay() + 7) % 7
    return { date: localDate(addDays(today, delta)), label: `hari ${name}` }
  }

  return null
}

/** Mengekstrak jumlah penumpang. */
function findPassengers(normalized) {
  const word = /\b(berdua|bertiga|berempat|berlima|berenam)\b/.exec(normalized)
  if (word) {
    return { value: { berdua: 2, bertiga: 3, berempat: 4, berlima: 5, berenam: 6 }[word[1]], given: true }
  }

  const unit = /\b(\d{1,2})\s*(orang|penumpang|kursi|tiket|pax)\b/.exec(normalized)
  if (unit) {
    const value = Number(unit[1])
    if (value >= 1 && value <= 6) return { value, given: true }
    if (value > 6) return { value: 6, given: true, note: 'Maksimal 6 kursi per pemesanan.' }
  }

  return { value: 1, given: false }
}

function findClass(normalized) {
  for (const entry of CLASS_WORDS) {
    for (const word of entry.words) {
      if (normalized.includes(word)) return entry.value
    }
  }
  return null
}

/** Apakah teks mengandung kata kunci seputar pencarian/perjalanan. */
export function looksLikeSearch(normalized) {
  return BOOKING_INTENT_WORDS.some((word) => normalized.includes(word))
}

/**
 * Menganalisis satu pesan penumpang.
 *
 * @param {string} text pesan mentah
 * @param {object} options
 * @param {ReturnType<typeof buildCityIndex>} options.cityIndex indeks kota dari database
 * @param {(o: string, d: string) => boolean} options.hasRoute pemeriksa rute di database
 * @param {Date} [options.now] waktu acuan (memudahkan pengujian)
 */
export function analyze(text, { cityIndex, hasRoute, now = new Date() }) {
  const normalized = normalize(text)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tokens = normalized.split(' ').filter(Boolean)

  const codeMatch = CODE_WITH_DASH.exec(normalized) ?? CODE_PLAIN.exec(normalized)
  const legacyMatch = CODE_LEGACY.exec(normalized)
  const bookingCode = codeMatch
    ? `27T-${codeMatch[1].toUpperCase()}`
    : legacyMatch
      ? `TRX-${legacyMatch[1].toUpperCase()}`
      : null
  const foundCities = findCities(tokens, cityIndex)
  const direction = assignDirection(normalized, foundCities, hasRoute)
  const dateInfo = findDate(normalized, today)
  const passengers = findPassengers(normalized)
  const busClass = findClass(normalized)

  const has = (words) => words.some((w) => normalized.includes(w))

  let intent = 'tidak_dikenal'
  let confidence = 0.5

  if (bookingCode || has(TRACK_WORDS)) {
    intent = 'lacak_tiket'
    confidence = bookingCode ? 0.95 : 0.7
  } else if (foundCities.length && (has(BOOKING_INTENT_WORDS) || foundCities.length >= 2 || dateInfo || passengers.given)) {
    intent = 'cari_jadwal'
    confidence = foundCities.length >= 2 ? 0.9 : 0.7
  } else if (has(SEAT_WORDS) && has(['kursi', 'seat', 'posisi'])) {
    intent = 'sarankan_kursi'
    confidence = 0.75
  } else if (has(HELP_WORDS)) {
    intent = 'bantuan'
    confidence = 0.8
  } else if (has(['armada', 'kelas', 'fasilitas', 'sleeper', 'wifi', 'colokan', 'selimut'])) {
    intent = 'tanya_armada'
    confidence = 0.75
  } else if (has(BOOKING_INTENT_WORDS) && !foundCities.length) {
    intent = 'cari_jadwal'
    confidence = 0.55
  } else if (normalized.split(' ').length <= 4 && has(GREETING_WORDS)) {
    intent = 'sapaan'
    confidence = 0.85
  }

  const slots = {
    origin: direction.origin,
    destination: direction.destination,
    date: dateInfo?.date ?? null,
    dateLabel: dateInfo?.label ?? null,
    passengers: passengers.value,
    passengersGiven: passengers.given,
    busClass,
    bookingCode,
  }

  return { normalized, intent, confidence, slots, note: passengers.note ?? null, citiesMentioned: foundCities.map((c) => c.city) }
}

/** Menggabungkan slot baru dengan konteks percakapan sebelumnya. */
export function mergeSlots(previous, current) {
  const merged = { ...(previous ?? {}) }
  for (const [key, value] of Object.entries(current ?? {})) {
    if (key === 'passengers') {
      if (current.passengersGiven) merged.passengers = value
      else if (merged.passengers == null) merged.passengers = value
      continue
    }
    if (value != null) merged[key] = value
  }
  return merged
}

export const INTENTS = [
  'cari_jadwal',
  'sarankan_kursi',
  'lacak_tiket',
  'tanya_armada',
  'bantuan',
  'sapaan',
  'tidak_dikenal',
]
