-- seed-demo.sql — DATA CONTOH, BUKAN HASIL SURVEI
--
-- Tujuannya cuma satu: mengisi peta supaya tampilan penanda, filter, kartu ringkas,
-- dan halaman detail bisa diuji sebelum data lapangan Husein masuk.
--
-- Koordinat hanya perkiraan. Isi checklist TIDAK diverifikasi di lokasi.
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
  ('11111111-1111-4111-8111-111111111111', 'Stasiun MRT Blok M',                'stasiun',           -6.24400, 106.79830, 'terverifikasi',        null),
  ('22222222-2222-4222-8222-222222222222', 'Blok M Plaza',                      'mal',               -6.24430, 106.79950, 'belum_terverifikasi',  null),
  ('33333333-3333-4333-8333-333333333333', 'Kantor Kecamatan Kebayoran Baru',   'kantor_pemerintah', -6.24180, 106.79690, 'belum_terverifikasi',  null)
on conflict (id) do nothing;

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
