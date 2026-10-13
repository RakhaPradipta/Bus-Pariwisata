/**
 * Helper tata letak kursi bus.
 *
 * Kursi dinomori baris-per-baris (row-major), 1..rows*cols.
 * Contoh layout 2-2 (4 kolom, lorong setelah kolom 2):
 *
 *   1  2  |  3  4
 *   5  6  |  7  8
 *   ...
 *
 * Catatan: objek bus bisa datang dalam bentuk snake_case (langsung dari
 * database) maupun camelCase (hasil serialisasi API), jadi dimensi kursi
 * selalu dinormalisasi di satu tempat.
 */

function dimensions(bus) {
  return {
    rows: Number(bus.seatRows ?? bus.seat_rows),
    cols: Number(bus.seatCols ?? bus.seat_cols),
  }
}

/** Jumlah kursi pada sebuah bus. */
export function seatCount(bus) {
  const { rows, cols } = dimensions(bus)
  return rows * cols
}

/** Informasi layout (baris, kolom, posisi lorong) dalam bentuk seragam. */
export function seatLayout(bus) {
  const { rows, cols } = dimensions(bus)
  return {
    rows,
    cols,
    aisleAfter: Number(bus.aisleAfter ?? bus.aisle_after) || 0,
    totalSeats: rows * cols,
  }
}

/**
 * Menghasilkan daftar kursi terurut untuk sebuah bus.
 * @returns {{number:number,row:number,col:number,label:string}[]}
 */
export function buildSeatMap(bus) {
  const { rows, cols } = dimensions(bus)
  const seats = []
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      const number = (row - 1) * cols + col
      seats.push({ number, row, col, label: String(number) })
    }
  }
  return seats
}

/** Validasi nomor kursi terhadap layout bus. */
export function isValidSeat(bus, number) {
  return Number.isInteger(number) && number >= 1 && number <= seatCount(bus)
}
