---
name: landai
description: Peta aksesibilitas difabel berbasis kontribusi warga
colors:
  brand: "#0F6E56"
  brand-gelap: "#0B5442"
  skor-baik: "#639922"
  skor-sedang: "#BA7517"
  skor-kurang: "#E24B4A"
  posisi: "#1D6FE0"
  teks: "#101828"
  teks-sekunder: "#4B5563"
  teks-redup: "#6B7280"
  garis: "#E5E7EB"
  garis-kuat: "#9CA3AF"
  permukaan: "#FFFFFF"
  permukaan-tenang: "#F9FAFB"
typography:
  display:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.2
  penanda:
    fontFamily: "Public Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  penuh: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  tombol-utama:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.permukaan}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  tombol-utama-hover:
    backgroundColor: "{colors.brand-gelap}"
    textColor: "{colors.permukaan}"
  tombol-sekunder:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.teks}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  chip-kebutuhan:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.teks}"
    rounded: "{rounded.penuh}"
    padding: "0 12px"
    height: "44px"
  chip-kebutuhan-aktif:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.permukaan}"
  penanda-skor:
    backgroundColor: "{colors.skor-baik}"
    textColor: "{colors.permukaan}"
    rounded: "{rounded.penuh}"
    size: "44px"
  kartu:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.teks}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.permukaan}"
    textColor: "{colors.teks}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: landai

## Overview

**Creative North Star: "Papan penunjuk arah stasiun"**

Bahasanya diambil dari rambu jalan dan wayfinding fasilitas publik, bukan dari dashboard SaaS. Papan penunjuk arah di stasiun bekerja karena tiga hal: kontras tinggi, tidak ada dekorasi yang bersaing dengan informasi, dan satu kode warna yang artinya konsisten di seluruh gedung. Sistem ini meniru ketiganya. Permukaan putih polos, garis tipis abu, teks hitam, dan tepat satu keluarga warna yang membawa makna.

Kepadatannya sedang: cukup lapang untuk dibaca sambil berdiri di peron, cukup rapat supaya kontributor tidak menggulir berkali-kali untuk satu lokasi. Yang ditolak secara sadar: label eyebrow huruf kapital, radius dan bayangan seragam di semua kartu tanpa hierarki, penomoran 01/02/03 untuk hal yang bukan urutan, ikon berwarna-warni per jenis fasilitas, pemisah titik tengah, dan panah di ujung teks tombol.

Angka skor adalah tokoh utamanya. Di kartu ringkas ia 48px, di halaman detail 72px, dan tidak pernah dikelilingi ring progres, sparkline, atau ornamen apa pun. Ukurannya yang bicara.

**Key Characteristics:**
- Peta full-bleed sebagai layar pertama, tanpa halaman pembuka
- Warna hanya untuk skor, tidak pernah untuk dekorasi
- Satu keluarga font, Public Sans, tanpa font kedua
- Angka besar dan telanjang sebagai fokus visual
- Bentuk, bukan warna, yang membedakan status verifikasi

## Colors

Palet nyaris netral dengan satu warna merek dan tiga warna kode. Di layar peta, satu-satunya warna jenuh yang muncul adalah penanda skor.

### Primary
- **Hijau landai** (`#0F6E56`): warna merek dan setiap aksi utama. Tombol simpan, tombol tambah lokasi, chip filter yang aktif, tautan, wordmark, cincin fokus. Hijau tua yang serius, bukan hijau segar.
- **Hijau landai gelap** (`#0B5442`): hanya untuk keadaan hover tombol utama.

### Tertiary
Tiga warna kode skor. Dipakai pada penanda peta dan angka skor, tidak di tempat lain.
- **Hijau skor** (`#639922`): skor 63 sampai 100, lima item checklist ke atas terpenuhi.
- **Amber skor** (`#BA7517`): skor 38 sampai 62, tiga atau empat item terpenuhi.
- **Merah skor** (`#E24B4A`): skor 0 sampai 37, dua item atau kurang.

### Posisi pengguna
- **Biru posisi** (`#1D6FE0`): titik "kamu di sini" pada peta, beserta halo denyutnya. Satu-satunya warna di luar palet skor, dan tidak pernah muncul di elemen lain. Dipakai karena biru untuk posisi pengguna adalah konvensi peta yang sudah dikenal umum, sedangkan memakai hijau merek akan tertukar dengan arti skor.

### Neutral
- **Teks utama** (`#101828`): judul, isi, dan angka skor pada penanda berongga.
- **Teks sekunder** (`#4B5563`): kalimat pendukung, bantuan checklist, meta.
- **Teks redup** (`#6B7280`): satuan `/100`, jumlah pada chip.
- **Garis** (`#E5E7EB`): pembatas antar baris dan tepi kartu.
- **Garis kuat** (`#9CA3AF`): tepi input dan tombol sekunder.
- **Permukaan** (`#FFFFFF`) dan **permukaan tenang** (`#F9FAFB`): latar halaman dan blok catatan.

### Named Rules
**Aturan Satu Kode Warna.** Hijau, amber, dan merah hanya berarti skor aksesibilitas. Tidak boleh ada warna keempat untuk membedakan jenis fasilitas, kategori tempat, atau apa pun yang lain. Kalau sebuah elemen butuh dibedakan, bedakan dengan bentuk, berat, atau posisi.

**Aturan Ikon Netral.** Ikon fasilitas selalu hitam, abu, atau putih tergantung latar. Ikon tidak pernah mengambil warna skor.

## Typography

**Display Font:** Public Sans (fallback ui-sans-serif, system-ui)
**Body Font:** Public Sans
**Label Font:** Public Sans

**Character:** Satu keluarga untuk semuanya. Public Sans dipakai U.S. Web Design System dan membawa nada kepemerintahan yang cocok untuk infrastruktur publik: netral, jelas, tanpa kepribadian yang mencuri perhatian. Inter dilarang, terlalu jadi bawaan.

### Hierarchy
- **Display** (700, 72px, line-height 1): angka skor di halaman detail. Hanya untuk itu.
- **Skor kartu** (700, 48px, line-height 1): angka skor di kartu ringkas peta dan pratinjau checklist.
- **Headline** (700, 24px, line-height 1.2): nama lokasi di halaman detail, judul langkah form.
- **Title** (600, 16px, line-height 1.4): judul bagian, nama lokasi di kartu ringkas.
- **Body** (400, 14px, line-height 1.5): seluruh isi. Ukuran input dinaikkan ke 16px supaya iOS tidak memperbesar halaman saat field difokuskan.
- **Label** (500, 13px di bawah 640px, 14px di atasnya): chip filter dan label form. Huruf normal, tidak pernah kapital semua.
- **Penanda** (700, 15px, line-height 1): angka skor di dalam penanda peta. Ukurannya dipilih supaya dua digit muat pas dalam lingkaran 44px.

### Named Rules
**Aturan Angka Telanjang.** Angka skor tidak pernah dikelilingi ring progres, sparkline, badge, atau bingkai berwarna. Ukuran dan berat yang membawa maknanya. Satu-satunya yang boleh menempel adalah satuan `/100` dalam abu kecil.

**Aturan Angka Sejajar.** Setiap angka yang bisa berubah memakai `font-variant-numeric: tabular-nums`, supaya jumlah dan skor tidak bergeser saat diperbarui.

## Layout

Dua model tata letak, dipilih menurut tugasnya.

**Layar peta** memakai satu kanvas penuh `100dvh` dengan lapisan antarmuka mengambang di atasnya. Bilah identitas menempel di atas dengan latar putih pekat, bukan transparan berblur, supaya teks tetap terbaca di atas peta yang bergerak. Baris chip filter membungkus, tidak menggulung horizontal, karena kontrol yang tersembunyi di luar layar sama saja dengan kontrol yang tidak ada. Kartu ringkas naik dari bawah selebar penuh di ponsel dan menempel kiri bawah dengan lebar maksimum 384px di layar lebar.

**Halaman baca dan isi** memakai satu kolom `max-width: 32rem` yang dipusatkan, padding 16px. Halaman detail adalah kartu tunggal panjang, bukan grid kartu kecil. Form tambah lokasi dipecah jadi empat langkah dengan bilah kemajuan, karena kontributor lapangan mengisinya berulang kali.

Ritme jarak memakai kelipatan 4px. Kelompok yang berhubungan dirapatkan (8px), kelompok berbeda dipisah lebar (20 sampai 32px), dan ruang di atas judul selalu lebih besar daripada di bawahnya.

Titik henti tunggal di 640px (`sm`). Di bawahnya: tombol tambah lokasi mengambang di kiri bawah, kartu selebar layar. Di atasnya: tombol tambah pindah ke bilah atas, kartu menyusut ke kiri bawah.

## Elevation & Depth

Sistem ini datar secara bawaan. Kedalaman hanya muncul ketika sebuah elemen benar-benar melayang di atas peta, tidak pernah sebagai hiasan pada kartu diam.

### Shadow Vocabulary
- **Penanda peta** (`box-shadow: 0 0 0 2px #fff, 0 1px 5px rgb(0 0 0 / 0.35)`): cincin putih memisahkan penanda dari basemap, bayangan lembut mengangkatnya.
- **Penanda terpilih** (`box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--warna-skor), 0 3px 10px rgb(0 0 0 / 0.4)`): cincin ganda, satu-satunya elemen dengan dua lapis cincin.
- **Kartu di atas peta** (`shadow-lg` Tailwind): dipakai hanya pada kartu ringkas dan kotak pesan status yang melayang.

Kartu di halaman biasa tidak berbayang sama sekali. Batasnya garis 1px `#E5E7EB`.

### Named Rules
**Aturan Bayangan Untuk Melayang.** Bayangan berarti elemen ini benar-benar berada di atas sesuatu yang lain. Kartu di dalam alur halaman biasa memakai garis, bukan bayangan.

## Shapes

Radius mengikuti fungsi, bukan keseragaman. Kontrol dan input memakai 4px, kartu memakai 8px, chip filter dan penanda peta memakai lingkaran penuh. Perbedaan itu disengaja: bentuk membawa informasi tentang jenis elemen, jadi menyeragamkannya justru membuang sinyal.

Silhuet penanda adalah bentuk tanda tangan sistem ini: lingkaran 44px berisi angka. Terisi warna berarti terverifikasi; berongga dengan cincin warna 3px dan angka gelap berarti belum dikonfirmasi. Perbedaannya bentuk, bukan warna, jadi status tetap terbaca oleh mata yang tidak membedakan warna.

## Components

### Buttons
- **Shape:** radius 4px, tinggi minimum 44px pada kontrol utama layar sentuh.
- **Primary:** latar `#0F6E56`, teks putih, padding 10px 16px.
- **Hover / Focus:** latar bergeser ke `#0B5442`. Fokus keyboard memakai cincin `2px solid #0F6E56` dengan offset 2px.
- **Secondary:** latar putih, garis 1px `#9CA3AF`, teks `#101828`. Hover menggelapkan garis.
- **Disabled:** opacity 40 sampai 50 persen, tanpa perubahan warna latar.
- Teks tombol tidak pernah diakhiri panah.

### Chips
- **Style:** pil penuh, tinggi 44px, garis 1px `#D1D5DB`, latar putih.
- **State:** aktif berarti latar `#0F6E56` dan teks putih, dengan `aria-pressed`. Jumlah lokasi yang cocok muncul di kanan label dalam abu kecil.
- Chip tidak pernah diberi nomor urut. Ketiganya setara, bukan sebuah urutan.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** putih; blok catatan memakai `#F9FAFB`.
- **Shadow Strategy:** hanya kartu yang melayang di atas peta yang berbayang. Sisanya bergaris.
- **Border:** 1px `#E5E7EB`.
- **Internal Padding:** 16px.

### Inputs / Fields
- **Style:** garis 1px `#9CA3AF`, radius 4px, padding 10px 12px, ukuran teks 16px.
- **Focus:** cincin `2px solid #0F6E56` offset 2px. Caret memakai warna merek.
- **Error:** pesan di bawah field dengan warna `#E24B4A` dan `role="alert"`. Kalimatnya menyebut masalah sekaligus jalan keluarnya.
- Checkbox memakai `accent-color` hijau merek, ukuran 20px.

### Navigation
Tidak ada bilah navigasi global. Peta adalah rumah. Setiap halaman lain menyediakan satu jalan pulang bertuliskan "Kembali ke peta" dalam teks 14px berbobot medium, ditempatkan di kiri atas halaman.

### Penanda skor (komponen tanda tangan)
Tombol lingkaran 44px berisi angka skor 15px bobot 700 dengan angka sejajar. Dirender MapLibre di luar pohon Vue, jadi gayanya global di `main.css`. Nama aksesibelnya menyebut nama tempat, skor, dan label tingkatnya, misalnya "Blok M Plaza, skor 50 dari 100, Sebagian ramah". Hover menaikkan skala 1.09, terpilih 1.18, keduanya dengan easing keluar eksponensial 140ms dan dimatikan saat `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** pakai hijau, amber, dan merah hanya untuk mengkodekan skor aksesibilitas.
- **Do** biarkan angka skor jadi elemen terbesar di kartu dan halaman detail, tanpa ornamen di sekelilingnya.
- **Do** bedakan status verifikasi lewat bentuk penanda, terisi versus berongga, bukan lewat warna saja.
- **Do** beri tinggi minimum 44px pada setiap kontrol yang diketuk di ponsel.
- **Do** pakai simbol aksesibilitas standar internasional apa adanya, dengan `title` atau teks pembaca layar yang menyebut artinya.
- **Do** tulis pesan error dalam bahasa Indonesia sederhana yang menyebut masalah dan jalan keluarnya.
- **Do** pakai `tabular-nums` pada setiap angka yang bisa berubah.

### Don't:
- **Don't** menaruh label eyebrow huruf kapital di atas heading mana pun.
- **Don't** memberi nomor 01/02/03 pada isi yang bukan urutan langkah. Tiga chip kebutuhan bukan urutan.
- **Don't** memberi warna berbeda pada tiap ikon fasilitas. Ikon tetap netral.
- **Don't** menyeragamkan radius dan bayangan di semua kartu. Radius membawa informasi jenis elemen.
- **Don't** memakai titik tengah sebagai pemisah meta, seperti "Mal · 50 · Terverifikasi".
- **Don't** menaruh panah di ujung teks tombol.
- **Don't** memakai font kedua untuk heading. Satu keluarga, Public Sans, untuk semuanya.
- **Don't** memasang halaman pembuka berisi judul besar dan tombol sebelum peta muncul.
