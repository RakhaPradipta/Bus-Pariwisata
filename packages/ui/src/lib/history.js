/**
 * Riwayat pemesanan lokal.
 *
 * Server tidak menyimpan "pemilik" sesi untuk pemesanan publik, jadi kode
 * pemesanan yang pernah dibuat browser ini disimpan agar mudah dibuka kembali
 * dari halaman "Lacak Tiket".
 */

const KEY = 'trans27.booking.history'
const MAX_ITEMS = 12

export function listBookings() {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveBooking({ code, origin, destination, departureTime, seatCount }) {
  if (!code) return
  try {
    const entry = { code, origin, destination, departureTime, seatCount, savedAt: Date.now() }
    const next = [entry, ...listBookings().filter((b) => b.code !== code)].slice(0, MAX_ITEMS)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* localStorage tidak tersedia — abaikan */
  }
}

export function clearBookings() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* abaikan */
  }
}
