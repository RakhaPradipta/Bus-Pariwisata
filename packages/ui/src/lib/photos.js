/**
 * Katalog foto Jokam Trans.
 *
 * Aturan pemakaian:
 *  1. Semua berkas ada di `public/photos/<nama>.jpg` — satu slot satu berkas,
 *     supaya mengganti foto cukup menimpa berkasnya tanpa menyentuh kode.
 *  2. Foto ini **suasana**, bukan unit Jokam Trans. Karena itu tiap foto selalu
 *     tampil dengan penanda "Ilustrasi" dan kredit pemiliknya, dan tidak
 *     pernah dipakai untuk mengklaim armada, tarif, atau angka apa pun.
 *  3. Semua angka yang berdampingan dengan foto tetap berasal dari database.
 */

export const PHOTOS = {
  heroJalanTol: {
    src: 'hero-tol-trans-jawa.jpg',
    subject: 'Jalan tol di pagi hari',
    credit: 'Dari: Juan Pablo Rodríguez / Pexels (CC BY 2.0)',
  },
  interiorExecutive: {
    src: 'interior-executive.jpg',
    subject: 'Kabin Eksekutif',
    credit: 'Illustrasi oleh Jokam Trans (dibuat khusus).',
  },
  interiorFirstClass: {
    src: 'interior-first-class.jpg',
    subject: 'Kabin First Class',
    credit: 'Illustrasi oleh Jokam Trans (dibuat khusus).',
  },
  interiorSuperTop: {
    src: 'interior-super-top.jpg',
    subject: 'Kabin Super Top',
    credit: 'Illustrasi oleh Jokam Trans (dibuat khusus).',
  },
  armadaAntarKota: {
    src: 'armada-antar-kota.jpg',
    subject: 'Armada Antar Kota',
    credit: 'Dari: Yakir Ben Nehemiah / Pexels (CC BY 2.0)',
  },
  armadaParkRide: {
    src: 'armada-park-ride.jpg',
    subject: 'Parkir & Pengisian Daya',
    credit: 'Dari: Jonas Jusys / Pexels (CC BY 2.0)',
  },
  armadaPeron: {
    src: 'armada-peron.jpg',
    subject: 'Peron armada berpindah',
    credit: 'Dari: Michael Fomplete / Pexels (CC BY 2.0)',
  },
  armadaTerminal: {
    src: 'armada-terminal.jpg',
    subject: 'Armada di terminal',
    credit: 'Dari: Oliver Hale / Pexels (CC BY 2.0)',
  },
  jalanCipularang: {
    src: 'jalan-cipularang.jpg',
    subject: 'Jalan Cipularang',
    credit: 'Dari: Gunnar Pingel / Pexels (CC BY 2.0)',
  },
  jalanMalamKota: {
    src: 'jalan-malam-kota.jpg',
    subject: 'Malam di perkotaan',
    credit: 'Dari: George Schnell / Pexels (CC BY 2.0)',
  },
  jalanPuncak: {
    src: 'jalan-puncak.jpg',
    subject: 'Jalan di puncak pegunungan',
    credit: 'Dari: Andrew Coelho / Pexels (CC BY 2.0)',
  },
  kotaBandung: {
    src: 'kota-bandung.jpg',
    subject: 'Kota Bandung',
    credit: 'Dari: Yogi Suryana / Pexels (CC BY 2.0)',
  },
  kotaBandungBus: {
    src: 'kota-bandung-bus.jpg',
    subject: 'Bus di Bandung',
    credit: 'Dari: Joscha Blobal / Pexels (CC BY 2.0)',
  },
  kotaSolo: {
    src: 'kota-solo.jpg',
    subject: 'Kota Solo',
    credit: 'Dari: Samir Patel / Pexels (CC BY 2.0)',
  },
  kotaSoloKeraton: {
    src: 'kota-solo-keraton.jpg',
    subject: 'Keraton dan Kota Solo',
    credit: 'Dari: Matteo Caricato / Pexels (CC BY 2.0)',
  },
  kotaSurabaya: {
    src: 'kota-surabaya.jpg',
    subject: 'Kota Surabaya',
    credit: 'Dari: Hiroshi Gono / Pexels (CC BY 2.0)',
  },
  poolArmada: {
    src: 'pool-armada.jpg',
    subject: 'Pool armada Jokam Trans',
    credit: 'Dari: Maciej Leszczyński / Pexels (CC BY 2.0)',
  },
  terminalGiwangan: {
    src: 'terminal-giwangan.jpg',
    subject: 'Terminal Pulo Gebang',
    credit: 'Dari: David McSpadden / Pexels (CC BY 2.0)',
  },
  terminalPeron: {
    src: 'terminal-peron.jpg',
    subject: 'Peron keberangkatan',
    credit: 'Dari: Andrii Popov / Pexels (CC BY 2.0)',
  },
  loketTiket: {
    src: 'loket-tiket.jpg',
    subject: 'Loket penjualan tiket',
    credit: 'Dari: Frans Van Lier / Pexels (CC BY 2.0)',
  },
}

export const PHOTO_NOTICE = 'Ilustrasi suasana — bukan unit Jokam Trans.'

export const CLASS_PHOTO = {
  Ekonomi: 'interiorExecutive',
  Eksekutif: 'interiorFirstClass',
  'Executive Plus': 'interiorSuperTop',
  VIP: 'interiorSuperTop',
  Sleeper: 'interiorFirstClass',
}

export const CITY_PHOTO = {
  Jakarta: 'kotaBandung',
  Bandung: 'kotaBandung',
  Cirebon: 'kotaSolo',
  Semarang: 'kotaSolo',
  Solo: 'kotaSolo',
  Yogyakarta: 'kotaSoloKeraton',
  Surabaya: 'kotaSurabaya',
  Malang: 'kotaBandungBus',
  Purwokerto: 'kotaBandung',
  Banyuwangi: 'kotaSurabaya',
}

export const GALLERY = [
  'heroJalanTol',
  'interiorExecutive',
  'armadaAntarKota',
  'jalanCipularang',
  'poolArmada',
  'terminalPeron',
  'kotaBandung',
  'jalanPuncak',
]

export const PHOTO_SLOTS = Object.keys(PHOTOS)

export function photoOf(key) {
  return PHOTOS[key] ?? PHOTOS.heroJalanTol
}

export function photoSrc(key) {
  return `/photos/${photoOf(key).src}`
}
