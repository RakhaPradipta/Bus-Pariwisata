/**
 * Pembangun tautan halaman.
 *
 * Dikumpulkan di satu tempat supaya format URL tidak ditulis ulang di setiap
 * komponen — dan supaya perubahan rute (mis. menambah bagian) cukup diubah
 * sekali.
 */

/** Halaman detail satu trayek: `/trayek/jakarta/bandung`. */
export function routeDetailPath({ origin, destination }) {
  return `/trayek/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`
}

/** Halaman pencarian jadwal untuk satu pasangan kota dan tanggal. */
export function scheduleSearchPath({ origin, destination, date, passengers }) {
  const params = new URLSearchParams({ from: origin, to: destination })
  if (date) params.set('date', date)
  if (passengers) params.set('penumpang', String(passengers))
  return `/rute?${params.toString()}`
}

/** Halaman pemesanan untuk satu jadwal. */
export function bookingPath({ scheduleId, passengers }) {
  return `/pesan/${scheduleId}${passengers ? `?penumpang=${passengers}` : ''}`
}
