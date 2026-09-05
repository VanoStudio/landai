# SETUP: landai

Panduan lengkap memasang landai dari nol: clone, dependency, environment variable,
skema basis data, dev server, sampai deploy ke Vercel.

Ringkasannya ada di [README.md](README.md). Berkas ini yang rinci.

---

## 1. Prasyarat

| Yang perlu ada | Keterangan |
| --- | --- |
| **Node.js 20 atau lebih baru** | Cek dengan `node -v`. Nuxt 4 menolak versi di bawahnya. |
| **npm** | Ikut terpasang bersama Node.js. |
| **Git** | Untuk mengambil repo. |
| **Akun Supabase** | Gratis, di [supabase.com](https://supabase.com). Menyediakan basis data, akun pengguna, dan penyimpanan foto. |
| **Akun MapTiler** | Gratis, di [maptiler.com](https://www.maptiler.com). Menyediakan basemap peta. |
| **Akun Vercel** | Gratis, di [vercel.com](https://vercel.com), hanya kalau ingin ikut men-deploy. |

---

## 2. Ambil kode

```bash
git clone https://github.com/VanoStudio/landai.git
cd landai
```

---

## 3. Pasang dependency

```bash
npm install
```

Perintah ini juga menjalankan `scripts/salin-worker-maplibre.mjs` lewat `postinstall`.
Skrip itu menyalin dua berkas worker MapLibre ke `public/`. Keduanya sengaja tidak ikut
di repo karena berupa hasil build, dan tanpa langkah ini peta tidak akan muncul sama
sekali. Kalau suatu saat peta blank, jalankan ulang:

```bash
npm install
```

---

## 4. Siapkan proyek Supabase

### 4.1 Buat proyek

Buka dashboard Supabase, **New project**. Catat sandi basis data yang Anda buat, dan
pilih region terdekat, misalnya Singapore, supaya peta terasa cepat dibuka dari Indonesia.

### 4.2 Pasang skema, satu berkas sekali jalan

Buka **SQL Editor**, tempel **seluruh isi** [`schema-gabungan.sql`](schema-gabungan.sql),
lalu **Run**.

Satu berkas itu sudah membuat semuanya:

- lima tabel: `profiles`, `locations`, `accessibility_checklist`, `location_photos`, `confirmations`
- empat fungsi dan empat trigger: profil otomatis untuk akun baru, perhitungan skor,
  perubahan status verifikasi, dan reset verifikasi setelah checklist disunting
- sembilan belas kebijakan Row Level Security
- hak akses per kolom, yang menutup `skor`, `status`, dan `created_by` dari klien
- bucket Storage `location-photos`, langsung publik untuk dibaca

Tidak ada langkah manual lain. **Bucket Storage tidak perlu dibuat sendiri lewat dashboard**,
skripnya sudah membuatkan.

> `schema-gabungan.sql` adalah gabungan berurutan dari `schema.sql` dan seluruh
> `schema-patch-*.sql`. Ketujuh berkas asli tetap ada di repo sebagai riwayat bertahap
> beserta alasan tiap keputusan keamanannya. Untuk pemasangan baru, cukup berkas gabungan.

Memeriksa hasilnya, jalankan di SQL Editor:

```sql
select tablename, policyname from pg_policies
where schemaname in ('public', 'storage') order by 1, 2;
```

Harus keluar 19 baris.

### 4.3 Ambil kunci API

**Project Settings, API**. Yang dibutuhkan dua:

- **Project URL**, bentuknya `https://xxxx.supabase.co`
- **publishable key**, diawali `sb_publishable_`

> Jangan pernah memakai `service_role key` di aplikasi ini. Kunci itu melewati seluruh
> Row Level Security, dan karena Nuxt mengirim konfigurasi publik ke peramban, memakainya
> sama dengan menyerahkan kendali penuh basis data ke siapa pun yang membuka halaman.

### 4.4 Atur alamat pengalihan

**Authentication, URL Configuration**:

- **Site URL**: `http://localhost:3000` selama pengembangan
- **Redirect URLs**: tambahkan `http://localhost:3000/konfirmasi`

Setelah nanti ter-deploy, tambahkan pula alamat produksinya, lihat bagian 7.

### 4.5 Masuk dengan Google, opsional

Aplikasi tetap jalan penuh tanpa ini; tombol Google akan menjelaskan sendiri kalau
providernya belum aktif. Kalau ingin menyalakannya: **Authentication, Sign In / Providers,
Google**, isi Client ID dan Client Secret dari Google Cloud Console, lalu tambahkan
alamat callback yang ditampilkan Supabase ke daftar Authorized redirect URI di sana.

---

## 5. Environment variable

Salin contoh yang sudah disediakan, lalu isi nilainya:

```bash
cp .env.example .env
```

Isi `.env`:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=sb_publishable_xxxx
NUXT_PUBLIC_MAPTILER_KEY=kunci_dari_dashboard_maptiler
```

| Variabel | Dipakai untuk | Wajib |
| --- | --- | --- |
| `SUPABASE_URL` | Alamat proyek Supabase | ya |
| `SUPABASE_KEY` | Publishable key, dibaca `@nuxtjs/supabase` | ya |
| `NUXT_PUBLIC_MAPTILER_KEY` | Basemap MapTiler | ya, tanpa ini peta kosong |
| `AKUN_UJI_EMAIL`, `AKUN_UJI_SANDI` | Hanya untuk skrip pengujian di `docs/qa/` | tidak |

Kunci MapTiler diambil dari dashboard MapTiler, menu **Keys**. Tier gratisnya cukup
untuk pengembangan maupun demo lomba.

`.env` sudah masuk `.gitignore`. Jangan pernah di-commit.

### Kalau repo ini Anda fork

Ubah `situsUrl` di [`nuxt.config.ts`](nuxt.config.ts) menjadi alamat produksi Anda sendiri:

```ts
runtimeConfig: {
  public: {
    situsUrl: 'https://alamat-anda.vercel.app',
  },
},
```

Nilai itu dipakai tag pratinjau tautan. WhatsApp dan Telegram menolak alamat gambar yang
relatif, jadi alamatnya harus mutlak. Kalau tidak diubah, pratinjau tautan Anda akan
menampilkan gambar milik proyek aslinya.

---

## 6. Jalankan di lokal

```bash
npm run dev
```

Buka `http://localhost:3000`.

Yang seharusnya terlihat: layar pembuka singkat, lalu peta memenuhi layar. Kalau basis
data masih kosong, peta memang belum berpenanda, dan itu wajar.

### Mengisi data contoh, opsional

Untuk melihat peta terisi tanpa survei lapangan, jalankan
[`seed-demo.sql`](seed-demo.sql) di SQL Editor. Isinya beberapa lokasi contoh di Jakarta
Selatan beserta checklist-nya.

Berkas [`bersihkan-data-uji.sql`](bersihkan-data-uji.sql) membersihkan data contoh dan
sisa pengujian itu kembali. Jalankan hanya kalau data sungguhan sudah masuk.

### Kalau ada yang tidak beres

| Gejala | Sebabnya biasanya |
| --- | --- |
| Peta blank, konsol menyebut worker | `public/maplibre-gl-worker.mjs` belum tersalin. Jalankan `npm install` lagi. |
| Peta abu-abu tanpa jalan | `NUXT_PUBLIC_MAPTILER_KEY` kosong atau salah. |
| Tautan konfirmasi email membawa ke alamat yang salah | Site URL dan Redirect URLs di Supabase belum diisi, lihat 4.4. |
| `permission denied for table ...` | Ada `schema-patch` yang belum ikut. Pasang ulang lewat `schema-gabungan.sql` pada proyek kosong. |
| Tombol Google bilang provider belum aktif | Memang belum dinyalakan. Opsional, lihat 4.5. |

---

## 7. Deploy ke Vercel

1. **Import** repo di dashboard Vercel. Nuxt terdeteksi otomatis, preset build tidak
   perlu diubah.
2. **Environment Variables**: isi tiga variabel yang sama seperti `.env`, yaitu
   `SUPABASE_URL`, `SUPABASE_KEY`, dan `NUXT_PUBLIC_MAPTILER_KEY`. Terapkan ke
   Production, Preview, dan Development sekaligus.
3. **Deploy**. Hasilnya alamat berakhiran `.vercel.app`.
4. Kembali ke Supabase, **Authentication, URL Configuration**, lalu:
   - ubah **Site URL** menjadi alamat produksi tadi
   - tambahkan `https://alamat-anda.vercel.app/konfirmasi` ke **Redirect URLs**

   Tanpa langkah ini, tautan konfirmasi email dari akun yang mendaftar di produksi akan
   mengarah balik ke `localhost` dan gagal dibuka.
5. Kalau `situsUrl` di `nuxt.config.ts` belum diubah, ubah sekarang lalu deploy ulang,
   supaya pratinjau tautan menampilkan gambar milik Anda sendiri.

Bukalah alamat produksinya dari perangkat lain, bukan hanya dari komputer yang dipakai
mengembangkan. Itu cara tercepat menangkap hal yang diam-diam masih bergantung ke
`localhost`.

---

## 8. Menjalankan pengujian

Seluruh skrip pengujian ada di [`docs/qa/`](docs/qa/), dan **dijalankan dari akar repo**
selagi dev server hidup:

```bash
npm install playwright && npx playwright install chromium
node docs/qa/uji-menyeluruh.mjs
```

Sebagian skrip perlu masuk sebagai kontributor. Kredensialnya dibaca dari `.env` lewat
`AKUN_UJI_EMAIL` dan `AKUN_UJI_SANDI`, tidak pernah ditulis di dalam berkas skrip.

Satu skrip tidak butuh peramban maupun Supabase, yaitu pemeriksaan skema gabungan. Ia
menjalankan `schema-gabungan.sql` di atas Postgres sungguhan lewat PGlite:

```bash
npm install @electric-sql/pglite
node docs/qa/uji-schema-gabungan.mjs
```

Penjelasan tiap skrip ada di [`docs/README.md`](docs/README.md).

---

## 9. Pembagian kerja tim

Hanya Vano yang menulis kode. Husein mengisi data lapangan lewat form yang sudah live di
alamat produksi, tanpa perlu akses repo. Dakara berkontribusi lewat dokumen terpisah,
yaitu rubrik kriteria, riset dampak, dan draf bagian tentang, yang lalu dimasukkan ke
halaman tentang dan README.
