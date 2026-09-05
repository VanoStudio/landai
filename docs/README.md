# docs

Sumber laporan progres. PDF hasilnya ada di `../laporan-progres-landai.pdf`.

- `tangkapan/` — **tidak ikut ke repo**, sengaja digitignore bersama PDF-nya supaya
  riwayat git tidak membawa puluhan megabita berkas biner. Isinya 38 tangkapan
  antarmuka, ponsel 390x844 dan desktop 1440x900, keduanya pada device scale factor 2.
  Dibuat ulang dengan `node tangkap-layar.mjs` selagi dev server jalan di port 3000.
- `laporan.html` — sumber laporan. Merujuk gambar di `tangkapan/` secara relatif.
- `tangkap-layar.mjs` — pengambil tangkapan. Butuh dev server jalan di port 3000,
  dan penjaga rute `/tambah-lokasi` dibuka sementara supaya empat langkah form
  bisa direkam tanpa akun.
- `buat-pdf.mjs` — merender `laporan.html` menjadi PDF A4.
- `buat-aset.mjs` — merender aset raster dari `public/tanda.svg`: gambar pratinjau
  tautan 1200x630 dan dua ukuran favicon. Perlu raster karena WhatsApp dan Telegram
  tidak merender og:image berformat SVG. Jalankan `node buat-aset.mjs ..` dari folder
  ini setiap kali tandanya berubah.
- `qa/` — seluruh skrip pengujian ujung ke ujung, lihat bagian di bawah.

Urutan membuat ulang laporan lengkap:

```bash
node tangkap-layar.mjs && node buat-pdf.mjs ../laporan-progres-landai.pdf
```

Keduanya memakai Playwright, sengaja tidak dipasang sebagai dependency project
supaya tidak menambah beban build. Pasang sementara saat perlu:

```bash
npm install playwright && npx playwright install chromium
```

## Menjalankan skrip pengujian

Semua skrip pengujian ada di `qa/`. Berkas `qa/uji-*.mjs` adalah pengujian ujung ke
ujung yang menjalankan peramban sungguhan terhadap dev server, sementara `qa/01-*`
sampai `qa/11-*` adalah pemeriksaan bertahap yang ditulis lebih dulu.

**Jalankan dari akar repo, bukan dari dalam folder ini.** Setiap skrip menyusun
jalurnya dari `process.cwd()`, jadi tangkapan layar hasilnya jatuh ke `gambar/` di
akar repo:

```bash
node docs/qa/uji-menyeluruh.mjs
```

Beberapa contoh yang mencakup area terpenting:

- `qa/uji-menyeluruh.mjs` — 14 langkah, dari mendaftar sampai keluar.
- `qa/uji-tulis-bersama.mjs` — batas hak tulis antar pengguna, 35 pemeriksaan.
- `qa/uji-responsif.mjs` — tata letak di lebar 320px sampai desktop, 50 pemeriksaan.
- `qa/uji-filter.mjs` — jumlah penanda di peta dicocokkan dengan isi basis data.
- `qa/uji-batas-foto-ketat.mjs` — empat pemilihan berkas serentak, memastikan batas
  tiga foto ditegakkan di logika, bukan sekadar disembunyikan.

Satu skrip berbeda dari yang lain: `qa/uji-schema-gabungan.mjs` tidak membuka peramban
dan tidak menyentuh Supabase sama sekali. Ia menjalankan `schema-gabungan.sql` di atas
Postgres sungguhan lewat PGlite, Postgres yang dikompilasi ke WebAssembly, jadi tidak
perlu Docker maupun server. Gunanya membuktikan berkas gabungan itu benar-benar bisa
dipasang sekali jalan pada basis data kosong, dan skema hasilnya berperilaku benar:

```bash
npm install @electric-sql/pglite
node docs/qa/uji-schema-gabungan.mjs
```

Sebagian skrip perlu masuk sebagai kontributor, jadi kredensial akun ujinya dibaca dari
environment dan tidak pernah ditulis di dalam berkas. Tambahkan ke `.env` di akar repo:

```
AKUN_UJI_EMAIL=alamat-akun-uji
AKUN_UJI_SANDI=sandi-akun-uji
```

Akun uji itu bukan akun sungguhan siapa pun dan dihapus bersama pembersihan data
terakhir sebelum pengumpulan.
