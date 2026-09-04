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
- `uji-menyeluruh.mjs` — uji 14 langkah lewat peramban, dari mendaftar sampai keluar,
  memakai akun sungguhan. Menghasilkan juga tangkapan keadaan sudah masuk.
- `uji-filter.mjs` — menguji tiap penyaring kebutuhan terpisah, mencocokkan jumlah
  penanda di peta dengan isi basis data.
- `uji-batas-foto-ketat.mjs` — menembakkan empat pemilihan berkas serentak untuk
  memastikan batas tiga foto ditegakkan di logika, bukan cuma disembunyikan.

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

Dua skrip perlu masuk sebagai kontributor, jadi kredensial akun ujinya dibaca dari
environment dan tidak pernah ditulis di dalam berkas. Tambahkan ke `.env` di akar repo:

```
AKUN_UJI_EMAIL=alamat-akun-uji
AKUN_UJI_SANDI=sandi-akun-uji
```

Akun uji itu bukan akun sungguhan siapa pun dan dihapus bersama pembersihan data
terakhir sebelum pengumpulan.
