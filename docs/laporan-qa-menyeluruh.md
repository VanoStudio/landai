# Laporan QA menyeluruh — landai

Sasaran uji: <https://landai-zeta.vercel.app> (produksi, kode commit `dee00e9`).
Tanggal sesi: 5 September 2026. Alat: Playwright Chromium, dipasang sementara
(`npm install --no-save playwright`), 390x844 dan 1440x900 dan 375x812, device scale
factor 2, locale `id-ID`, zona `Asia/Jakarta`.
Bukti: 76 berkas di `docs/tangkapan/qa/` (gitignored), skrip di `docs/qa/`.

## 1. Ringkasan eksekutif

Tiga puluh dua langkah diuji lewat antarmuka sungguhan dengan empat akun uji nyata.
**28 langkah lolos, 2 menemukan cacat, 2 langkah pembersihan selesai sebagian.**

Yang terbukti kokoh: seluruh alur inti (daftar, masuk, keluar, tambah lokasi empat
langkah, skor, foto, jejak kontributor), ketiga penyaring kebutuhan yang dicocokkan
angka demi angka dengan isi basis data, ambang tiga konfirmasi ke dua arah, penurunan
status setelah sunting, dan seluruh lapisan pertahanan tulis. Empat serangan API
memakai token akun yang bukan pemilik semuanya ditolak, termasuk usaha menulis kolom
`skor` dan `status` yang dijawab `42501`.

Dua cacat ditemukan:

1. **Tanggal kontributor berbeda antara server dan peramban.** Menyebabkan galat
   hidrasi di setiap kali halaman detail dibuka, 16 kali sepanjang sesi ini, dan
   pembaca di WIB sempat melihat tanggal yang meleset satu hari. Sudah diperbaiki di
   `app/pages/lokasi/[id].vue`, terbukti hilang, belum di-commit sesuai permintaan.
2. **Foto di Storage tidak bisa dihapus siapa pun.** Tidak ada kebijakan DELETE pada
   `storage.objects`, jadi permintaan hapus dijawab `HTTP 200` dengan badan `[]`, nol
   berkas terhapus, tanpa galat. Enam folder foto yang lokasinya sudah tidak ada masih
   tersimpan dan masih bisa dibuka lewat alamat publiknya. Tambalannya sudah ditulis
   di `schema-patch-4.sql` tapi **belum dijalankan**: perlu SQL Editor Supabase.

Cacat kedua ini juga yang membuat pembersihan data uji belum tuntas: seluruh baris
basis data sudah bersih, empat berkas foto uji masih tertinggal di bucket.

Satu temuan di luar daftar uji, dan ini yang paling mendesak menjelang pengumpulan:
**belum ada satu pun data survei lapangan di basis data.** Empat lokasi yang tersisa
adalah tiga data contoh dari `seed-demo.sql` dan satu lokasi peninggalan sesi
pengujian sebelumnya.

## 2. Hasil per langkah

| # | Langkah | Hasil | Bukti |
|---|---|---|---|
| 1 | Daftar, masuk, keluar, masuk lagi | LOLOS | akun `UJI QA Alfa` dibuat lewat `/daftar`, dialihkan ke `/`; keluar mengembalikan tombol Masuk; masuk lagi berhasil. `02-daftar-terisi.png`, `03-setelah-daftar.png`, `04-setelah-keluar.png`, `05-setelah-masuk-lagi.png` |
| 2 | Penjaga rute untuk pengunjung anonim | LOLOS | `/tambah-lokasi` tanpa akun mendarat di `/masuk`. `01-guard-anonim.png` |
| 3 | Tambah lokasi empat langkah | LOLOS | titik peta, nama "UJI QA Blok M Alfa" kategori taman, 8 item checklist, 1 foto tiruan kamera, catatan. `06-form-1-titik.png` sampai `09-form-4-foto.png`, `10-detail-baru.png` |
| 4 | Skor pratinjau bergerak dan cocok setelah simpan | LOLOS | pratinjau per centang: 0, 13, 25, 38, 50, 63. Detail 63, basis data 63 |
| 5 | Foto di Storage, tampil di kartu dan detail | LOLOS | `location-photos/f65993c6…/1788547187429-0.jpg`, 18.419 byte, HTTP 200; tampil di detail dan di kartu ringkas. `02-kartu-ringkas-sebelum.png` |
| 6 | Jejak kontributor | LOLOS | "Ditambahkan UJI QA Alfa pada 5 September 2026." |
| 7 | Muncul di peta, penanda berongga | LOLOS | 7 lokasi di peta = 7 baris di basis data, penanda baru `data-status="belum_terverifikasi"`. `11-peta-lokasi-baru.png` |
| 8 | Tiga penyaring, sendiri dan gabungan | LOLOS | kursi roda 6/6, tunanetra 4/4, lansia atau stroller 7/7, gabungan 4/4. Angka pada chip juga cocok. `01-filter-kursi_roda.png` sampai `04-filter-gabungan.png` |
| 9 | Penanda saat perbesar dan perkecil berulang | LOLOS | 3 putaran zoom, 108 bingkai, 216 posisi penanda direkam. Nol penanda di pojok wadah, nol tanpa transform. `05-zoom-berulang.png` |
| 10 | Satu ketukan memisahkan seluruh anggota kelompok | **CACAT RINGAN** | kelompok berisi 6 butuh 2 ketukan: 6 jadi 3 tunggal + dua kelompok berisi 2, baru ketukan kedua memisahkan semua. `06-kluster-sebelum.png`, `07-kluster-sesudah.png`. Lihat catatan produk C1 |
| 11 | Tombol lokasi saya | LOLOS | izin diberikan, `.titik-saya` muncul satu, peta memusat. `13-lokasi-saya.png` |
| 12 | Pencarian area | LOLOS | "Senayan" memberi 4 hasil relevan, pandangan berpindah, jumlah lokasi di basis data tetap 7, tidak ada titik baru. `09-cari-area-hasil.png`, `10-cari-area-sesudah.png` |
| 13 | Tombol rute di kartu dan detail | LOLOS | keduanya `https://www.google.com/maps/dir/?api=1&destination=-6.24393067626274,106.798391195107`, sama persis dengan `lat,lng` di basis data |
| 14 | Izin lokasi ditolak | LOLOS | notifikasi "Izin lokasi ditolak…" muncul, nol irisan dengan kendali peta dan kartu, hilang sendiri sebelum 7 detik, dan tombol tutupnya bekerja. `11-notifikasi-izin-ditolak.png`, `12-notifikasi-hilang-sendiri.png` |
| 15 | Tiga akun berbeda menyatakan masih akurat | LOLOS | 1 akurat: belum_terverifikasi. 2 akurat: belum_terverifikasi. 3 akurat: **terverifikasi**. `01-status-dua-konfirmasi.png`, `02-status-tiga-konfirmasi.png` |
| 16 | Tiga akun menyatakan sudah berubah | LOLOS | terverifikasi turun pada laporan pertama dan bertahan di belum_terverifikasi; banner "Mungkin sudah berubah. 3 warga melaporkan…" muncul. `03-status-turun-ajakan-perbarui.png` |
| 17 | Pemilik menyunting daftar periksa | LOLOS | dari terverifikasi (3 akurat) menjadi belum_terverifikasi, konfirmasi dihapus, skor 63 jadi 75 sesuai 6 dari 8 centang. `04-sunting-langkah-1.png` sampai `06-sunting-hasil.png` |
| 18 | Akun lain membuka halaman sunting | LOLOS | tombol Edit tidak dirender, dan `/tambah-lokasi?ubah=…` menjawab 403 "Hanya kontributor lokasi ini yang bisa mengubahnya". `07-sunting-ditolak-bukan-pemilik.png` |
| 19 | Serangan langsung ke API dengan token bukan pemilik | LOLOS | PATCH checklist: 200 dengan 0 baris, isi tidak berubah. PATCH `{skor, status}`: **403 `42501`**. PATCH nama: 0 baris. INSERT foto ke lokasi orang lain: **403 RLS** |
| 20 | Lima pemilihan berkas serentak | LOLOS | 5 event `change` dalam satu tick, tepat 3 pratinjau, dan tepat 3 baris `location_photos` setelah disimpan. `01-batas-foto-pratinjau.png`, `02-batas-foto-detail.png` |
| 21 | Papan kontributor | LOLOS | urutan 1 UJI QA Alfa 3 lokasi, 2 Akun Uji 1 lokasi, 3 UJI QA Beta 1 lokasi. Tingkat: Kontributor aktif, Baru mulai, Baru mulai. Bilah 50%, 33%, 33% persis sesuai rumus. `01-papan-kontributor.png`. Catatan produk C3 |
| 22 | Halaman tentang | LOLOS | "Program apresiasi bagi kontributor yang paling aktif dan paling akurat juga menjadi arah pengembangan lanjutan setelah masa lomba." dan tombol "Lihat papan kontributor" mendarat di `/papan-kontributor`. `02-tentang.png`, `03-tentang-ke-papan.png` |
| 23 | Masuk dengan Google | LOLOS | rantai `supabase.co/auth/v1/authorize` ke `accounts.google.com/o/oauth2/v2/auth` ke layar "Login dengan Google — Lanjutkan ke eagvqtumjcwzaefbriiq.supabase.co". Tidak diselesaikan dengan kredensial. `05-google-layar-izin.png` |
| 24 | Layar pembuka | LOLOS | umur 2.103 ms pada koneksi normal, 2.059 ms pada koneksi 50 kbps latensi 400 ms, walau layarnya baru muncul di detik 13,8. Wordmark beranimasi `melebur 1.1s`, batas ditegakkan animasi CSS 2 detik |
| 25 | Kartu pengenalan sekali saja | LOLOS | muncul "Baru pertama ke sini?", ditutup, `localStorage {"landai:pengenalan-ditutup":"1"}`, muat ulang tidak memunculkannya lagi. `01-pengenalan-pertama.png`, `02-pengenalan-setelah-muat-ulang.png` |
| 26 | Lebar 375 piksel | LOLOS | 3 chip terjangkau, chip terakhir utuh setelah baris digulir, nol gulir mendatar. Detail dan keempat langkah formulir: nol elemen keluar bidang. `03-375-peta-chip-digulir.png`, `04-375-detail.png`, `05-375-form-tambah.png`, `06-375-form-langkah-akhir.png` |
| 27 | Panel daftar di layar lebar | LOLOS | awal tertutup, terbuka saat ditekan, tertutup lagi lewat "Tutup daftar lokasi". `07-lebar-peta-awal.png`, `08-lebar-panel-dibuka.png`, `09-lebar-panel-ditutup.png` |
| 28 | Legenda satu baris | LOLOS | 4 label "Ramah, Sedang, Kurang, Belum verifikasi", posisi atas keempatnya 161 px. `10-lebar-legenda.png` |
| 29 | Ketebalan garis ikon | LOLOS dengan catatan | ketebalan optis 1,33 sampai 1,75 px. Ikon kebutuhan 1,5; kendali 1,67; tanda centang 1,75; panah tautan luar 1,33. Catatan produk C2 |
| 30 | Hierarki tombol | LOLOS | 5 tombol utama semuanya `rgb(15, 110, 86)` terisi penuh, 8 tombol sekunder semuanya latar putih bergaris, di 6 halaman berbeda |
| 31 | Galat konsol sepanjang sesi | **CACAT** | 16 kali "Hydration completed but contains mismatches" di halaman detail, plus satu `403` yang memang disengaja oleh uji langkah 18. Tidak ada galat lain |
| 32 | Pembersihan data uji | SEBAGIAN | 4 lokasi uji, checklist, foto, dan konfirmasinya terhapus lewat token pemilik. 4 berkas foto uji **masih tertinggal di Storage** karena cacat B. 4 akun uji masih ada, perlu dasbor |

## 3. Cacat dan statusnya

### A. Tanggal kontributor beda antara server dan peramban — **SUDAH DIPERBAIKI, belum di-commit**

`new Date(created_at).toLocaleDateString('id-ID', …)` tanpa `timeZone`. Server render
Vercel berjalan di UTC, peramban kontributor di WIB. Baris yang sama menghasilkan dua
tanggal.

Diukur pada produksi, halaman `/lokasi/f65993c6…`:

| Sasaran | Zona peramban | HTML server | Setelah hidrasi | Galat konsol |
|---|---|---|---|---|
| produksi, kode lama | Asia/Jakarta | 4 September 2026 | 5 September 2026 | 1 |
| produksi, kode lama | America/New_York | 4 September 2026 | 4 September 2026 | 0 |
| dev lokal, kode baru | Asia/Jakarta | 5 September 2026 | 5 September 2026 | 0 |
| dev lokal, kode baru | America/New_York | 5 September 2026 | 5 September 2026 | 0 |

Perbaikan: `timeZone: 'Asia/Jakarta'` pada opsi format, di
`app/pages/lokasi/[id].vue`. Sesudahnya kedua sisi selalu sama, dan tanggalnya selalu
tanggal WIB, termasuk untuk juri yang membuka dari zona lain. Bukti ulang:
`node docs/qa/08-bukti-hidrasi.mjs`.

### B. Foto di Storage tidak bisa dihapus siapa pun — **TAMBALAN DITULIS, BELUM DIJALANKAN**

`schema-patch-2.sql` memasang kebijakan INSERT untuk `storage.objects` tapi tidak
memasang DELETE. Tanpa kebijakan, RLS menolak diam-diam.

Diukur dengan akun yang benar-benar mengunggah berkasnya sendiri lewat aplikasi:

```
DELETE /storage/v1/object/location-photos {prefixes:[...]}  ->  HTTP 200  []
```

Nol berkas terhapus, tidak ada galat, dan berkasnya masih terbaca di alamat publiknya
sesudah itu. Akibatnya menghapus lokasi tidak pernah ikut menghapus fotonya. Bucket
saat ini memuat **enam folder yang lokasinya sudah tidak ada**, dua di antaranya dari
sesi ini, empat sisanya peninggalan sesi pengujian sebelumnya.

Tambalan ada di `schema-patch-4.sql`, memberi hak hapus lewat dua jalan: `owner =
auth.uid()` yaitu pengunggahnya sendiri, satu-satunya jalan yang masih berlaku untuk
berkas yatim, dan kepemilikan lokasi seperti pada kebijakan unggah. Perlu dijalankan
di Supabase SQL Editor. Sesudahnya jalankan `node docs/qa/10-sisa-berkas.mjs` untuk
menyapu empat berkas uji yang tersisa.

## 4. Catatan produk, bukan cacat, tidak saya putuskan sendiri

**C1. Kelompok penanda butuh dua ketukan kalau anggotanya berjarak sangat timpang.**
`fitBounds` memasukkan seluruh anggota ke dalam bidang pandang. Kelompok yang memuat
anggota berjarak 100 meter sekaligus 13 meter tidak bisa memenuhi dua hal sekaligus:
menampilkan semuanya, dan memisahkan semuanya. Menaikkan `maxZoom` tidak menolong,
sudah dicoba dan diukur: zoom yang dipilih ditentukan rentang anggotanya, bukan
batas atas. Pilihannya perlu diambil pemilik produk: tetap dua ketukan seperti
sekarang, atau memperbesar melampaui bidang anggota sehingga sebagian anggota keluar
layar pada ketukan pertama. Perlu dicatat, jarak 13 sampai 26 meter itu berasal dari
titik uji saya sendiri; tiga data contoh yang ada berjarak 43 sampai 109 meter dan
terpisah sempurna dengan satu ketukan.

**C2. Ketebalan garis ikon berbeda tipis antar peran.** Diukur optis, yaitu
`stroke-width` dikali rasio render terhadap viewBox: ikon kebutuhan 1,5 px, kendali
1,67 px, tanda centang daftar periksa 1,75 px, panah "tautan membuka tab baru"
1,33 px. Selisih terlebarnya 0,42 px. Tidak ada aturan ketebalan ikon yang ditetapkan,
jadi ini keputusan gaya, bukan penyimpangan. Kalau mau diseragamkan, yang paling
menonjol adalah panah tautan luar yang paling tipis.

**C3. Urutan kontributor berjumlah sama tidak ditentukan.** Dua akun dengan satu
lokasi tampil dalam urutan yang datang dari basis data. Tidak salah, tapi juga tidak
stabil. Kalau mau pasti, urutkan tambahan berdasarkan tanggal kontribusi pertama.

**C4. Ada satu baris `profiles` tanpa nama** (`26a1611f…`, dibuat 4 September). Kalau
akun itu kelak menambah lokasi, papan kontributor akan menampilkannya sebagai
"Warga". Kemungkinan besar akun hasil masuk dengan Google.

## 5. Catatan kejujuran

- **Masuk dengan Google tidak diselesaikan.** Dibuktikan hanya sampai layar izin
  Google dan rantai pengalihannya. Memasukkan kredensial sungguhan tidak saya lakukan.
- **Perbaikan tidak di-commit dan tidak di-deploy**, sesuai keputusanmu. Produksi
  masih menjalankan kode lama, jadi galat hidrasi masih ada di tautan hosting saat
  laporan ini ditulis. Bukti perbaikan diambil dari dev server lokal.
- **Langkah 9 diukur dari posisi DOM**, yaitu `getBoundingClientRect` dan `transform`
  tiap penanda pada 108 bingkai berturutan selama animasi zoom, bukan dari
  perbandingan piksel rekaman layar. Cukup untuk menangkap penanda yang terlukis di
  titik nol wadah, tidak cukup untuk menangkap cacat visual yang tidak mengubah
  posisi elemen.
- **Langkah 10 memakai titik uji saya sendiri** yang lebih rapat daripada data
  sungguhnya, lihat C1.
- **Empat akun uji masih hidup**: `uji-qa-alfa-*`, `uji-qa-beta-*`, `uji-qa-gama-*`,
  `uji-qa-delta-*`, semuanya `@example.com`. Menghapus akun butuh kunci service role
  atau dasbor Authentication, keduanya tidak tersedia pada sesi ini. Baris `profiles`
  ikut terhapus otomatis lewat cascade begitu akunnya dihapus.
- **Empat berkas foto uji masih di Storage**, terhalang cacat B, bukan karena
  dilewatkan.
- **Data milik orang lain tidak disentuh sama sekali.** Penghapusan disaring dua
  lapis: nama berawalan "UJI QA", dan dilakukan memakai token pemilik masing-masing
  sehingga RLS sendiri yang menolak kalau sasarannya keliru.
- Sebagian tangkapan layar memakai penomoran yang dimulai ulang tiap skrip, jadi ada
  beberapa nama berkas yang tertimpa skrip berikutnya. Yang dirujuk tabel di atas
  adalah berkas yang tersisa.
- Playwright dipasang dengan `--no-save`, jadi `package.json` tidak berubah. Hapus
  dengan `npm remove playwright` kalau tidak dipakai lagi.

## 6. Keadaan data setelah pembersihan

| | Sebelum | Sesudah |
|---|---|---|
| Lokasi | 8 | 4 |
| Baris foto | 5 | 1 |
| Konfirmasi | 1 | 1 |
| Profil | 8 | 8 |

Empat lokasi yang tersisa: Stasiun MRT Blok M, Blok M Plaza, Kantor Kecamatan
Kebayoran Baru, semuanya dari `seed-demo.sql`, ditambah Taman Literasi Martha
Christina Tiahahu yang dibuat akun "Akun Uji" pada sesi pengujian sebelumnya.
Tangkapan keadaan bersih: `99-peta-setelah-bersih.png`, peta menampilkan 4 lokasi.

## 7. Risiko menuju batas waktu pengumpulan

1. **Belum ada data survei lapangan sama sekali.** PRD bagian 8 menargetkan 20 sampai
   30 titik dari Husein. Yang ada sekarang tiga data contoh dan satu sisa pengujian.
   Ini risiko terbesar terhadap butir Fungsionalitas di rubrik, dan tidak bisa
   diperbaiki oleh kode.
2. **`bersihkan-data-uji.sql` akan ikut menghapus Taman Literasi**, karena
   penyaringnya `created_by in (select id from profiles where nama = 'Akun Uji')`.
   Kalau lokasi itu ternyata data sungguhan yang dimasukkan lewat akun uji, ia hilang
   diam-diam. Putuskan sebelum menjalankan berkas itu.
3. **Foto yatim tetap publik.** Sampai `schema-patch-4.sql` dijalankan, enam folder
   foto yang lokasinya sudah tidak ada masih bisa dibuka siapa saja yang tahu
   alamatnya, dan tidak ada jalan menghapusnya lewat aplikasi.
4. **Galat hidrasi masih ada di produksi.** Juri yang membuka konsol peramban akan
   melihatnya, dan pembaca di WIB melihat tanggal keliru satu hari sampai hidrasi
   selesai. Perbaikannya sudah siap, tinggal di-commit dan di-deploy.
5. **Akun uji masih tampil di papan kontributor.** "Akun Uji" saat ini menempati
   peringkat 2. Setelah akun uji dihapus dan data lapangan masuk, papan itu perlu
   dilihat ulang.
6. **Kunci MapTiler ada di runtime config publik.** Wajar untuk kunci sisi klien,
   tapi pastikan pembatasan domain di dasbor MapTiler menyala sebelum tautan hosting
   disebar ke juri.
