# PRD landai, peta aksesibilitas difabel kota

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
- Autentikasi lewat Supabase Auth: daftar dan masuk dengan email beserta kata sandi, atau masuk dengan akun Google
- Peta interaktif full width menampilkan semua lokasi sebagai marker berwarna sesuai skor
- Filter berdasarkan tiga kategori kebutuhan: kursi roda, tunanetra, lansia atau stroller
- Form tambah lokasi: cari/tandai titik di peta, ambil koordinat GPS device dengan opsi koreksi manual, upload foto lewat kamera, isi checklist
- Halaman detail lokasi: foto, skor, breakdown checklist, info kontributor, tombol konfirmasi akurasi dari warga lain
- Skor aksesibilitas dihitung otomatis dari checklist

### Pelengkap alur inti

Masih di dalam pagar yang sama, tanpa menambah lapisan sistem baru:
- Papan kontributor, menampilkan warga yang paling banyak menambahkan lokasi
- Pembaruan terbuka atas daftar periksa dan foto, dengan jejak siapa pengubahnya, sementara nama, kategori, dan koordinat tetap milik pembuat aslinya
- Peringatan kemungkinan duplikat sebelum lokasi baru tersimpan
- Tambah foto langsung dari halaman lokasi, tanpa membuka kembali formulir empat langkah
- Pratinjau foto ukuran penuh dengan perpindahan antar foto
- Tanda landai yang ditanam ke berkas foto saat diunggah
- Peringatan isi kasar pada nama tempat dan catatan lapangan, diperiksa di peramban
- Tautan buka rute ke Google Maps dari halaman lokasi

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
  kategori text        -- sembilan jenis umum, daftarnya di bawah
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

Sembilan nilai yang boleh mengisi `kategori`, dipilih supaya berlaku di kota mana pun,
bukan hanya di koridor yang disurvei pertama: `transportasi_umum`, `perbelanjaan`,
`kantor_layanan`, `kesehatan`, `pendidikan`, `ibadah`, `ruang_publik`, `kuliner`,
`lainnya`.

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

## 9. Lokasi awal: koridor Pejaten sampai Warung Buncit, Jakarta Selatan

Survei pertama mengambil satu koridor sepanjang 2,6 km membujur utara-selatan di Jakarta
Selatan. Lima titik yang terisi, seluruhnya hasil pengukuran dan pemotretan di tempat:

| Lokasi | Jenis | Skor |
| --- | --- | --- |
| The Park Pejaten | Pusat perbelanjaan | 75 |
| Halte Pejaten | Transportasi umum | 25 |
| Halte Buncit Indah | Transportasi umum | 38 |
| Halte Warung Jati | Transportasi umum | 38 |
| Halte Warung Buncit | Transportasi umum | 38 |

Alasan pemilihan koridor ini ada tiga. Pertama, satu rantai halte yang dipakai orang
setiap hari ditambah satu pusat perbelanjaan di ujungnya memberi rentang skor yang lebar,
25 sampai 75, sehingga peta menunjukkan perbedaan nyata antar tempat, bukan sederet
penanda berwarna sama. Kedua, halte adalah titik yang paling sering menjadi penghambat
pertama bagi pengguna kursi roda, jadi datanya paling terasa gunanya. Ketiga, koridor yang
rapat memungkinkan satu lokasi didatangi ulang kalau fotonya kurang atau datanya perlu
dikoreksi, dan kemampuan datang ulang itu yang menentukan kelengkapan data.

Lima titik lengkap dipilih di atas dua puluh titik setengah lengkap. Data aksesibilitas
yang salah lebih merugikan pemakainya daripada data yang tidak ada, jadi tidak ada titik
yang disimpan tanpa foto, tanpa daftar periksa penuh, dan tanpa koordinat hasil pengukuran
di tempat.

## 10. Kriteria sukses

Dipetakan langsung ke rubrik penilaian penyisihan ITechno Cup 2026:
- Kesesuaian tema, dijawab lewat kaitan eksplisit ke SDG 11 di halaman tentang.
- Inovasi dan orisinalitas, dijawab lewat gabungan tiga hal dalam satu peta berbahasa Indonesia: skor aksesibilitas yang dihitung otomatis dari daftar periksa, verifikasi lewat konfirmasi warga lain, dan penyaringan menurut kebutuhan pemakainya.
- Fungsionalitas, dijawab lewat seluruh alur MVP di atas berjalan end to end tanpa error.
- UI/UX, dijawab lewat sistem desain sendiri: token warna, tipografi, dan komponen yang dipakai konsisten di seluruh halaman.
- Implementasi teknologi, dijawab lewat penggunaan Supabase, MapLibre, dan geocoding terdokumentasi di README.
- Dokumentasi dan repo, dijawab lewat README sesuai template resmi lomba.
