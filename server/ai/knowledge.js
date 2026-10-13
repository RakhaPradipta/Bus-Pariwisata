/**
 * Basis pengetahuan Jokam Trans.
 *
 * Ini satu-satunya sumber kebenaran untuk kebijakan perusahaan. Model bahasa
 * TIDAK boleh menjawab dari ingatannya: jawaban diambil dari daftar ini, dan
 * pertanyaan di luar daftar ini harus diarahkan ke layanan pelanggan.
 */

export const CONTACT = {
  phone: '(021) 5000 2727',
  phoneHref: 'tel:+622150002727',
  email: 'halo@27trans.co.id',
  hours: 'Setiap hari, 05.00–23.00 WIB',
  pool: 'Terminal Bus Pulo Gebang, Jakarta Timur 13950',
}

export const FACTS = {
  baggage: '20 kg bagasi gratis per penumpang, kelebihannya dikenakan biaya tambahan di terminal.',
  cancellation: 'Pembatalan paling lambat 2 jam sebelum keberangkatan, dengan potongan 25% dari harga tiket.',
  reschedule: 'Perubahan jadwal bisa dilakukan satu kali melalui layanan pelanggan.',
  arrival: 'Datanglah 30 menit sebelum keberangkatan untuk verifikasi tiket dan pemuatan bagasi.',
  doorClose: 'Pintu bus ditutup 10 menit sebelum jadwal keberangkatan.',
  maxSeats: 'Maksimal 6 kursi dalam satu pemesanan pada satu armada.',
  group: 'Untuk rombongan atau carter, hubungi layanan pelanggan agar kursi bisa diblokir lebih awal.',
  payment: 'Harga yang tampil sudah termasuk asuransi perjalanan penumpang. Tidak ada biaya tersembunyi.',
  ticket: 'Setelah memesan Anda langsung menerima kode berformat 27T-XXXXXX beserta halaman e-tiket. Cukup ditunjukkan ke petugas.',
  childPolicy: 'Anak di atas usia 2 tahun menempati satu kursi penuh dan wajib memiliki tiket sendiri.',
  refund: 'Dana pembatalan dikembalikan ke rekening pengirim dalam 3–7 hari kerja setelah pengajuan diterima.',
  punctuality: 'Riwayat ketepatan keberangkatan armada kami di atas 94%.',
}

/** FAQ yang cocok dijadikan bahan pencocokan pertanyaan penumpang. */
export const FAQ = [
  {
    id: 'bagasi',
    q: 'Berapa kapasitas bagasi yang saya dapat?',
    a: FACTS.baggage,
    keywords: ['bagasi', 'bagas', 'koper', 'tas', 'barang', 'kg', 'kilo', 'muatan'],
  },
  {
    id: 'batal',
    q: 'Bisakah membatalkan tiket?',
    a: `${FACTS.cancellation} ${FACTS.refund}`,
    keywords: ['batal', 'batalkan', 'pembatalan', 'refund', 'uang kembali', 'dana', 'cancel'],
  },
  {
    id: 'reschedule',
    q: 'Bisakah mengubah jadwal?',
    a: `${FACTS.reschedule} Untuk perubahan, hubungi ${CONTACT.phone} (${CONTACT.hours}).`,
    keywords: ['ubah', 'ganti', 'reschedule', 'pindah jadwal', 'tukar jadwal', 'mundur', 'majukan'],
  },
  {
    id: 'kedatangan',
    q: 'Kapan saya harus tiba di terminal?',
    a: `${FACTS.arrival} ${FACTS.doorClose}`,
    keywords: ['datang', 'tiba', 'terminal', 'jam berapa', 'telat', 'terlambat', 'boarding'],
  },
  {
    id: 'jumlah-kursi',
    q: 'Satu pemesanan bisa untuk berapa orang?',
    a: `${FACTS.maxSeats} ${FACTS.group}`,
    keywords: ['berapa orang', 'romobongan', 'rombongan', 'carter', 'sewa bus', 'grup', 'keluarga'],
  },
  {
    id: 'bayar',
    q: 'Apa saja biaya yang muncul?',
    a: FACTS.payment,
    keywords: ['biaya', 'harga akhir', 'admin', 'tambahan', 'tersembunyi', 'asuransi', 'bayar', 'pembayaran'],
  },
  {
    id: 'tiket',
    q: 'Bagaimana cara memakai e-tiket?',
    a: `${FACTS.ticket} Bila kode tiket hilang, gunakan halaman Lacak Tiket dengan kode pemesanan Anda.`,
    keywords: ['e-tiket', 'etiket', 'tiket digital', 'cetak', 'print', 'kode', 'qr'],
  },
  {
    id: 'anak',
    q: 'Apakah anak perlu tiket sendiri?',
    a: FACTS.childPolicy,
    keywords: ['anak', 'bayi', 'balita', 'kids', 'anak-anak'],
  },
  {
    id: 'kontak',
    q: 'Bagaimana menghubungi layanan pelanggan?',
    a: `Telepon ${CONTACT.phone} (${CONTACT.hours}) atau email ${CONTACT.email}. Pool kami di ${CONTACT.pool}.`,
    keywords: ['kontak', 'telepon', 'hubungi', 'email', 'customer service', 'cs', 'alamat', 'pool'],
  },
  {
    id: 'armada',
    q: 'Kelas armada apa saja yang tersedia?',
    a: 'Armada kami terbagi menjadi kelas Ekonomi, Eksekutif, Executive Plus, VIP, dan Sleeper. Fasilitas tiap kelas (AC, reclining seat, WiFi, colokan, selimut) berbeda — detailnya tampil saat Anda memilih jadwal.',
    keywords: ['kelas', 'armada', 'bus apa', 'fasilitas', 'sleeper', 'vip', 'eksekutif', 'wifi', 'ac'],
  },
]

const STOPWORDS = new Set([
  'yang', 'dan', 'atau', 'saya', 'aku', 'apa', 'itu', 'ini', 'untuk', 'dengan',
  'bisa', 'boleh', 'kah', 'nya', 'di', 'ke', 'dari', 'ada', 'apakah', 'berapa',
  'bagaimana', 'gimana', 'cara', 'mau', 'ingin', 'tolong', 'mohon', 'dong',
])

/** Skor kecocokan sederhana: banyak kata kunci yang muncul, semakin relevan. */
export function matchFaq(text) {
  const normalized = ` ${String(text ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ')} `
  if (normalized.trim().length < 3) return null

  let best = null
  for (const item of FAQ) {
    let score = 0
    for (const keyword of item.keywords) {
      if (normalized.includes(` ${keyword} `) || normalized.includes(` ${keyword}`)) {
        score += keyword.includes(' ') ? 3 : keyword.length >= 6 ? 2 : 1
      }
    }
    if (!best || score > best.score) best = { item, score }
  }

  return best && best.score >= 1 ? best.item : null
}

/**
 * Kalimat penolakan yang jujur ketika pertanyaannya di luar wewenang kami.
 * Lebih baik mengaku tidak tahu daripada mengarang kebijakan perusahaan.
 */
export function outOfScopeReply() {
  return `Saya khusus membantu urusan tiket dan perjalanan Jokam Trans, jadi untuk hal di luar itu saya tidak punya informasi yang bisa dipercaya dan lebih baik tidak menebak. Untuk pertanyaan seputar kebijakan perjalanan kami, silakan hubungi ${CONTACT.phone} (${CONTACT.hours}) — tim kami akan membantu langsung.`
}

/** Ringkasan kemampuan asisten, dipakai saat menyapa atau gagal memahami. */
export const CAPABILITIES = [
  'cari jadwal dan harga',
  'sarankan kursi paling nyaman',
  'jelaskan aturan tiket, bagasi, dan pembatalan',
  'buka kembali e-tiket dari kode pemesanan',
]

export function unknownIntentReply() {
  return `Maaf, saya belum menangkap maksudnya. Saya bisa membantu: ${CAPABILITIES.join(', ')}.`
}

export function isStopword(word) {
  return STOPWORDS.has(word)
}
