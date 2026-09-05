# Audit keamanan landai

Tanggal audit: 5 September 2026
Sasaran: aplikasi landai beserta basis data Supabase dan penyimpanan fotonya
Sifat: pemeriksaan verifikasi terhadap pertahanan yang sudah dibangun, bukan pengembangan fitur
Perubahan pada repo maupun data selama audit: **nihil**

> **Catatan redaksi.** Berkas ini sengaja tidak memuat satu pun nilai rahasia: tanpa
> kunci API, tanpa alamat proyek, tanpa kredensial. Untuk satu temuan yang belum
> selesai ditangani, yaitu Temuan 1, lokasi persisnya juga tidak dicantumkan di sini,
> karena menuliskannya sama saja dengan memasang penunjuk arah. Detail lengkapnya
> sudah disampaikan langsung ke pemelihara repo. Bagian ini akan dilengkapi setelah
> kredensialnya diganti.

---

## Ringkasan

| # | Yang diperiksa | Status |
| --- | --- | --- |
| 1 | Row Level Security pada kelima tabel | **Aman** |
| 2 | Kunci rahasia di kode dan di riwayat commit | **Temuan 1, mendesak** |
| 3 | Kebijakan hapus pada bucket Storage | **Aman** |
| 4 | Pembatasan domain kunci MapTiler | **Temuan 2** |
| 5 | Perlindungan terhadap suntikan skrip | **Aman** |
| 6 | Penjaga rute dan batas kepemilikan | **Aman** |

**30 dari 30 pemeriksaan penegakan lolos.** Dua temuan yang tersisa keduanya hanya
bisa ditutup lewat dasbor pihak ketiga, bukan lewat perubahan kode.

---

## Cara audit ini dikerjakan

Yang diuji **penegakan**, bukan konfigurasi. Bedanya penting.

Membaca berkas SQL hanya membuktikan aturannya pernah ditulis. Membaca katalog
Postgres hanya membuktikan aturannya terpasang. Keduanya tidak membuktikan aturan itu
benar-benar menahan permintaan yang sesungguhnya. Karena itu seluruh pemeriksaan di
bawah ini berupa permintaan HTTP nyata ke PostgREST dan ke Storage API, memakai kunci
publishable yang sama dengan yang dipakai peramban, lalu diperiksa apa yang terjadi.

Peran `anon` di Supabase memegang hak tabel bawaan. Artinya, kalau Row Level Security
mati pada sebuah tabel, `anon` akan bisa menulis ke tabel itu. Penolakan terhadap
`anon` karena itu sekaligus membuktikan RLS menyala dan kebijakannya benar, dua hal
sekaligus, tanpa perlu membaca katalog.

Setiap percobaan tulis dalam audit ini dirancang untuk gagal. Yang boleh berhasil
hanya operasi pada data buangan yang dibuat dan dihapus sendiri oleh skrip audit.
Percobaan terhadap data milik orang lain memakai nilai yang sama persis dengan nilai
yang sudah tersimpan, jadi seandainya sebuah kebijakan ternyata bocor pun, tidak ada
data yang benar-benar berubah.

---

## 1. Row Level Security pada kelima tabel

**Status: aman.**

| Tabel | Baca oleh anon | Tulis baris baru | Ubah baris | Hapus baris |
| --- | --- | --- | --- | --- |
| `profiles` | 200, disengaja | `401 42501` | 0 baris tersentuh | tidak berlaku |
| `locations` | 200, disengaja | `401 42501` | 0 baris tersentuh | 0 baris |
| `accessibility_checklist` | 200, disengaja | `401 42501` | tidak berlaku | tidak berlaku |
| `location_photos` | 200, disengaja | `401 42501` | tidak berlaku | 0 baris |
| `confirmations` | 200, disengaja | `401 42501` | tidak berlaku | 0 baris |

Baca publik pada kelima tabel adalah keputusan desain, bukan kelalaian: peta
aksesibilitas harus bisa dibuka tanpa akun, termasuk oleh orang yang justru paling
membutuhkannya. Tidak ada data pribadi di kelima tabel itu. Kolom `profiles.nama`
memang dimaksudkan tampil publik, dan halaman akun menyatakan hal itu secara terbuka
kepada penggunanya.

Kode `42501` dari PostgREST berarti klausa `WITH CHECK` menolak, atau hak kolom
menolak. Balasan `200` dengan nol baris berarti klausa `USING` menyaring barisnya
sampai habis. Keduanya sama-sama berarti permintaannya tidak berlaku.

### Pemeriksaan tingkat katalog

Audit ini berjalan dengan kunci publishable, dan katalog Postgres tidak diekspos ke
peran `anon`. Untuk melengkapi bukti di atas dengan bukti tingkat katalog, jalankan
kueri berikut di SQL Editor Supabase:

```sql
select tablename,
       rowsecurity as rls_menyala,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = t.tablename) as jumlah_kebijakan
from pg_tables t
where schemaname = 'public'
  and tablename in ('profiles','locations','accessibility_checklist','location_photos','confirmations')
order by tablename;

select tablename, policyname, cmd from pg_policies
where schemaname in ('public','storage') order by tablename, policyname;
```

Yang diharapkan: kelima baris bernilai `rls_menyala = true`, dan kueri kedua
mengembalikan 19 baris kebijakan.

---

## 2. Kunci rahasia di kode dan di riwayat commit

**Status: satu temuan mendesak, sisanya bersih.**

### Cara pemeriksaannya

Bukan pencarian pola tebakan. Setiap nilai rahasia yang ada di `.env` diambil satu per
satu, lalu dicari sebagai teks utuh di **seluruh objek yang pernah ada di riwayat git**,
yaitu 394 objek, bukan hanya di keadaan sekarang. Metode ini menemukan kebocoran
walaupun berkasnya sudah lama dihapus, karena objeknya tetap tinggal di riwayat.

| Nilai | Hasil |
| --- | --- |
| Kunci Supabase publishable | Tidak pernah muncul di objek mana pun |
| Kunci MapTiler | Tidak pernah muncul di objek mana pun |
| Alamat proyek Supabase | Muncul di satu skrip pengujian |
| Email akun uji | Muncul di riwayat, sudah tidak ada di HEAD |
| Sandi akun uji | Muncul di riwayat, sudah tidak ada di HEAD |

Berkas `.env` **tidak pernah sekali pun ter-commit**. Tidak ditemukan `service_role
key`, tidak ditemukan literal JWT, tidak ditemukan token layanan apa pun. Tiga
penyebutan kata `service_role` yang ada di repo seluruhnya sah: satu peringatan di
`SETUP.md` supaya kunci itu jangan dipakai, satu nama peran di dalam tiruan Postgres
untuk pengujian skema, dan satu pembacaan dari environment di `docs/qa/lib.mjs`.

### Temuan 1, mendesak: kredensial akun uji pernah ter-commit

**Ringkasan.** Kredensial sebuah akun uji, yaitu email beserta sandinya, pernah ditulis
langsung di dalam dua skrip pengujian pada masa awal repo ini. Keduanya sudah tidak ada
di keadaan sekarang, tetapi komit yang memuatnya masih terjangkau dari `origin/main`,
dan repo ini publik. Artinya siapa pun yang meng-clone repo mendapatkannya. Saat audit
dilakukan, kredensial itu masih berlaku.

**Batas dampaknya.** Akun tersebut pengguna biasa, bukan akun istimewa. Hak per kolom
yang sudah terpasang menutup kolom `skor`, `status`, dan `created_by`, jadi akun itu
tidak bisa memalsukan penilaian aksesibilitas, tidak bisa menaikkan status verifikasi,
dan tidak bisa merampas kepemilikan lokasi orang lain. Yang bisa dilakukannya sebatas
yang bisa dilakukan warga mana pun yang mendaftar sendiri: menambah lokasi, menyunting
lokasi miliknya, mengunggah foto. Tidak ada data pribadi yang bisa diambil, karena
memang tidak ada data pribadi tersimpan.

Yang tetap membuatnya mendesak: isi yang ditambahkan lewat akun itu muncul di peta
publik, dan peta itulah yang akan dibuka juri.

**Penanganan, berurutan:**

1. Buka Supabase, menu **Authentication, Users**, cari akun uji tersebut, ganti
   sandinya dengan sandi acak yang baru.
2. Perbarui nilai `AKUN_UJI_SANDI` di berkas `.env` lokal dengan sandi baru itu.
3. Setelah pengumpulan lomba selesai, hapus akun uji tersebut bersama akun retest lain
   yang sudah ada di daftar pembersihan.

**Yang sebaiknya tidak dilakukan: menulis ulang riwayat git lagi.** Nilai yang pernah
dipublikasikan tetap tinggal di clone, di fork, dan di cache pihak ketiga; menulis
ulang riwayat tidak menariknya kembali dari sana. Yang benar-benar mematikan nilai itu
adalah menggantinya. Menulis ulang riwayat menjelang pengumpulan juga membawa risiko
memutus tautan produksi tanpa memberi manfaat keamanan yang sepadan.

### Temuan ringan: alamat proyek ter-hardcode di satu skrip uji

Satu skrip pengujian menuliskan alamat proyek Supabase langsung di dalam berkasnya,
sementara dua puluh skrip lain membacanya dari `.env`. Nilai itu bukan rahasia, ia
memang ikut terkirim ke peramban setiap kali halaman dibuka. Jadi ini soal kerapian
dan konsistensi, bukan kebocoran. Tidak diubah dalam audit ini karena audit ini
memang tidak mengubah apa pun.

---

## 3. Kebijakan hapus pada bucket Storage

**Status: aman.** Tambalan `schema-patch-4.sql` terbukti benar-benar sudah dijalankan
di Supabase, bukan sekadar ada sebagai berkas di repo.

| Percobaan | Hasil |
| --- | --- |
| Pengunjung tanpa akun menghapus berkas | HTTP 400, ditolak |
| Pengunjung tanpa akun mengunggah berkas | HTTP 400, ditolak |
| Pemilik lokasi mengunggah ke foldernya sendiri | HTTP 200, diizinkan |
| Pemilik lokasi menghapus fotonya sendiri | HTTP 200, diizinkan |

Diuji memakai berkas gambar buangan berukuran satu piksel yang dibuat dan dihapus
sendiri oleh skrip audit, di dalam folder lokasi buangan yang juga dibuat dan dihapus
sendiri. Tidak ada foto milik siapa pun yang disentuh.

### Celah pembuktian yang perlu ditutup lewat katalog

Satu cabang kebijakan belum terbukti secara perilaku, yaitu **pengguna yang sudah masuk
tetapi bukan pemilik lokasi**. Membuktikannya memerlukan akun kedua, dan membuat akun
baru berarti mengubah keadaan sistem, sementara audit ini dijalankan dengan syarat
tidak mengubah apa pun.

Cabang itu dapat ditutup lewat kueri katalog pada bagian 1. Cari baris `pg_policies`
untuk `storage.objects` dengan `cmd = 'DELETE'`. Klausa `qual`-nya harus memuat dua
syarat yang digabung `OR`: pengunggah berkas itu sendiri, dan pemilik lokasi yang
foldernya bersangkutan. Kalau keduanya ada, cabang non-pemilik tertutup.

### Catatan: empat folder yatim di bucket

Bucket berisi empat folder yang lokasinya sudah tidak ada lagi di basis data, sisa dari
ronde pengujian sebelumnya. Masing-masing memuat satu berkas foto.

Bucket ini publik untuk dibaca, yang memang diperlukan supaya foto tampil di peta tanpa
akun. Konsekuensinya keempat berkas yatim itu masih dapat dibuka siapa saja lewat URL
langsung. Karena lokasinya sudah dihapus, tidak ada seorang pun yang berhak
menghapusnya lewat aplikasi, sebab kebijakan hapus menuntut kepemilikan lokasi yang
sudah tidak ada. Pembersihannya hanya bisa lewat dasbor Storage.

Isinya foto uji, bukan foto warga sungguhan. Prioritas rendah, dan sudah ada di daftar
pembersihan sebelum pengumpulan.

---

## 4. Pembatasan domain kunci MapTiler

**Status: temuan. Kunci tidak dibatasi.**

Kunci MapTiler ikut terkirim ke peramban setiap kali halaman peta dibuka. Itu tidak
terhindarkan untuk basemap yang dirender di sisi klien, dan berlaku untuk semua produk
sejenis. Karena itu satu-satunya pertahanan yang tersedia adalah membatasi kunci itu
hanya berlaku untuk domain tertentu. Pembatasan itu belum dipasang.

Diuji dengan meminta gaya peta memakai header `Origin` yang berbeda-beda:

| Asal permintaan | Balasan |
| --- | --- |
| Tanpa `Origin` sama sekali | HTTP 200 |
| Domain produksi yang sah | HTTP 200 |
| **Domain penyerang yang dikarang** | **HTTP 200, seharusnya 403** |
| `localhost` pengembangan | HTTP 200 |

Permintaan dari domain yang tidak ada hubungannya dengan proyek ini tetap dilayani
penuh beserta gaya peta lengkap. Kesimpulannya kunci itu dapat dipakai siapa saja yang
mengambilnya dari berkas JavaScript yang dikirim ke peramban.

**Dampaknya** kuota tier gratis terpakai oleh orang lain. Kalau kuota habis pada saat
penjurian, basemap tidak termuat. Peta tidak akan mati sepenuhnya karena aplikasi sudah
punya jatuh-balik otomatis ke raster OpenStreetMap ketika gaya MapTiler gagal, tetapi
tampilannya jelas menurun dari yang seharusnya.

**Penanganan, hanya bisa dilakukan pemegang akun MapTiler:** buka dasbor MapTiler, menu
**Keys**, pilih kunci yang dipakai proyek ini, lalu isi **Allowed origins** dengan
domain produksi aplikasi dan `http://localhost:3000` untuk pengembangan.

---

## 5. Perlindungan terhadap suntikan skrip

**Status: aman.**

Seluruh `app/` dan `server/` diperiksa. Hasilnya nol untuk semua jalur yang dapat
mengubah teks menjadi markup yang dieksekusi:

| Yang dicari | Ditemukan |
| --- | --- |
| `v-html` | 0 |
| `innerHTML` | 0 |
| `outerHTML` | 0 |
| `insertAdjacentHTML` | 0 |
| `document.write` | 0 |
| `eval` dan `new Function` | 0 |

Semua teks dari pengguna, termasuk nama tempat, nama tampilan, dan catatan kontributor,
ditampilkan lewat interpolasi Vue yang meng-escape secara bawaan.

Satu-satunya tempat di aplikasi ini yang menyusun DOM secara manual adalah penanda
peta, karena penanda itu dirender MapLibre di luar pohon komponen Vue. Penyusunannya
memakai `textContent` untuk angka skor dan `setAttribute` untuk label aksesibilitas.
Keduanya tidak pernah mem-parse HTML, jadi nama tempat yang berisi markup akan tampil
sebagai teks apa adanya, bukan dieksekusi.

### Alamat foto, satu-satunya atribut yang menerima nilai dari pengguna

Foto ditampilkan lewat `<img :src>`. Bentuk alamatnya dijaga di tingkat basis data,
bukan hanya di antarmuka, dan penjaganya diuji hidup dengan lima alamat bermusuhan:

| Alamat yang dicoba | Hasil |
| --- | --- |
| Skema `javascript:` | Ditolak, `403 42501` |
| `data:` berisi SVG dengan pemicu skrip | Ditolak, `403 42501` |
| Host asing sama sekali | Ditolak, `403 42501` |
| Subdomain palsu yang meniru akhiran domain resmi | Ditolak, `403 42501` |
| Bucket lain di proyek yang sama | Ditolak, `403 42501` |
| Alamat Storage yang sah | Diterima, `201` |

Penolakan pada baris keempat penting: itu tipuan yang meniru domain resmi sebagai
awalan lalu menyambungnya ke domain penyerang, dan pola pemeriksaan yang ditulis
ceroboh biasanya lolos di titik ini.

Tautan rute ke peta eksternal disusun dari koordinat bertipe `float8`, bukan dari teks
yang diketik pengguna, jadi tidak ada celah untuk menyisipkan skema `javascript:` ke
dalam `href`.

---

## 6. Penjaga rute dan batas kepemilikan

**Status: aman.**

### Penjaga rute, diuji di produksi tanpa akun

| Alamat yang dibuka | Hasil |
| --- | --- |
| Halaman tambah lokasi | Dialihkan ke halaman masuk |
| Halaman sunting lokasi dengan id lokasi nyata | Dialihkan ke halaman masuk |
| Halaman akun | Dialihkan ke halaman masuk |

### Pertahanan sesungguhnya, diuji langsung ke basis data

Penjaga rute hanya menahan orang yang lewat antarmuka. Yang menahan permintaan yang
dikirim langsung ke layanan adalah aturan di basis data, dan itu yang diuji di sini,
dengan melewati antarmuka sepenuhnya.

| Percobaan | Hasil |
| --- | --- |
| Pemilik mengubah `skor` lokasinya sendiri | `403 42501` |
| Pemilik mengubah `status` lokasinya sendiri | `403 42501` |
| Pemilik mengubah `created_by` lokasinya sendiri | `403 42501` |
| Pemilik mengubah `nama` lokasinya sendiri | 200, satu baris, memang diizinkan |
| Memindahkan baris daftar periksa ke lokasi lain | `403 42501` |
| Bukan pemilik mengubah `nama` lokasi orang lain | 0 baris tersentuh |
| Bukan pemilik mengubah `kategori` lokasi orang lain | 0 baris tersentuh |
| Bukan pemilik mengubah koordinat lokasi orang lain | 0 baris tersentuh |
| Bukan pemilik menghapus lokasi orang lain | 0 baris |
| Menyunting lokasi contoh yang tidak berpemilik | 0 baris tersentuh |

Tiga baris pertama layak diperhatikan: bahkan pemilik lokasi pun tidak bisa mengubah
skor maupun status lokasinya sendiri. Keduanya dihitung trigger basis data dari daftar
periksa dan dari konfirmasi warga lain, dan hak per kolom menutupnya dari klien mana
pun. Row Level Security bekerja per baris dan tidak bisa membatasi kolom, jadi yang
menutup ketiga kolom itu adalah pemberian hak per kolom, bukan kebijakan RLS.

---

## Daftar tindakan

| # | Temuan | Penanganan oleh | Kapan |
| --- | --- | --- | --- |
| 1 | Kredensial akun uji pernah ter-commit dan masih berlaku | Pemelihara, dasbor Supabase | Segera |
| 2 | Kunci MapTiler tanpa pembatasan domain | Pemelihara, dasbor MapTiler | Sebelum penjurian |
| 3 | Empat folder yatim di bucket Storage | Pemelihara, dasbor Storage | Rendah, sudah terdaftar |
| 4 | Alamat proyek ter-hardcode di satu skrip uji | Kerapian, bukan kebocoran | Tidak mendesak |

Temuan 1 dan 2 keduanya hanya bisa ditutup lewat dasbor pihak ketiga. Tidak ada
perubahan kode yang bisa menyelesaikannya, dan tidak ada perubahan kode yang dilakukan
dalam audit ini.

---

## Batas audit ini

Supaya laporan ini tidak dibaca lebih jauh dari yang sebenarnya dibuktikan:

- **Bukan uji penetrasi.** Tidak ada percobaan menembus autentikasi Supabase, tidak ada
  fuzzing, tidak ada uji beban.
- **Tidak menguji infrastruktur pihak ketiga.** Keamanan Supabase, Vercel, dan MapTiler
  sebagai layanan berada di luar cakupan.
- **Tidak menguji cabang non-pemilik pada penghapusan berkas Storage**, karena
  memerlukan akun kedua. Ditutup lewat kueri katalog, lihat bagian 3.
- **Tidak membaca katalog Postgres secara langsung**, karena audit dijalankan dengan
  kunci publishable, sama seperti yang dipegang peramban. Kueri pelengkapnya disediakan
  di bagian 1.
- **Menguji keadaan pada tanggal audit.** Kebijakan yang diubah setelahnya tentu tidak
  tercakup.

## Keadaan sistem setelah audit

- Repo: tidak ada satu berkas pun yang diubah.
- Basis data: jumlah lokasi kembali seperti semula, tabel foto tetap kosong, tidak ada
  baris audit yang tertinggal.
- Storage: berkas buangan yang dipakai menguji sudah dihapus, jumlah objek kembali
  seperti semula.
- Data milik pengguna lain: tidak ada yang berubah. Seluruh percobaan terhadapnya
  ditolak pada nol baris, dan nilainya pun sengaja disamakan dengan nilai tersimpan.
