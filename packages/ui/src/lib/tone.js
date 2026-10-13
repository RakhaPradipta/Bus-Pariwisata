/**
 * Pemetaan warna.
 *
 * Tema memakai TIGA warna saja: hitam (kanvas), hijau pinus (merek), dan
 * limau (aksen aksi). Karena itu kelas armada tidak lagi dibedakan warna —
 * semuanya hijau — dan perbedaannya diungkapkan lewat denah kursi, jumlah
 * kursi, dan fasilitas. Nada bergilir juga hanya berselang hijau dan limau.
 */

export const CLASS_TONE = {
  Ekonomi: 'tone-ink',
  Eksekutif: 'tone-pine',
  VIP: 'tone-pine',
  'Executive Plus': 'tone-pine',
  Sleeper: 'tone-lime',
}

export const toneCycle = (index) => `tone-cycle-${(index % 2) + 1}`
