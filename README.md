# 🚌 PO Bus 27 Trans — Aplikasi Pemesanan Tiket Bus

Aplikasi web fullstack untuk perusahaan otobus **27 Trans**: situs publik untuk
mencari jadwal dan memesan tiket, plus panel admin untuk mengelola jadwal dan
memantau pemesanan.

Dibangun tanpa layanan pihak ketiga — database SQLite dan API berjalan lokal di
mesin Anda.

---

## ✨ Fitur

### Sisi publik
- **Pencarian jadwal** berdasarkan kota asal, tujuan, dan tanggal (jadwal tersedia 45 hari ke depan).
- **Rute populer** dan daftar seluruh rute aktif.
- **Halaman detail trayek** (`/trayek/asal/tujuan`) — tarif dasar, jarak, waktu tempuh, armada yang bertugas, dan seluruh keberangkatan pada hari yang dipilih (hari ini / besok / lusa atau tanggal lain sampai 45 hari ke depan). Bisa dibuka dari linimap jaringan, papan tarif, kartu rute, maupun kolom "Detail" pada tabel trayek. Trayek yang tidak dilayani tetap menampilkan trayek nyata dari kota asal sebagai jalan keluar.
- **Peta kursi interaktif** sesuai layout asli tiap armada (termasuk posisi lorong).
- **Alur pemesanan 3 langkah**: pilih kursi → data penumpang → konfirmasi.
- **E-tiket digital** dengan kode pemesanan, siap dicetak (Ctrl/Cmd + P).
- **Lacak tiket** lewat kode pemesanan + riwayat pemesanan lokal di perangkat.
- Validasi ketersediaan kursi secara langsung — kursi yang baru saja dipesan orang lain akan ditolak (HTTP 409).

### Asisten "Tanya 27"
- **Bahasa sehari-hari jadi pencarian**: "besok dari Bandung ke Semarang untuk 2 orang" → langsung jadi kartu jadwal asli.
- **Bisa bertindak**, bukan hanya menjawab: mengisi pencarian, menyarankan kursi, membuka e-tiket, menautkan ke pemesanan.
- **Penyelamat hasil kosong**: rute yang tidak tersedia ditawarkan alternatif nyata (tujuan lain, kota asal lain, atau transit 1 kali) lengkap dengan jam sambungan yang benar-benar bisa ditempuh.
- **Penilai kursi deterministik**: skor posisi kursi (jendela, lorong, baris depan/belakang) — dihitung, bukan ditebak model. Bila keberangkatan paling awal sudah penuh, asisten otomatis pindah ke keberangkatan terdekat yang masih ada kursi dan menyebutkannya.
- Berjalan **tanpa kunci API**; kunci model hanya menambah kemampuan memparafrase kalimat.

### Panel admin
- Login dengan sesi ber-token (password di-hash memakai `scrypt` + salt).
- **Dashboard**: total pemesanan, pendapatan, kursi terjual, rute terlaris.
- **Kelola jadwal**: tambah, ubah harga/waktu, dan hapus jadwal (jadwal yang sudah
  dipesan otomatis dilindungi dari penghapusan).
- **Pemesanan**: filter per tanggal/status, lihat detail penumpang, batalkan pemesanan.

---

## 🧱 Teknologi

| Lapisan | Pilihan |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7, Framer Motion, CSS kustom |
| Backend | Node.js + Express 5 |
| Database | `node:sqlite` (modul bawaan Node — tanpa kompilasi native) |
| Auth | `node:crypto` scrypt + tabel sesi ber-token |
| Validasi & tes | ESLint 10 + smoke test end-to-end bawaan |
| Asisten | NLU berbasis aturan + LLM opsional (OpenAI-compatible, tanpa dependency tambahan) |

> **Prasyarat:** Node.js **22.5 atau lebih baru** (dibutuhkan modul `node:sqlite`).
> Proyek ini dikembangkan dan diuji pada Node 24.

---

## 🤖 Asisten "Tanya 27"

Asisten ini sengaja dibuat **bertingkat**, bukan chatbot yang menebak-nebak.

```
pesan penumpang
   │
   ├─ 1. nlu.js       → niat + slot (kota, tanggal, jumlah orang, kelas, kode tiket)
   │                     berbasis aturan: gratis, instan, bisa diuji
   ├─ 2. queries.js   → data diambil dari database (jadwal, harga, kursi, alternatif)
   ├─ 3. knowledge.js → kebijakan dijawab dari basis pengetahuan resmi
   └─ 4. provider.js  → OPSIONAL: model hanya memparafrase kalimat
```

**Aturan yang tidak boleh dilanggar:** semua angka, harga, jadwal, nomor kursi, dan
kebijakan berasal dari database atau `knowledge.js`. Model bahasa tidak pernah
diminta menghitung ulang — ia hanya merapikan kalimat dari fakta yang sudah benar.
Pertanyaan di luar basis pengetahuan dijawab dengan jujur "saya tidak tahu" dan
diarahkan ke layanan pelanggan, bukan dikarang.

| Modul | Peran |
| --- | --- |
| `server/ai/nlu.js` | Pemahaman Bahasa Indonesia berbasis aturan: sinonim kota (jogja, sby, jkt), salah ketik, tanggal (besok/lusa/tanggal 25/senin), jumlah penumpang (berdua, 3 orang), kelas, kode tiket |
| `server/ai/knowledge.js` | Satu-satunya sumber kebijakan perusahaan (bagasi 20 kg, pembatalan 25%, jam layanan) + pencocokan FAQ |
| `server/ai/chat.js` | Orkestrator: menyusun balasan deterministik, mengelola sesi & konteks, membatasi laju, endpoint SSE |
| `server/ai/provider.js` | Adaptor LLM opsional (OpenAI-compatible, `fetch` bawaan, ada batas waktu & jatuh-balik aman) |
| `server/queries.js` | Query bersama API + asisten, termasuk pencari rute alternatif dan penilai kursi |

### Mengaktifkan mode AI (opsional)

Tanpa konfigurasi, asisten memakai **mode aturan** dan seluruh fitur tetap jalan.
Untuk menghidupkan parafrase alami, set variabel lingkungan berikut sebelum menjalankan server:

```bash
AI_API_KEY=isi-kunci-anda          # wajib untuk mode AI
AI_BASE_URL=https://api.openai.com/v1   # opsional (default)
AI_MODEL=gpt-4o-mini               # opsional (default)
```

Karena bentuk API-nya OpenAI-compatible, penyedia lain cukup diganti lewat dua variabel:

| Penyedia | `AI_BASE_URL` |
| --- | --- |
| OpenRouter | `https://openrouter.ai/api/v1` |
| Groq | `https://api.groq.com/openai/v1` |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` |
| Ollama (lokal, tanpa biaya) | `http://localhost:11434/v1` |

Kunci API **hanya** dipakai di sisi server dan tidak pernah dikirim ke browser.
Status mode aktif bisa dilihat di `GET /api/assistant/info` dan tampil pada panel asisten.

### Batas penggunaan

- Maksimal 30 pesan per 5 menit per alamat IP (`AI_RATE_LIMIT`).
- Panjang pesan maksimal 500 karakter.
- Setiap percakapan dicatat di tabel `chat_logs` (sesi, niat, mode) untuk pemantauan.
- Konteks percakapan disimpan 30 menit dan tidak dibagikan antar sesi.

---

## 🎨 Sistem desain

Arah visual: **“Panggung Malam”** — tema gelap sinematik dengan foto sebagai
bintang utama. Acuan visual yang dipakai adalah **Cinejoy** (cinejoy.pk): kanvas
nyaris hitam `#050505`, teks putih berlapis alfa, garis rambut putih tipis,
radius membulat sampai pil, dan deretan kartu foto yang digeser mendatar.
Perbedaan yang sengaja dijaga: aksen di sini **limau `#95FF50`** (bukan hijau
terang acuan).

### Palet sengaja dibatasi: TIGA warna

Seluruh tema hanya memakai tiga warna yang saling menyambung — **hitam**,
**hijau pinus**, dan **limau**. Tidak ada warna pendukung lain:

| Warna | Peran |
| --- | --- |
| Hitam `#050505` + abu netral | Kanvas, kartu, garis rambut, teks putih/abu |
| Hijau pinus `#0c3c2c` … `#3f8266` | Identitas merek: header, footer, blok gelap, batang jalur, chip kelas |
| Limau `#95FF50` (turunannya `#b2ff6e`, `#6fd92c`) | Aksi & sorotan: tombol utama, harga, kursi terpilih, judul bagian, garis kemajuan |

Konsekuensinya: kelas armada (Ekonomi/Eksekutif/VIP/Sleeper) **tidak lagi
dibedakan warna** — semuanya hijau, dan perbedaannya diungkapkan lewat denah
kursi, jumlah kursi, dan fasilitas. Daftar panjang berselang dua nada saja:
`tone-pine` dan `tone-lime` (`toneCycle` di `src/lib/tone.js`). Status sukses/
bahaya tetap ada di formulir karena fungsional, bukan dekorasi.

Ciri acuan yang diambil: warna rata tanpa gradasi dekoratif, tanpa efek kaca,
tanpa pola latar dekoratif, dan bayangan dalam yang lembut (bukan plat padat,
karena plat hitam tidak terlihat di kanvas hitam).

| Aspek | Ketentuan |
| --- | --- |
| Kanvas | Nyaris hitam `#050505`; kartu memakai `#0e0e11` / `#17171b`, permukaan terangkat `#1e1e24` (`--surface-raised`) |
| Tinta & aksen | Teks putih berlapis alfa: isi `#cbcbd4`, redup `#a9a9b4`, judul `#ffffff`; aksen limau `#95FF50` (`--accent-400`) untuk aksi utama dan sorotan |
| Identitas | Hijau pinus warna merek pada bidang solid (header, footer, blok gelap): `#082c20` / `#0c3c2c`; hijau terang `#86ddb2` (`--tint-fg`) untuk teks di atas bidang hijau lembut |
| Tipografi | **Inter** untuk teks isi; **Montserrat** untuk judul & label; **IBM Plex Mono** untuk papan keberangkatan, jam, kode tiket, dan tarif |
| Permukaan | Radius 6–30px dengan elemen kecil berbentuk pil (`--r-full`), garis rambut putih `rgba(255,255,255,.10–.24)`, dan bayangan dalam `0 10px 28px rgba(0,0,0,.55)` yang menguat saat hover |
| Foto | 20 berkas di `public/photos/`, seluruhnya lisensi bebas (CC BY / CC BY-SA / CC0) dan selalu tampil sebagai **ilustrasi suasana** dengan penanda “Ilustrasi” + kredit pembuatnya |
| Motif khas | Pita lambung tiga warna di tepi header, papan tarif gelap berhuruf limau, kartu jadwal, perforasi tiket, dan deretan poster foto |

### Foto (`src/lib/photos.js`, `src/components/Photo.jsx`, `src/styles/photos.css`)

Foto adalah lapisan yang paling menentukan tampilan, jadi aturannya ditulis
jelas supaya tidak melenceng:

| Hal | Ketentuan |
| --- | --- |
| Sumber berkas | `public/photos/<slot>.jpg`, satu slot satu berkas. Mengganti foto = menimpa berkasnya, tanpa menyentuh kode |
| Katalog | `src/lib/photos.js` menyimpan subjek, teks alternatif, pembuat, lisensi, dan URL sumber tiap foto |
| Kejujuran | Semua foto berlisensi bebas dan **bukan unit 27 Trans**; karena itu setiap foto memakai penanda “Ilustrasi” (`PhotoFlag`) dan kredit (`PhotoCredit`), dan tidak pernah dipakai untuk menegaskan angka apa pun |
| Kredit | Daftar lengkap di `public/photos/CREDITS.md` dan di panel “Kredit & lisensi foto” pada kaki halaman (memenuhi kewajiban CC BY / CC BY-SA) |
| Bingkai | `.photo` memakai `aspect-ratio` dari `--photo-ratio`, jadi tata letak tidak bergeser saat gambar selesai dimuat |
| Kartu poster | `.poster` — foto + keterangan di bawahnya; seluruh kartu bisa jadi tautan, tetapi kredit sengaja diletakkan **di luar** tautan karena tautan di dalam tautan bukan HTML yang sah |
| Baris poster | `.poster-row` — deretan mendatar tanpa scrollbar terlihat, digeser dengan tombol (mengikuti `prefers-reduced-motion`) atau usapan jari |
| Galeri | `.gallery` — kisi rapat dengan sel lebar bergantian supaya iramanya tidak monoton |
| Latar hero | `.hero__media` + selubung rata `rgba(5,5,5,.62)`; foto hero dilewati di bawah 640px agar tidak boros kuota |

### Motif terminal (`src/styles/motifs.css`)

Bahasa visual yang diambil dari benda nyata di terminal dan di lambung bus:

| Motif | Dipakai di |
| --- | --- |
| **Kartu trayek** (`.route-grid`, varian `poster--overlay`) | Bagian trayek beranda: satu kartu foto per trayek dengan lencana tarif, statistik dari database, dan aksi Detail/Pesan |
| **Plat nomor lambung** (`.plate`) | Tabel armada, kartu jadwal, ringkasan pemesanan, kepala & isi e-tiket — selalu bernilai nomor polisi asli dari database |
| **Penanda jarak** (`.road` + `.road__km`) | Jalur asal → tujuan pada kartu jadwal, ringkasan pemesanan, dan peta kursi: badan jalan dengan label jarak tematik |
| **Papan informasi berjalan** (`.ticker`) | Di bawah hero, berisi tarif trayek aktif; berhenti berjalan dan bisa digeser di layar kecil atau saat pengguna memilih animasi minim |
| **Linimap jaringan** (`.network`) | Diagram antarkota beranda: kota diurutkan menurut jumlah trayek, kota pusat ditandai titik penuh |
| **Papan armada** (`.fleet-banner`) | Foto suasana pool berdampingan dengan angka armada yang dihitung dari database, plus legenda kelas yang sekaligus menyaring daftar |
| **Denah kursi mini** (`.floorplan`) | Barisan armada di beranda: satu kotak per kursi mengikuti `seat_rows`/`seat_cols` dan posisi lorong unit aslinya, jadi susunan tiap kelas terbaca sebelum memesan |
| **Stempel loket** (`.stamp`) | Status e-tiket: `Lunas` atau `Dibatalkan` |
| **Barcode tiket** (`Barcode`) | Pola batang pada stub e-tiket, diturunkan deterministik dari kode pemesanan |
| **Jalur langkah** (`.stepper--route`) | Indikator tiga langkah pemesanan digambar sebagai jalur dengan titik pemberhentian |
| **Loket lacak** (`.loket`) | Halaman lacak tiket: papan gelap dengan formulir menempel di bawahnya |
| **Papan trayek kosong** (`.trayek-void`) | Halaman 404, dijelaskan sebagai trayek yang tidak dilayani |
| **Papan trayek** (`.trayek-hero`) | Halaman detail trayek: bidang gelap, tepi atas berwarna sesuai trayek, jalan dengan penanda jarak, dan empat angka utama (jarak, waktu, tarif, jumlah keberangkatan hari itu) |
| **Papan loket footer** (`.footer-board`) | Status loket hidup (dihitung dari jam WIB saat ini), tanggal & jam layanan, plus tarif rute terlaris dari database — semuanya bisa diklik |
| **Jalur pemberhentian** (`.boarding-line`) | Alur pemesanan empat langkah di beranda: tiap langkah jadi halte bernomor di sepanjang satu jalur putus-putus, berbelok menjadi rel tegak di layar kecil |
| **Panel bantuan & nomor FAQ** (`.faq-help`, `.accordion__index`) | Dua jalur bantuan (telepon loket, asisten) dan nomor urut pertanyaan supaya mudah disebut saat menelepon |

### Warna pendukung & interaksi (`src/styles/play.css`)

Hijau pinus dan limau adalah satu-satunya warna. Keduanya dipakai **dengan
arti**, bukan sebagai dekorasi acak. Setiap nada punya tiga peran:
`-` (hue pekat untuk garis dan titik), `-soft` (bidang gelap), dan `-ink`
(teks terang di atas bidang tersebut).

| Warna | Arti |
| --- | --- |
| Hijau pinus (`--brand-*`, nada `tone-pine`) | Identitas, bidang solid, chip kelas, batang jalur, kartu armada |
| Limau (`--accent-400`, nada `tone-lime`) | Aksi & sorotan: tombol utama, harga, kursi terpilih, chip tanggal aktif, garis kemajuan baca |

Pemetaan kelas armada → warna ada di `src/lib/tone.js` supaya chip filter,
kartu jadwal, ringkasan pemesanan, dan barisan armada selalu sewarna.

Interaksi yang tersedia di seluruh halaman:

- **Masuk layar** — blok besar muncul naik (`Reveal`), angka statistik dihitung
  naik dari nol (`CountUp`), keduanya berhenti bila pengguna memilih animasi minim.
- **Header** — garis kemajuan baca di tepi atas mengikuti panjang halaman yang
  sudah digulir, bayangan muncul setelah halaman bergerak, dan menu seluler
  memuat pintasan bagian beranda serta bisa digulir di layar pendek.
- **Tautan bagian** (`/#trayek`, `/#armada`, `/#faq`) — mendarat tepat di
  bagiannya, baik diklik di halaman maupun saat URL dibuka langsung dengan hash;
  tinggi header diperhitungkan supaya judul tidak tertutup.
- **Statistik hero** — tiap angka menuju bagian yang dijelaskannya.
- **Kartu melayang** — papan tarif dan e-tiket miring halus mengikuti arah kursor (`Tilt`).
- **Kartu jadwal** — tekan "Rincian kursi & fasilitas" untuk membuka susunan
  kursi, kebijakan pembatalan, dan daftar fasilitas lengkap.
- **Kebijakan ringkas** — tiap butir (bagasi, pembatalan, jam datang, jumlah
  kursi) dibuka untuk menampilkan jawaban resminya; teksnya diambil dari daftar
  FAQ yang sama sehingga tidak ada dua versi aturan.
- **Baris poster kota** — di bagian trayek, kartu foto tiap kota digeser dengan
tombol panah atau usapan; tiap kartu menuju detail trayek yang benar-benar
melayani kota itu, dan memuat jumlah trayek serta tarif dari database.
- **Galeri suasana** — kisi foto berirama dengan keterangan dan kredit, ditutup
daftar kredit lengkap yang bisa dibuka.
- **Poster rute** — halaman pencarian tanpa kueri menampilkan rute paling dicari
sebagai kartu foto kota.
- **Pintasan jam** — pada halaman hasil pencarian dan detail trayek, jam
keberangkatan hari itu tampil sebagai pil yang bisa ditekan untuk langsung
dituju ke kartu jadwalnya.
- **Foto kabin kelas** — saat memilih kursi, pita suasana kabin kelas yang
dipesan tampil di bawah peta kursi (ilustrasi berlisensi, bukan unit).
- **Pita foto e-tiket** — kepala e-tiket memakai foto suasana kota asal yang
diredupkan, sehingga kode dan plat tetap terbaca.
- **Foto loket lacak** — halaman lacak menampilkan foto loket di samping papan
kodenya, lengkap dengan kredit.
- **Kursi terpilih limau** — kursi yang dipilih pada peta menjadi isian limau
tunggal, mudah dibedakan dari semua kursi lain.
- **Linimap jaringan** — tekan nama kota untuk menyaring daftar trayek; tekan lagi untuk kembali.
- **Barisan armada** — legenda warna kelas menyaring armada, dan tiap kartu
  kelas dibuka untuk melihat plat nomor serta daftar fasilitasnya.
- **Kartu trayek** — bagian trayek beranda kini berupa kisi kartu foto (bukan
  tabel): foto kota asal/tujuan, lencana tarif dari database, jumlah
  keberangkatan, jarak, waktu tempuh, dan batang panjang jalur relatif
  terhadap trayek terjauh. Tiap kartu punya dua aksi: Detail dan Pesan.
- **Cari & urutkan trayek** — kotak pencarian kota dan chip pengurutan (jarak,
  waktu tempuh, jumlah jadwal, tarif dasar) menggantikan kepala tabel;
  penghitung “x dari y trayek” tetap ada.
- **Peta kursi** — kursi terangkat saat disorot dan memantul saat dipilih.
- **Bar aksi lengket** — di layar kecil, kursi terpilih dan total bayar selalu terlihat.
- **Papan informasi** — berhenti bergulir saat disorot.
- **E-tiket** — stempel loket membesar saat disorot, barcode menegak, langkah
  pemesanan digambar sebagai jalur dengan titik pemberhentian.

Prinsip yang dijaga: **tidak ada angka pemasaran karangan**. Semua angka di
beranda (jumlah rute, kota, armada, tarif, kapasitas kursi, kebijakan bagasi)
berasal dari database atau `server/ai/knowledge.js`. Motif di atas juga
mengikuti aturan itu — plat nomor, kode tiket, jarak, dan barcode semuanya
diturunkan dari data nyata, bukan contoh.

Pembangun tautan (detail trayek, pencarian, pemesanan) dikumpulkan di
`src/lib/paths.js` supaya format URL tidak ditulis ulang di banyak komponen.

Token terpusat di `src/styles/tokens.css` — ubah di satu tempat, seluruh
halaman ikut berubah. Dua lapis peran penting di dalamnya:

- Tangga `--ink-50 … --ink-900` menghadap gelap, jadi `50` adalah kanvas dan
  `900` adalah cahaya paling terang. Karena itu setiap
  `border: 1px solid var(--ink-900)` yang lama otomatis menjadi garis rambut
  putih, dan `--text` maupun `--heading` ikut terang tanpa pengecualian.
- Dua pasangan peran memisahkan warna yang tidak boleh tertukar:
  `--tint` / `--tint-fg` untuk “bidang gelap + teks terang”, dan
  `--on-accent` untuk “isian terang + teks gelap”. Elemen yang dulu
  “chip gelap + teks putih” kini memakai `--plate-bg`.

Modul CSS lain: `primitives.css` (tombol, form, kartu, akordeon), `layout.css`
(header, hero, papan tarif, footer), `features.css` (pencarian, jadwal, kursi,
tiket), `motifs.css` (motif terminal di atas), `photos.css` (foto, poster, galeri,
kredit), `assistant.css`, `admin.css`, dan `play.css` (warna pendukung +
interaksi, dimuat paling akhir). Helper gerak bersama ada di
`src/components/Motion.jsx`.

### Cuplikan tampilan

Folder `design-preview/` berisi tangkapan layar dari build lama dan sudah
tidak mewakili tampilan sekarang (masih tema terang tanpa foto). Folder ini
hanya untuk arsip dan boleh dihapus kapan saja.

---

## 🚀 Menjalankan

```bash
cd po-bus-27-Trans-app
npm install
npm run dev            # menjalankan API (port 4000) + Vite sekaligus
```

Buka alamat yang tercetak di terminal (biasanya **http://localhost:5173**).

> `npm run dev` sengaja menyalakan **API dan frontend sekaligus**. Bila hanya
> frontend yang jalan, halaman tetap terbuka tetapi daftar kota, jadwal, dan
> tarif akan kosong. Bila API mati, sekarang muncul pita peringatan di atas
> halaman beserta tombol *coba lagi*.

Database akan dibuat otomatis dan diisi data contoh saat server pertama kali
dijalankan (18 rute, 5 armada, ±2.400 jadwal, 24 pemesanan contoh).

### Akun admin default

| Username | Password |
| --- | --- |
| `admin` | `admin123` |

Panel admin: **http://localhost:5173/admin**

> Ganti password default lewat `POST /api/admin/password`, atau set
> `ADMIN_USERNAME` / `ADMIN_PASSWORD` sebelum seeding pertama.

---

## 📜 Skrip

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Jalankan API + frontend sekaligus (pakai ini untuk ngoding) |
| `npm run server:watch` | Hanya API, restart otomatis saat berkas server berubah |
| `npm run server` | Hanya API server (port 4000), tanpa auto-restart |
| `npm run web` | Hanya frontend Vite (proxy `/api` → 4000) |
| `npm run build` | Build produksi ke `dist/` |
| `npm start` | Jalankan API + layani hasil build dari satu port |
| `npm run smoke` | Smoke test end-to-end seluruh endpoint API |
| `npm run seed:reset` | Hapus semua data lalu isi ulang data contoh |
| `npm run lint` | Periksa kualitas kode |

### Bila API tidak mau jalan

| Gejala | Penyebab & jalan keluar |
| --- | --- |
| `Port 4000 sedang dipakai proses lain` | Ada server lama yang belum ditutup. Tutup proses tersebut, atau jalankan `PORT=4001 npm run server` dan `API_PORT=4001 npm run web` |
| Halaman terbuka tetapi data kosong | Frontend jalan tanpa API. Jalankan `npm run dev`, lalu tekan **Coba lagi** pada pita peringatan di atas halaman |
| Vite memakai port 5174/5175 | Port 5173 sudah dipakai proyek lain di mesin Anda. Buka alamat yang tercetak di terminal, atau set `WEB_PORT` |

### Mode produksi

```bash
npm run build && npm start     # buka http://localhost:4000
```

Saat folder `dist/` ada, Express otomatis melayani berkas statis dan menerapkan
SPA fallback, sehingga satu server cukup untuk aplikasi + API.

### Demo statis di Vercel (tanpa server)

Vercel hanya hosting file statis, sedangkan API butuh SQLite yang tidak
tersedia di sana. Untuk demo, beranda otomatis memakai data contoh
(`packages/ui/src/lib/demoData.js` — rute, armada, dan jadwal yang sama
dengan `server/seed.js`) begitu `/api` tidak terjangkau. Tampilan tidak
berubah; pemesanan, admin, dan asisten tetap butuh `npm run server`.

```bash
npm run build                # hasil di dist/
```

Di Vercel: **Add New → Project → import repo**, Root Directory
`po-bus-27-Trans-app`, Framework Preset `Vite` (build `npm run build`,
output `dist/` sudah tertulis di `vercel.json`). Opsional: set env
`VITE_DEMO=1` agar build langsung mode demo tanpa mencoba `/api` dulu.

---

## 📂 Struktur proyek

```
po-bus-27-Trans-app/
├── index.html
├── vite.config.js            # proxy /api → localhost:4000
├── server/                   # --- Backend ---
│   ├── index.js              # definisi seluruh endpoint Express
│   ├── queries.js            # query bersama: jadwal, alternatif rute, skor kursi
│   ├── db.js                 # koneksi + skema database
│   ├── seed.js               # data contoh & reset
│   ├── seatmap.js            # logika tata letak kursi
│   ├── auth.js               # hashing password + middleware sesi
│   ├── smoke-test.js         # tes end-to-end
│   ├── ai/                   # asisten: nlu, knowledge, chat, provider
│   └── data/app.db           # database (dibuat otomatis, tidak di-commit)
├── public/photos/            # 20 foto suasana (JPG) + CREDITS.md
└── src/                      # --- Frontend ---
    ├── main.jsx              # entry: Router + AuthProvider
    ├── App.jsx               # daftar rute halaman
    ├── styles/               # tokens, primitives, layout, features, motifs,
    │                         # photos, admin, play
    ├── lib/                  # api client, formatter, riwayat, fasilitas,
    │                         # katalog foto (photos.js), pembangun URL
    ├── hooks/                # useAsync, useAuth
    ├── components/           # Navbar, SearchForm, SeatMap, ScheduleCard,
    │                         # DepartureBoard, ApiStatus, AssistantDock, Photo, Icons, …
    └── pages/
        ├── Home, ScheduleSearch, Booking, Ticket, Track, NotFound
        └── admin/            # Login, AdminLayout, Dashboard, Schedules, Bookings
```

---

## 🗄️ Model data

```
routes     (id, origin, destination, distance_km, duration_minutes, base_price)
buses      (id, name, plate, class, seat_rows, seat_cols, aisle_after, facilities, is_active)
schedules  (id, route_id → routes, bus_id → buses, departure_time, arrival_time, price, is_active)
bookings   (id, code, schedule_id → schedules, contact_name/phone/email, total_price, status)
booking_seats (id, booking_id → bookings, seat_number, passenger_name, passenger_phone)
admins     (id, username, password_hash, name)
sessions   (token, admin_id → admins, expires_at)
chat_logs  (id, session_id, role, content, intent, mode, created_at)
```

Nomor kursi dihitung baris-per-baris dari dimensi bus, jadi tidak ada nomor kursi
yang di-*hardcode* di sisi klien. Waktu disimpan sebagai string lokal
`YYYY-MM-DD HH:mm` agar bebas dari pergeseran zona waktu.

---

## 🔌 Ringkasan API

### Publik
| Metode | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/api/health` | Status layanan |
| GET | `/api/cities` | Daftar kota asal & tujuan |
| GET | `/api/routes` | Semua rute aktif |
| GET | `/api/routes/popular` | Rute terpopuler untuk beranda |
| GET | `/api/fleet` | Daftar armada publik |
| GET | `/api/schedules` | Cari jadwal (`origin`, `destination`, `date`, `busClass`) |
| GET | `/api/schedules/:id` | Detail jadwal + peta kursi + kursi terisi |
| POST | `/api/bookings` | Buat pemesanan |
| GET | `/api/bookings/:code` | Ambil e-tiket berdasarkan kode |
| GET | `/api/routes/alternatives` | Perjalanan pengganti saat rute tidak tersedia (`origin`, `destination`, `date`) |
| GET | `/api/assistant/info` | Mode asisten (aturan/AI) + daftar kemampuan |
| POST | `/api/chat` | Percakapan asisten, dibalas dengan Server-Sent Events (`message`, `sessionId`) |

### Admin (butuh header `Authorization: Bearer <token>`)
| Metode | Endpoint | Keterangan |
| --- | --- | --- |
| POST | `/api/admin/login` | Login, mengembalikan token |
| POST | `/api/admin/logout` | Akhiri sesi |
| GET | `/api/admin/me` | Profil admin aktif |
| GET | `/api/admin/stats` | Statistik dashboard |
| GET | `/api/admin/routes` · `/api/admin/buses` | Data referensi |
| GET · POST | `/api/admin/schedules` | Daftar & tambah jadwal |
| PUT · DELETE | `/api/admin/schedules/:id` | Ubah & hapus jadwal |
| GET | `/api/admin/bookings` | Daftar pemesanan (filter `date`, `scheduleId`) |
| PATCH | `/api/admin/bookings/:id` | Ubah status (`paid` / `cancelled`) |
| POST | `/api/admin/password` | Ganti password admin |

---

## ✅ Verifikasi

```bash
npm run lint     # 0 error
npm run smoke    # 34 pemeriksaan alur end-to-end (termasuk 12 pemeriksaan asisten)
npm run build    # build produksi
```

Pemeriksaan tampilan terakhir (Chrome headless, dijalankan sekali lalu skripnya
dihapus):

| Pemeriksaan | Hasil |
| --- | --- |
| Foto termuat di beranda | 30/30 berkas, tidak ada gambar rusak |
| Galat konsol | 0 di seluruh halaman (beranda, rute, detail trayek, lacak, admin, 404) |
| Gulir mendatar | 0 pada 360 / 414 / 560 / 680 / 768 / 940 / 1024 / 1180 / 1440 px |
| Kontras teks (WCAG AA) | 0 temuan, di seluruh halaman **dan** pada keadaan interaktif: e-tiket, peta kursi setelah kursi dipilih, menu seluler terbuka, akordeon terbuka, panel asisten |
| Tombol geser baris poster | Memindahkan baris (0 → 268px) pada jalur animasi minim |
| Sisa ilustrasi bus SVG (`.bus-profile`) | 0 — sudah dihapus seluruhnya |

---

## 📝 Catatan

- `node:sqlite` masih ditandai *experimental* oleh Node, sehingga skrip server
  dijalankan dengan flag `--disable-warning=ExperimentalWarning`. Pemakaiannya
  stabil untuk aplikasi ini dan menghindari kebutuhan compiler C++ native.
- Hapus `server/data/` untuk memulai database dari nol, lalu jalankan
  `npm run seed:reset`.
- Pembayaran pada alur pemesanan masih disimulasikan (pemesanan langsung
  berstatus `paid`) — titik integrasi payment gateway ada di
  `POST /api/bookings`.
