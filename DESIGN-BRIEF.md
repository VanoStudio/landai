# DESIGN-BRIEF: landai

Dokumen ini adalah jawaban langsung untuk proses discovery `/impeccable init`. Jangan menebak ulang arah desain, pakai isi di bawah ini apa adanya.

## Produk

Peta aksesibilitas difabel berbasis kontribusi warga. Fungsinya membantu penyandang disabilitas, lansia, dan orang tua dengan stroller menemukan tempat umum yang ramah akses, sekaligus memberi warga cara mudah melaporkan kondisi fasilitas.

## Audiens

Dua kelompok berbeda memakai produk yang sama: orang yang mencari informasi cepat sebelum bepergian (butuh kejelasan dan kecepatan baca), dan warga yang mengisi data lapangan (butuh form yang tidak melelahkan diisi berkali-kali).

## Vernakular visual

Ambil dari dunia rambu jalan dan wayfinding fasilitas publik, bukan dari dunia SaaS atau startup dashboard. Bayangkan papan penunjuk arah di stasiun atau bandara: solid, kontras tinggi, fungsional, tanpa dekorasi berlebih.

## Warna

- Hijau tua sebagai warna utama merek dan aksi utama, sekitar `#0F6E56`
- Hijau muda `#639922` untuk skor kategori baik
- Amber `#BA7517` untuk skor kategori sedang
- Merah `#E24B4A` untuk skor kategori kurang
- Netral abu dan putih untuk semua elemen struktural lain

Ketiga warna skor (hijau, amber, merah) HANYA dipakai untuk mengkodekan skor aksesibilitas. Jangan dipakai untuk elemen dekoratif lain, dan jangan menambah warna keempat untuk kategori fasilitas yang berbeda-beda.

## Tipografi

Satu keluarga font sans-serif untuk semuanya, jangan pakai dua font berbeda untuk heading dan body. Hindari Inter karena terlalu jadi default AI-generated. Pertimbangkan Public Sans, dipakai oleh U.S. Web Design System, punya karakter civic atau kepemerintahan yang cocok dengan tema infrastruktur publik, dan tersedia gratis lewat Google Fonts.

Angka skor aksesibilitas (misal 82) adalah elemen tipografi paling penting di kartu lokasi, tampilkan besar dan tegas, biarkan dia jadi fokus visual, bukan didekorasi dengan elemen lain di sekitarnya.

## Layout

Peta adalah hero. Begitu halaman dibuka, peta full bleed langsung terlihat, tanpa halaman landing berisi judul besar dan tombol CTA sebelum peta muncul. Ini keputusan spesifik untuk produk ini, bukan pola hero section generik.

Halaman detail lokasi memakai layout kartu tunggal, bukan grid banyak kartu kecil.

Form tambah lokasi ditata sebagai alur singkat, bukan satu form panjang dengan semua field sekaligus, karena akan dipakai berulang kali oleh kontributor lapangan di lokasi berbeda.

## Yang harus dihindari secara eksplisit

- Label eyebrow huruf kapital semua di atas setiap heading
- Radius sudut dan shadow yang seragam di semua card tanpa mempertimbangkan hierarki
- Badge angka 01, 02, 03 dipakai untuk konten yang bukan urutan langkah, contohnya jangan dipakai untuk tiga chip filter kategori kebutuhan
- Ikon berbeda warna untuk tiap jenis fasilitas hanya untuk terlihat ramai, ikon fasilitas tetap netral (hitam, abu, atau putih tergantung latar), warna hanya untuk skor
- Meta text yang digabung tanda titik tengah, contoh "A · B · C"
- Tombol dengan tanda panah di ujung teks

## Ikon

Pakai ikon aksesibilitas standar internasional yang sudah dikenal umum (simbol kursi roda, simbol tunanetra, dan sejenisnya), jangan mendesain ulang ikon custom untuk simbol-simbol ini, karena familiaritas lebih penting daripada keunikan visual di sini.

## Nada tulisan dalam produk

Bahasa Indonesia, sederhana, langsung, kalimat pendek. Hindari istilah teknis di UI yang menghadap pengguna umum, contoh tombol bertuliskan "Tambah lokasi" bukan "Submit data lokasi baru".
