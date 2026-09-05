# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dua kelompok memakai produk yang sama, dengan kebutuhan yang berlawanan arah:

- **Pencari informasi (tanpa akun).** Penyandang disabilitas, lansia, dan orang tua dengan stroller yang sedang merencanakan perjalanan atau sudah dalam perjalanan. Mereka butuh jawaban cepat sebelum berangkat: apakah tempat ini bisa saya masuki. Membaca sambil berdiri, sering satu tangan, sering di bawah tekanan waktu.
- **Kontributor lapangan (perlu akun).** Warga umum yang mengisi data di lokasi. Mengisi form yang sama berulang kali di tempat berbeda dalam satu hari, memakai HP, kadang sinyal buruk. Kelelahan mengisi adalah risiko utama, bukan kebingungan memakai.
- **Juri ITechno Cup 2026.** Menilai demo dan repo terhadap rubrik penyisihan. Membuka dari laptop, waktu terbatas, mencari bukti fungsionalitas berjalan penuh dan validitas data.

## Product Purpose

Memberi tahu orang apakah sebuah tempat umum bisa mereka akses, sebelum mereka pergi ke sana. Warga menandai lokasi, mengisi checklist delapan fasilitas aksesibilitas, dan mengunggah foto; hasilnya jadi peta dengan skor per lokasi yang bisa disaring menurut kebutuhan.

Sukses berarti seseorang membuka peta, menyaring menurut kebutuhannya, dan mendapat jawaban yang bisa dipercaya dalam hitungan detik.

## Positioning

Data aksesibilitas tingkat fasilitas yang dikumpulkan warga di Indonesia. Google Maps dan aplikasi peta sejenis menyimpan lokasi dan jam buka, bukan apakah rampnya ada dan guiding block-nya tersambung. Yang tidak bisa ditiru begitu saja: checklist delapan item yang diverifikasi di tempat, dengan foto dan jejak kontributor, ditambah konfirmasi silang dari warga lain yang pernah ke sana.

Mendukung SDG 11, kota dan komunitas berkelanjutan.

## Operating Context

- Kontributor bekerja berdiri di lokasi, memakai HP, memakai kamera perangkat. Foto wajib diambil di tempat lewat `capture="environment"`, bukan dipilih dari galeri.
- Titik koordinat berasal dari tiga jalur berurutan: pencarian nama tempat lewat Nominatim untuk perkiraan kasar, GPS perangkat untuk ketepatan, lalu koreksi manual dengan menggeser pin.
- Kamera dan GPS hanya jalan di konteks aman (HTTPS atau localhost), jadi pengisian lapangan selalu lewat URL hosting, tidak pernah lewat dev server di jaringan lokal.
- Data awal berasal dari survei koridor Blok M: Stasiun MRT Blok M, Blok M Plaza, Kantor Kecamatan Kebayoran Baru. Semuanya sejarak jalan kaki, sengaja mencampur tempat yang biasanya sudah ramah akses dengan yang sering luput.
- Pencari informasi membuka peta tanpa akun. Tidak ada halaman pembuka sebelum peta.

## Capabilities and Constraints

Ada:

- Autentikasi email lewat Supabase Auth, hanya untuk kontribusi.
- Peta penuh layar dengan penanda berwarna sesuai skor, disaring lewat tiga kategori kebutuhan: kursi roda, tunanetra, lansia atau stroller.
- Form tambah lokasi empat langkah: titik, identitas tempat, checklist delapan item, foto dan catatan.
- Halaman detail: foto, skor, rincian checklist, kontributor, konfirmasi akurasi warga lain.
- Skor dihitung otomatis oleh trigger database dari checklist, bukan diisi manusia.

Tidak dibangun, dibekukan sampai lomba selesai: routing atau navigasi rute, chat atau notifikasi, dashboard admin terpisah, gamifikasi atau poin, aplikasi mobile native, sistem pembayaran.

Istilah tetap: skor 0 sampai 100, kelipatan 12,5 karena checklist delapan item. Status lokasi hanya dua, `belum_terverifikasi` dan `terverifikasi`, naik setelah tiga konfirmasi akurat.

Kendala teknis: Nuxt 4, Supabase, MapLibre GL, Tailwind 4, deploy Vercel. Nominatim dibatasi satu permintaan per detik, jadi pencarian dipicu tombol, bukan tiap ketikan.

## Brand Commitments

- Nama produk: **landai**. Huruf kecil semua.
- Bahasa Indonesia, kalimat pendek, langsung. Tanpa istilah teknis di UI yang menghadap pengguna umum: tombolnya "Tambah lokasi", bukan "Submit data lokasi baru".
- Simbol aksesibilitas standar internasional dipakai apa adanya, tidak didesain ulang. Familiaritas mengalahkan keunikan visual di sini.
- Warna sudah ditetapkan dan mengikat: hijau tua `#0F6E56` untuk merek dan aksi utama; hijau `#639922`, amber `#BA7517`, merah `#E24B4A` **hanya** untuk mengkodekan skor. Tidak ada warna keempat untuk membedakan jenis fasilitas.
- Satu keluarga font untuk semuanya, Public Sans. Inter dilarang.

## Evidence on Hand

- `PRD.md`, requirement produk, data model, dan user flow.
- `DESIGN.md`, sistem desain yang mengikat: token warna, tipografi, dan komponen.
- `schema.sql` beserta seluruh `schema-patch-*.sql`, skema database yang sudah berjalan di Supabase. Gabungannya ada di `schema-gabungan.sql`.
- Belum ada foto lokasi, testimoni, angka pemakaian, atau data survei di database. Survei lapangan Blok M (20 sampai 30 titik) belum masuk. Jangan mengarang salah satu pun dari itu di UI atau README.

## Product Principles

1. **Peta adalah produknya.** Apa pun yang menunda peta muncul adalah beban, bukan pembuka.
2. **Angka skor memikul makna.** Dia elemen tipografi terpenting di kartu lokasi dan halaman detail, tidak didekorasi dan tidak disaingi elemen lain.
3. **Warna hanya mengkodekan skor.** Setiap pemakaian hijau, amber, atau merah untuk hal lain merusak satu-satunya kode warna yang harus dibaca sekilas.
4. **Kontributor mengisi berulang kali.** Setiap ketukan tambahan dikalikan 30 lokasi. Alur pendek mengalahkan form lengkap dalam satu layar.
5. **Data yang belum diverifikasi tetap tampil, tapi jujur menandai dirinya.** Menyembunyikannya membuat peta kosong; menyamarkannya membuat peta bohong.

## Accessibility & Inclusion

Produk ini tentang aksesibilitas, jadi antarmukanya tidak boleh gagal pada hal yang sama yang dia ukur.

- Target ketuk minimal 44 piksel di kontrol utama; kontributor memakainya sambil berdiri.
- Kontras teks memenuhi WCAG AA. Warna tidak pernah jadi satu-satunya pembawa informasi: status penanda dibedakan bentuk cincin, ketersediaan fasilitas dibedakan ikon centang dan silang plus teks pembaca layar.
- Setiap penanda peta punya nama aksesibel yang menyebut nama tempat dan skornya.
- Bahasa Indonesia sederhana adalah keputusan aksesibilitas, bukan sekadar gaya.
- Gerak dihormati lewat `prefers-reduced-motion`.
