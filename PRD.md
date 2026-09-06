# PRD: landai — Peta Aksesibilitas Difabel Kota

## 1. Konteks

Dibangun untuk ITechno Cup 2026, kategori Web Development, subtema Smart Sustainable Digital Solution for Inclusive Society, mendukung SDG 11 (kota dan komunitas berkelanjutan).

Tim Risol Laut, SMKS Cyber Media: Stevano Sunuprakoso Sosroraharjo (ketua tim, pengembang), Muhammad Husein Bal Afif (survei lapangan), Daiva Dakara Dhana (riset kriteria dan konten dampak).

## 2. Masalah

Belum ada sumber informasi terpercaya soal kondisi aksesibilitas tempat umum di Indonesia. Penyandang disabilitas, lansia, dan orang tua dengan stroller sering baru tahu sebuah tempat tidak ramah akses setelah tiba di sana. Google Maps dan aplikasi sejenis tidak menyediakan data ini.

## 3. Solusi

Web crowdmap: warga menandai lokasi di peta, mengisi checklist fasilitas aksesibilitas, dan mengunggah foto. Hasilnya jadi peta interaktif dengan skor aksesibilitas per lokasi, bisa difilter berdasarkan kebutuhan.

## 4. Target pengguna

- Warga umum yang berkontribusi data (mode kontribusi, perlu akun)
- Penyandang disabilitas, lansia, keluarga dengan stroller yang mencari informasi (mode lihat, tanpa akun)
- Juri lomba yang menilai demo dan repo

## 5. Lingkup MVP

### Harus ada
- Autentikasi (signup/login email, pakai Supabase Auth; masuk dengan Google ditambahkan belakangan, lihat bagian 11)
- Peta interaktif full width menampilkan semua lokasi sebagai marker berwarna sesuai skor
- Filter berdasarkan tiga kategori kebutuhan: kursi roda, tunanetra, lansia atau stroller
- Form tambah lokasi: cari/tandai titik di peta, ambil koordinat GPS device dengan opsi koreksi manual, upload foto lewat kamera, isi checklist
- Halaman detail lokasi: foto, skor, breakdown checklist, info kontributor, tombol konfirmasi akurasi dari warga lain
- Skor aksesibilitas dihitung otomatis dari checklist

### Tidak akan dibangun (feature freeze)
- Routing atau navigasi rute
- Sistem chat atau notifikasi
- Dashboard admin terpisah
- Gamifikasi atau poin
- Aplikasi mobile native
- Sistem pembayaran

Kalau ada dorongan menambah fitur di luar daftar ini selama development, tolak dan catat sebagai ide lanjutan pasca lomba, bukan dikerjakan sekarang.

## 6. Data model

```
profiles
  id uuid pk (fk ke auth.users)
  nama text
  created_at timestamptz

locations
  id uuid pk
  nama text
  kategori text        -- sembilan jenis umum, lihat bagian 11
  lat float8
  lng float8
  skor int              -- dihitung dari checklist, 0 sampai 100
  status text           -- 'belum_terverifikasi' atau 'terverifikasi'
  created_by uuid fk profiles
  created_at timestamptz
  updated_by uuid fk profiles   -- jejak penyunting terakhir, ditulis trigger
  updated_at timestamptz

accessibility_checklist
  location_id uuid fk locations (satu ke satu)
  ramp_tersedia bool
  lebar_pintu_cukup bool
  toilet_difabel bool
  parkir_difabel bool
  lift_tersedia_berfungsi bool
  guiding_block_tersambung bool
  tempat_duduk_tersedia bool
  permukaan_jalan_rata bool
  catatan text nullable

location_photos
  id uuid pk
  location_id uuid fk locations
  photo_url text        -- Supabase Storage
  uploaded_by uuid fk profiles
  created_at timestamptz

confirmations
  id uuid pk
  location_id uuid fk locations
  user_id uuid fk profiles
  is_accurate bool
  created_at timestamptz
  unique (location_id, user_id)   -- satu warga satu suara per lokasi
```

Skor = (jumlah item checklist bernilai true dibagi 8) dikali 100, dibulatkan.

Pemetaan filter ke checklist, disederhanakan untuk MVP, bisa dipertajam nanti:
- Kursi roda: `ramp_tersedia = true`
- Tunanetra: `guiding_block_tersambung = true`
- Lansia atau stroller: `tempat_duduk_tersedia = true OR lift_tersedia_berfungsi = true`

## 7. User flow

### Mode lihat (tanpa akun)
1. Buka web, peta langsung tampil penuh layar, marker warna sesuai skor: hijau baik, kuning sedang, merah kurang.
2. Pilih chip filter kebutuhan untuk menyaring marker yang relevan.
3. Ketuk marker, muncul popup ringkas: nama, skor, tiga ikon fasilitas utama.
4. Ketuk lanjut untuk buka detail penuh: semua foto, breakdown checklist lengkap, jumlah konfirmasi, info kontributor, tombol konfirmasi akurasi.

### Mode kontribusi (perlu akun)
1. Masuk atau daftar akun.
2. Tekan tombol tambah lokasi.
3. Cari nama tempat lewat geocoding untuk titik awal kasar, lalu tekan "pakai lokasi saya" agar koordinat device mengisi otomatis, koreksi manual dengan menggeser pin kalau meleset.
4. Isi nama, kategori, checklist delapan item, catatan bebas.
5. Ambil foto kondisi tempat. Di ponsel tombolnya membuka kamera belakang langsung.
6. Submit, lokasi langsung tampil di peta dengan status belum terverifikasi.

## 8. Menjaga kualitas data

- Foto wajib ada, dan tombolnya memakai `capture="environment"` sehingga di ponsel kamera belakang
  terbuka langsung. Di desktop atribut itu diabaikan peramban, jadi pemilih berkas biasa yang muncul.
  Kelengkapan datanya karena itu tidak bergantung pada pembatasan teknis semata.
- Setiap lokasi mencatat siapa kontributornya dan kapan.
- Warga lain yang pernah ke lokasi yang sama bisa menekan konfirmasi akurat atau sudah berubah.
- Status lokasi default belum terverifikasi, tetap tampil di peta dengan penanda berongga, bukan terisi, dan naik menjadi terverifikasi setelah tiga warga berbeda mengonfirmasi.
- Ini bukan sistem anti-fraud berat, cukup untuk menjawab pertanyaan juri soal validitas data. Data dasar diisi langsung dari lapangan, bukan disalin dari sumber lain; jumlah yang tercapai sampai pengumpulan ada di bagian 9.

## 9. Lokasi awal: koridor Pejaten dan Warung Jati, Jakarta Selatan

Rencana awal PRD ini menyebut koridor Blok M. Yang benar-benar disurvei adalah koridor
Pejaten sampai Warung Jati, sekitar 2,6 km membujur utara-selatan. Alasan perpindahannya
ada di bagian 11.

Lima titik yang terisi sampai pengumpulan, seluruhnya hasil survei lapangan sendiri:

| Lokasi | Jenis | Skor |
| --- | --- | --- |
| The Park Pejaten | Pusat perbelanjaan | 75 |
| Halte Pejaten | Transportasi umum | 25 |
| Halte Buncit Indah | Transportasi umum | 38 |
| Halte Warung Jati | Transportasi umum | 38 |
| Halte Warung Buncit | Transportasi umum | 38 |

Alasan pemilihan koridor ini: satu rantai halte yang benar-benar dipakai orang setiap hari,
ditambah satu pusat perbelanjaan di ujungnya. Kombinasinya memberi rentang skor yang lebar,
25 sampai 75, jadi peta menunjukkan perbedaan nyata antar tempat, bukan sederet penanda
berwarna sama. Halte juga titik yang paling sering menjadi penghambat pertama bagi pengguna
kursi roda, sehingga datanya paling terasa gunanya.

## 10. Kriteria sukses

Dipetakan langsung ke rubrik penilaian penyisihan ITechno Cup 2026:
- Kesesuaian tema, dijawab lewat kaitan eksplisit ke SDG 11 di halaman tentang.
- Inovasi dan orisinalitas, dijawab lewat gabungan tiga hal dalam satu peta berbahasa Indonesia: skor aksesibilitas yang dihitung otomatis dari daftar periksa, verifikasi lewat konfirmasi warga lain, dan penyaringan menurut kebutuhan pemakainya.
- Fungsionalitas, dijawab lewat seluruh alur MVP di atas berjalan end to end tanpa error.
- UI/UX, dijawab lewat sistem desain sendiri: token warna, tipografi, dan komponen yang dipakai konsisten di seluruh halaman.
- Implementasi teknologi, dijawab lewat penggunaan Supabase, MapLibre, dan geocoding terdokumentasi di README.
- Dokumentasi dan repo, dijawab lewat README sesuai template resmi lomba.

## 11. Penyesuaian setelah PRD awal

PRD ini ditulis sebelum pengerjaan. Bagian berikut mencatat keputusan yang berubah selama
pengerjaan beserta alasannya, supaya dokumen ini tetap menggambarkan produk yang benar-benar
dikumpulkan, bukan rencana yang sudah lewat.

**Kategori lokasi digeneralkan dari enam menjadi sembilan.** Daftar awal terlalu terikat pada
contoh koridor Blok M: `stasiun`, `mal`, `kantor_pemerintah`, `taman`, `kesehatan`, `lainnya`.
Kontributor di kota lain tidak menemukan tempatnya di daftar itu. Sekarang: transportasi umum,
pusat perbelanjaan, kantor layanan publik, fasilitas kesehatan, pendidikan, tempat ibadah,
taman dan ruang publik, rumah makan dan kafe, dan lainnya. Baris lama tidak dibuang, nilainya
dipindahkan lewat `schema-patch-7.sql` dan aplikasi masih mengenali nilai lama sebagai jaring
pengaman.

**Koridor survei pindah dari Blok M ke Pejaten dan Warung Jati.** Alasannya praktis: koridor
Pejaten lebih mudah didatangi ulang oleh penyurvei, dan kemampuan datang ulang itu yang
menentukan apakah sebuah titik bisa dilengkapi fotonya atau dikoreksi datanya. Titik Blok M
yang sempat ada di basis data selama pengembangan adalah data uji dari skrip pengujian,
bukan hasil survei; seluruhnya sudah dihapus sebelum pengisian data sungguhan dimulai.

**Jumlah titik lebih sedikit dari target awal.** PRD awal menargetkan 20 sampai 30 titik.
Yang tercapai lima titik yang seluruhnya lengkap: berfoto, berdaftar-periksa penuh, dan
berkoordinat hasil pengukuran di tempat. Mengejar angka dengan data setengah lengkap akan
melawan alasan aplikasi ini dibangun, karena data aksesibilitas yang salah lebih merugikan
pemakainya daripada data yang tidak ada.

**Masuk dengan Google ditambahkan.** Di luar lingkup awal, tetapi mengurangi hambatan
mendaftar bagi kontributor baru dan sudah tersedia di Supabase Auth tanpa menambah lapisan
kode sendiri.

**Fitur tambahan yang lahir dari pemakaian sungguhan.** Menambah foto langsung dari halaman
lokasi, pratinjau foto ukuran penuh, tanda landai yang ditanam ke berkas foto, peringatan
isi kasar, deteksi kemungkinan duplikat, dan papan kontributor. Seluruhnya masih di dalam
pagar bagian 5: tidak ada rute navigasi, tidak ada obrolan, tidak ada dasbor admin, tidak
ada gamifikasi, tidak ada aplikasi native, tidak ada pembayaran.

**Yang tidak berubah.** Model data inti, rumus skor, pemetaan tiga penyaring kebutuhan,
ambang tiga konfirmasi, dan seluruh daftar larangan fitur di bagian 5.
