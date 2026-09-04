-- seed-demo.sql — DATA CONTOH, BUKAN HASIL SURVEI
--
-- Tujuannya cuma satu: mengisi peta supaya tampilan penanda, filter, kartu ringkas,
-- dan halaman detail bisa diuji sebelum data lapangan Husein masuk.
--
-- Koordinat versi pertama DIKETIK TANGAN, bukan hasil geocoding, dan ketiganya
-- meleset. Sekarang ketiganya diambil dari simpul OpenStreetMap lalu diperiksa
-- balik lewat reverse geocoding, rinciannya di komentar blok koreksi di bawah.
-- Isi checklist tetap TIDAK diverifikasi di lokasi.
-- Setiap baris membawa catatan yang menyatakan itu, dan `created_by` sengaja NULL
-- supaya tidak ada warga yang seolah-olah bertanggung jawab atas data ini.
--
-- KAPAN DIHAPUS: di langkah PALING AKHIR, setelah data survei asli dari Husein
-- sudah masuk cukup banyak. Jangan lebih cepat dari itu. Selama data survei belum
-- ada, tiga baris inilah yang menjaga tautan hosting tidak terlihat kosong bagi
-- siapa pun yang membukanya sebelum hari pengumpulan, termasuk juri yang mengecek
-- lebih awal. Perintah hapusnya ada di bagian bawah file, sengaja dikomentari.
--
-- Jalankan di Supabase SQL Editor, setelah schema.sql dan schema-patch.sql.

begin;

-- Id tetap supaya bisa dijalankan ulang tanpa menumpuk baris kembar,
-- dan supaya perintah hapus di bawah presisi.
insert into locations (id, nama, kategori, lat, lng, status, created_by) values
  ('11111111-1111-4111-8111-111111111111', 'Stasiun MRT Blok M',                'stasiun',           -6.24444, 106.79812, 'terverifikasi',        null),
  ('22222222-2222-4222-8222-222222222222', 'Blok M Plaza',                      'mal',               -6.24431, 106.79764, 'belum_terverifikasi',  null),
  ('33333333-3333-4333-8333-333333333333', 'Kantor Kecamatan Kebayoran Baru',   'kantor_pemerintah', -6.24008, 106.78861, 'belum_terverifikasi',  null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Koreksi koordinat untuk baris yang sudah terlanjur masuk.
--
-- Insert di atas memakai `on conflict do nothing`, jadi baris yang sudah ada tidak
-- ikut berubah. Tanpa blok ini, memperbaiki angka di atas tidak memperbaiki apa pun
-- di basis data yang sedang berjalan.
--
-- Ketiga titik lama diketik tangan dan tidak satu pun jatuh di gedung yang benar.
-- Diperiksa dengan reverse geocoding Nominatim, dan hasilnya:
--
--   lama -6.24180, 106.79690  ->  SMA Negeri 70 Jakarta        (bukan kantor kecamatan)
--   lama -6.24400, 106.79830  ->  Jalan Panglima Polim Raya    (badan jalan, bukan stasiun)
--   lama -6.24430, 106.79950  ->  Shinhan Bank                 (bukan mal)
--
-- Titik baru diambil dari simpul OSM yang namanya cocok, lalu diperiksa balik:
--
--   -6.24444, 106.79812  ->  building/train_station  Stasiun MRT Blok M BCA
--   -6.24431, 106.79764  ->  shop/mall               Plaza Blok M
--   -6.24008, 106.78861  ->  office/government       Kantor Camat Kebayoran Baru
-- ---------------------------------------------------------------------------
update locations set lat = -6.24444, lng = 106.79812 where id = '11111111-1111-4111-8111-111111111111';
update locations set lat = -6.24431, lng = 106.79764 where id = '22222222-2222-4222-8222-222222222222';
update locations set lat = -6.24008, lng = 106.78861 where id = '33333333-3333-4333-8333-333333333333';

-- Skor tidak diisi manual. Trigger hitung_skor_lokasi() yang menghitungnya dari
-- baris di bawah ini, jadi seed ini sekaligus menguji trigger itu benar jalan.
insert into accessibility_checklist
  (location_id, ramp_tersedia, lebar_pintu_cukup, toilet_difabel, parkir_difabel,
   lift_tersedia_berfungsi, guiding_block_tersambung, tempat_duduk_tersedia,
   permukaan_jalan_rata, catatan)
values
  -- 7 dari 8 terpenuhi, skor 88, tingkat baik
  ('11111111-1111-4111-8111-111111111111',
   true, true, true, false, true, true, true, true,
   'DATA CONTOH, belum disurvei di lokasi. Dipakai hanya untuk menguji tampilan.'),

  -- 4 dari 8 terpenuhi, skor 50, tingkat sedang
  ('22222222-2222-4222-8222-222222222222',
   true, true, true, false, true, false, false, false,
   'DATA CONTOH, belum disurvei di lokasi. Dipakai hanya untuk menguji tampilan.'),

  -- 2 dari 8 terpenuhi, skor 25, tingkat kurang
  ('33333333-3333-4333-8333-333333333333',
   false, true, false, false, false, false, true, false,
   'DATA CONTOH, belum disurvei di lokasi. Dipakai hanya untuk menguji tampilan.')
on conflict (location_id) do nothing;

commit;

-- Cek hasilnya. Harusnya 88, 50, dan 25, dihitung trigger, bukan diisi tangan.
select nama, skor, status from locations order by skor desc;


-- ---------------------------------------------------------------------------
-- HAPUS SEBELUM SUBMISSION
-- Jalankan blok ini setelah data asli Husein masuk. Checklist ikut terhapus
-- lewat on delete cascade.
-- ---------------------------------------------------------------------------
-- delete from locations where id in (
--   '11111111-1111-4111-8111-111111111111',
--   '22222222-2222-4222-8222-222222222222',
--   '33333333-3333-4333-8333-333333333333'
-- );
