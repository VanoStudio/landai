# landai — Peta Aksesibilitas Difabel Kota

Web crowdmap yang memberi tahu orang apakah sebuah tempat umum bisa mereka akses, sebelum mereka pergi ke sana.

**ITechno Cup 2026 — Web Development**
Subtema: Smart Sustainable Digital Solution for Inclusive Society
Mendukung SDG 11: Kota dan Komunitas Berkelanjutan

> **Link demo:** _belum di-deploy, isi di sini setelah deploy ke Vercel._

---

## Tim

| Nama | Peran |
|---|---|
| Vano | Pengembang |
| Husein | Survei lapangan |
| Dakara | Riset kriteria dan konten dampak |

## Masalah

Belum ada sumber informasi terpercaya soal kondisi aksesibilitas tempat umum di Indonesia. Penyandang disabilitas, lansia, dan orang tua dengan stroller sering baru tahu sebuah tempat tidak ramah akses setelah tiba di sana, saat pulang bukan lagi pilihan yang murah.

Google Maps dan aplikasi peta sejenis menyimpan lokasi dan jam buka. Keduanya tidak menyimpan apakah rampnya ada, apakah guiding block-nya tersambung, apakah liftnya benar-benar menyala.

## Solusi

Warga menandai lokasi di peta, mengisi checklist delapan fasilitas aksesibilitas, dan mengambil foto langsung di tempat. Hasilnya jadi peta interaktif dengan skor aksesibilitas per lokasi yang bisa disaring menurut kebutuhan: kursi roda, tunanetra, atau lansia dan stroller.

Data yang belum dikonfirmasi warga lain tetap tampil, tapi menandai dirinya berbeda. Kejujuran soal tingkat keyakinan data adalah bagian dari produknya.

## Fitur

- **Peta penuh layar** dengan penanda berwarna sesuai skor. Hijau ramah akses, amber sebagian, merah belum ramah.
- **Filter tiga kategori kebutuhan.** Beberapa filter aktif berarti lokasi harus memenuhi semuanya.
- **Mode lihat tanpa akun.** Mencari informasi tidak butuh mendaftar.
- **Tambah lokasi empat langkah:** cari nama tempat lewat geocoding, ambil koordinat GPS perangkat, koreksi manual dengan menggeser pin, isi checklist, ambil foto lewat kamera.
- **Skor otomatis.** Dihitung trigger database dari checklist, bukan diisi manusia, jadi tidak bisa dimanipulasi lewat form.
- **Halaman detail** berisi foto, skor, rincian delapan fasilitas, catatan kontributor, dan jejak siapa yang menambahkan kapan.
- **Konfirmasi akurasi warga.** Tiga konfirmasi akurat menaikkan status lokasi jadi terverifikasi.

## Menjaga kualitas data

Ini bukan sistem anti-fraud berat, tapi cukup untuk menjawab pertanyaan soal validitas:

- Foto diambil langsung lewat kamera perangkat (`capture="environment"`), bukan dipilih dari galeri.
- Setiap lokasi mencatat kontributor dan waktunya.
- Warga lain yang pernah ke lokasi yang sama bisa menyatakan datanya masih akurat atau sudah berubah.
- Row Level Security di Postgres membatasi checklist sebuah lokasi hanya bisa diubah oleh pembuatnya, sehingga skor lokasi orang lain tidak bisa disetir.
- Skor tidak pernah dikirim dari browser. Trigger database yang menghitungnya dari checklist.

## Teknologi

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | Nuxt 4 (Vue 3, `<script setup>`) | SSR untuk waktu muat pertama peta, satu bahasa untuk klien dan server route |
| Database dan auth | Supabase (Postgres, Auth, Storage) | Row Level Security dan trigger memindahkan aturan kualitas data ke lapisan yang tidak bisa dilewati klien |
| Peta | MapLibre GL JS | Sumber terbuka, tanpa kunci vendor pada pustakanya |
| Basemap | MapTiler `dataviz-light`, cadangan raster OpenStreetMap | Basemap sengaja netral supaya warna skor jadi satu-satunya warna kuat di layar |
| Geocoding | Nominatim, lewat server route Nuxt | Proxy dipakai supaya header `User-Agent` bisa dipasang sesuai kebijakan pemakaian Nominatim |
| Styling | Tailwind CSS 4 | Token warna dan tipografi didefinisikan sekali lewat `@theme` |
| Deploy | Vercel | Nuxt terdeteksi otomatis |

## Struktur project

```
app/
  assets/css/main.css      token desain dan gaya penanda peta
  components/              komponen UI, komponen peta berakhiran .client.vue
  composables/             skor, data lokasi, checklist, GPS, kompresi foto
  pages/                   peta, auth, tambah lokasi, detail lokasi, tentang
  types/database.types.ts  tipe database, ditulis mengikuti schema.sql
server/api/geocode.get.ts  proxy pencarian nama tempat ke Nominatim
scripts/                   penyalin worker MapLibre ke public/, jalan otomatis
schema.sql                 skema database, dijalankan sekali
schema-patch.sql           perbaikan trigger, RLS, dan bucket Storage
seed-demo.sql              data contoh untuk uji tampilan, hapus di langkah paling akhir
bersihkan-data-uji.sql     pembersih data contoh dan data uji, jalankan terakhir
PRD.md DESIGN-BRIEF.md     requirement produk dan arah visual
PRODUCT.md DESIGN.md       konteks produk dan sistem desain
```

## Menjalankan di lokal

Butuh Node.js 20 atau lebih baru, akun Supabase, dan kunci MapTiler gratis.

**1. Pasang dependency**

```bash
npm install
```

Repo ini menyertakan `.npmrc` berisi `legacy-peer-deps=true`. npm 10.9.3 punya bug resolver peer dependency yang membuat install Nuxt gagal; flag itu melewatinya.

**2. Siapkan database**

Di Supabase SQL Editor, jalankan `schema.sql` lalu `schema-patch.sql`. Keduanya sekali saja.

Lalu di Dashboard, buka **Authentication → Sign In / Providers** dan atur dua hal di bagian yang berbeda:

- Di **Auth Providers**, buka baris **Email** dan pastikan provider-nya aktif. Kalau `Disabled`, semua pendaftaran dan login gagal.
- Di **User Signups** di bagian atas halaman yang sama, matikan **Confirm email**. SMTP bawaan Supabase dibatasi sekitar dua sampai tiga email per jam, yang tidak cukup untuk pendaftaran beruntun saat survei lapangan.

Tombol Save di dua bagian itu terpisah.

**3. Isi environment variable**

Salin `.env.example` jadi `.env`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=sb_publishable_xxxx
NUXT_PUBLIC_MAPTILER_KEY=xxxx
```

**4. Jalankan**

```bash
npm run dev
```

Buka `http://localhost:3000`.

## Catatan pemakaian di lapangan

Kamera dan GPS hanya berfungsi di konteks aman, yaitu HTTPS atau `localhost`. Membuka dev server lewat alamat IP jaringan lokal seperti `http://192.168.1.5:3000` akan membuat browser memblokir keduanya tanpa penjelasan yang jelas. Untuk survei lapangan, selalu pakai URL hosting.

## Deploy

1. Import repo di Vercel, Nuxt terdeteksi otomatis.
2. Tambahkan tiga environment variable yang sama seperti `.env`.
3. Deploy, lalu buka URL hasilnya dari perangkat lain untuk memastikan tidak ada yang bergantung ke `localhost`.

## Lingkup yang sengaja tidak dibangun

Routing atau navigasi rute, chat atau notifikasi, dashboard admin terpisah, gamifikasi, aplikasi mobile native, dan sistem pembayaran. Semuanya dibekukan supaya alur inti berjalan tanpa cacat, bukan supaya daftar fiturnya panjang.
