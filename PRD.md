# PRD: landai — Peta Aksesibilitas Difabel Kota

## 1. Konteks

Dibangun untuk ITechno Cup 2026, kategori Web Development, subtema Smart Sustainable Digital Solution for Inclusive Society, mendukung SDG 11 (kota dan komunitas berkelanjutan).

Tim: Vano (pengembang), Husein (survei lapangan), Dakara (riset kriteria dan konten dampak).

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
- Autentikasi (signup/login email, pakai Supabase Auth)
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
  kategori text        -- stasiun, mal, kantor_pemerintah, taman, kesehatan, lainnya
  lat float8
  lng float8
  skor int              -- dihitung dari checklist, 0 sampai 100
  status text           -- 'belum_terverifikasi' atau 'terverifikasi'
  created_by uuid fk profiles
  created_at timestamptz

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

confirmations
  id uuid pk
  location_id uuid fk locations
  user_id uuid fk profiles
  is_accurate bool
  created_at timestamptz
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
5. Ambil foto lewat kamera (bukan upload dari galeri).
6. Submit, lokasi langsung tampil di peta dengan status belum terverifikasi.

## 8. Menjaga kualitas data

- Foto wajib diambil langsung lewat kamera browser (`capture="environment"`), bukan pilih dari galeri.
- Setiap lokasi mencatat siapa kontributornya dan kapan.
- Warga lain yang pernah ke lokasi yang sama bisa menekan konfirmasi akurat atau sudah berubah.
- Status lokasi default belum terverifikasi, tetap tampil di peta tapi dengan penanda visual berbeda (misal outline putus-putus), berubah status setelah dapat beberapa konfirmasi.
- Ini bukan sistem anti-fraud berat, cukup untuk menjawab pertanyaan juri soal validitas data. Data dasar untuk submission awal (20 sampai 30 titik) diisi langsung oleh Husein di lapangan.

## 9. Lokasi awal: koridor Blok M

Titik mulai survei: Stasiun MRT Blok M, Blok M Plaza, dan Kantor Kecamatan Kebayoran Baru, semuanya dalam jarak jalan kaki. Alasan pemilihan: kombinasi tempat yang biasanya sudah ramah akses (stasiun, mal) dengan yang sering luput perhatian (kantor pemerintah), sehingga data lebih beragam dan representatif.

## 10. Kriteria sukses

Dipetakan langsung ke rubrik penilaian penyisihan ITechno Cup 2026:
- Kesesuaian tema, dijawab lewat kaitan eksplisit ke SDG 11 di halaman tentang.
- Inovasi dan orisinalitas, dijawab lewat penegasan belum ada crowdmap aksesibilitas serupa di Indonesia.
- Fungsionalitas, dijawab lewat seluruh alur MVP di atas berjalan end to end tanpa error.
- UI/UX, dijawab lewat sistem desain sendiri: token warna, tipografi, dan komponen yang dipakai konsisten di seluruh halaman.
- Implementasi teknologi, dijawab lewat penggunaan Supabase, MapLibre, dan geocoding terdokumentasi di README.
- Dokumentasi dan repo, dijawab lewat README sesuai template resmi lomba.
