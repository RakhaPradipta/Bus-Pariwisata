/**
 * Helper format tampilan (Bahasa Indonesia).
 *
 * Server menyimpan waktu sebagai string lokal `YYYY-MM-DD HH:mm` agar tidak
 * terpengaruh timezone. Semua parsing di sini memakai konstruktor
 * `new Date(y, m, d, h, min)` (waktu lokal), bukan `new Date(string)`.
 */

const RUPIAH = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const NUMBER = new Intl.NumberFormat('id-ID')

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]
const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3))

/** 540000 → "Rp 540.000" */
export const rupiah = (value) => RUPIAH.format(Number(value) || 0)

export const number = (value) => NUMBER.format(Number(value) || 0)

export function parseDateTime(value) {
  if (!value) return null
  if (value instanceof Date) return value

  const [datePart, timePart = '00:00'] = String(value).replace('T', ' ').split(' ')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, h || 0, mi || 0, 0)
}

const pad = (n) => String(n).padStart(2, '0')

export function timeOf(value) {
  const d = parseDateTime(value)
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '--:--'
}

export function longDate(value) {
  const d = parseDateTime(value)
  if (!d) return '-'
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

export function mediumDate(value) {
  const d = parseDateTime(value)
  if (!d) return '-'
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export function shortDate(value) {
  const d = parseDateTime(value)
  if (!d) return '-'
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

export function relativeDay(value) {
  const d = parseDateTime(value)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target - today) / 86_400_000)
  if (diff === 0) return 'Hari ini'
  if (diff === 1) return 'Besok'
  if (diff === 2) return 'Lusa'
  return null
}

export function duration(minutes) {
  const total = Number(minutes) || 0
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h && m) return `${h} jam ${m} mnt`
  if (h) return `${h} jam`
  return `${m} mnt`
}

export function toDateInput(value = new Date()) {
  const d = value instanceof Date ? value : parseDateTime(value) ?? new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function dateInputPlus(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toDateInput(d)
}

export const todayInput = () => toDateInput(new Date())

export function compactDay(value) {
  const d = parseDateTime(value)
  if (!d) return '-'
  return `${DAY_NAMES[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
}

export function isPast(value) {
  const d = parseDateTime(value)
  return Boolean(d) && d.getTime() < Date.now()
}

export function minutesBetween(start, end) {
  const a = parseDateTime(start)
  const b = parseDateTime(end)
  if (!a || !b) return 0
  return Math.max(0, Math.round((b - a) / 60_000))
}
