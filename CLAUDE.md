# CLAUDE.md

Instruksi kerja untuk Claude Code di repo landai. Baca file ini penuh sebelum menulis kode apa pun. Requirement produk lengkap ada di `PRD.md`, arah visual ada di `DESIGN-BRIEF.md`. Keduanya wajib dibaca di awal sesi.

## Ringkasan project

Web crowdmap aksesibilitas difabel untuk lomba ITechno Cup 2026. Deadline submission ketat, dikerjakan solo oleh satu developer. Prioritas: fitur inti berjalan sempurna dan stabil, bukan fitur banyak tapi setengah jadi.

## Stack final, jangan diganti

- Nuxt 3 (Vue 3, Composition API, `<script setup>`)
- Supabase untuk auth, database Postgres, dan storage foto, pakai module `@nuxtjs/supabase`
- MapLibre GL JS untuk peta, tile dari OpenStreetMap atau MapTiler free tier
- Nominatim untuk geocoding pencarian nama tempat, tanpa perlu API key
- Tailwind CSS untuk styling
- Deploy ke Vercel

Jangan mengusulkan penggantian stack di tengah jalan. Kalau menemukan kendala teknis, cari solusi dalam stack ini dulu sebelum mengusulkan alternatif.

## Batasan scope, wajib dipatuhi

Fitur yang TIDAK dibangun, lihat detail alasannya di PRD.md bagian 5:
- Routing atau navigasi rute
- Chat atau notifikasi
- Dashboard admin terpisah
- Gamifikasi
- Aplikasi mobile native
- Sistem pembayaran

Jangan menambah fitur di luar PRD.md meskipun terasa mudah ditambahkan. Setiap fitur baru menambah risiko bug di waktu yang sempit.

## Urutan kerja

Kerjakan bertahap, jangan mencoba membangun semua sekaligus dalam satu pass. Setelah tiap tahap, laporkan progres singkat, lalu lanjut ke tahap berikut.

1. Setup project: scaffold Nuxt, pasang dependency, koneksi Supabase, jalankan schema SQL dari PRD.md bagian 6.
2. Autentikasi: signup, login, logout, guard halaman yang butuh akun.
3. Peta utama: tampilkan semua lokasi sebagai marker, warna sesuai skor, filter tiga kategori kebutuhan.
4. Form tambah lokasi: pencarian nama tempat, GPS device dengan koreksi manual, upload foto lewat kamera, checklist delapan item.
5. Halaman detail lokasi: foto, skor, breakdown checklist, tombol konfirmasi akurasi.
6. Setup desain dengan Impeccable, lihat bagian di bawah, jalankan setelah alur fungsional di atas selesai, jangan sebelum itu.
7. Uji seluruh alur end to end sebagai satu sesi manual: daftar akun baru, tambah satu lokasi, cek muncul di peta, buka detail, konfirmasi akurasi.
8. README sesuai template resmi lomba, ikuti panduan di SETUP.md.

## Desain UI dengan Impeccable

Tujuannya UI yang terasa dirancang khusus untuk aplikasi ini, bukan template generik. Jangan mendesain manual tanpa Impeccable.

Jalankan di root repo:
```
npx impeccable install
```
Lalu reload sesi.

Saat menjalankan `/impeccable init`, JANGAN jawab pertanyaan discovery dari nol. Pakai isi `DESIGN-BRIEF.md` di repo ini sebagai jawaban langsung, arah visual sudah ditentukan di sana dan tidak untuk didiskusikan ulang.

Urutan pemakaian:
1. `/impeccable init` dengan konteks dari DESIGN-BRIEF.md, hasilkan PRODUCT.md dan DESIGN.md.
2. Bangun halaman peta dan detail lokasi mengikuti DESIGN.md yang dihasilkan.
3. `/impeccable critique` pada halaman yang sudah jadi, untuk mengecek apakah masih terasa generik.
4. `/impeccable polish` sebagai pass terakhir sebelum submission.

Hindari secara eksplisit: label eyebrow huruf kapital semua di atas heading, radius dan shadow seragam di semua card tanpa alasan, badge angka 01/02/03 untuk konten yang bukan urutan langkah, warna berbeda-beda untuk tiap item fasilitas tanpa makna (warna hanya untuk encode skor: hijau, kuning, merah).

## Graphify, opsional

Kalau ada waktu luang setelah fitur inti selesai, boleh pasang Graphify untuk membantu navigasi codebase seiring project bertambah besar:
```
uv tool install graphifyy
graphify install
```
Ini bukan prioritas dan tidak boleh mengambil waktu dari pengerjaan fitur inti di PRD.md.

## Konvensi kode

- Komponen Vue pakai `<script setup>`, bukan Options API.
- Satu file komponen untuk satu tanggung jawab jelas, hindari komponen raksasa yang menangani peta sekaligus form sekaligus daftar.
- Nama file dan folder pakai kebab-case.
- Environment variable Supabase disimpan di `.env`, jangan pernah di-hardcode di kode, jangan pernah di-commit. Detail lengkap ada di `SETUP.md`.
- Sebelum melapor sebuah tahap selesai, jalankan dev server dan pastikan tidak ada error di console sebelum lanjut ke tahap berikutnya.

## Kalau ragu

Kalau ada bagian PRD.md yang ambigu atau butuh keputusan yang tidak tercakup, pilih opsi paling sederhana yang tetap memenuhi kebutuhan, catat asumsi yang diambil di ringkasan progres, jangan berhenti menunggu klarifikasi kecuali benar-benar blocking.
