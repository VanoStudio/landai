-- schema-patch-2.sql — TAMBALAN KEAMANAN
--
-- Jalankan di Supabase SQL Editor setelah schema.sql dan schema-patch.sql.
-- Aman dijalankan berulang: setiap kebijakan dijatuhkan lebih dulu, dan seluruh
-- berkas dibungkus satu transaksi, jadi tidak ada keadaan setengah jadi.
--
-- ---------------------------------------------------------------------------
-- TEMUAN PENGUKURAN, bukan pembacaan berkas.
--
-- Basis data yang sedang berjalan diuji dengan akun sungguhan sebelum tambalan
-- ini ditulis. Hasilnya:
--
--   accessibility_checklist  update oleh bukan pemilik  ->  200, nol baris berubah
--   accessibility_checklist  insert oleh bukan pemilik  ->  403, kode 42501
--   locations                update oleh bukan pemilik  ->  200, nol baris berubah
--   profiles                 update oleh bukan pemilik  ->  200, nol baris berubah
--   location_photos          insert ke lokasi orang lain ->  201, BARIS MASUK
--
-- Jadi lubang pada accessibility_checklist SUDAH tertutup oleh schema-patch.sql.
-- Yang masih terbuka adalah lubang dengan pola yang persis sama pada
-- location_photos: siapa pun yang punya akun bisa menempelkan alamat gambar
-- sembarangan ke lokasi milik siapa pun, dan karena tidak ada kebijakan delete,
-- baris itu tidak bisa ditarik kembali lewat aplikasi. Foto pertama sebuah lokasi
-- dipakai sebagai gambar di kartu ringkas dan panel daftar, jadi dampaknya
-- langsung terlihat oleh semua pengunjung.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. accessibility_checklist: menutup celah pemindahan baris.
--
-- Kebijakan lama hanya punya USING. Ketika WITH CHECK dihilangkan, Postgres
-- memakai ulang USING untuk keduanya, jadi keamanannya sudah benar. Ditulis
-- eksplisit di sini supaya maksudnya terbaca tanpa perlu tahu aturan bawaan itu.
--
-- USING sengaja TIDAK diubah menjadi true. Dengan USING true, galatnya memang
-- menjadi 42501 yang lebih jelas terbaca, tetapi lubang baru terbuka: bukan
-- pemilik bisa menjalankan update yang memindahkan location_id baris korban ke
-- lokasi miliknya sendiri. USING gating baris lama, WITH CHECK gating baris baru,
-- dan keduanya harus menuntut kepemilikan.
--
-- Konsekuensinya penolakan update berbentuk "nol baris berubah", bukan 42501.
-- Itu memang perilaku RLS Postgres: 42501 hanya muncul saat WITH CHECK gagal,
-- sedangkan baris yang tidak lolos USING sama sekali tidak terlihat oleh update.
-- ---------------------------------------------------------------------------
drop policy if exists "user login bisa update checklist" on accessibility_checklist;
drop policy if exists "hanya pemilik lokasi bisa update checklist" on accessibility_checklist;

create policy "hanya pemilik lokasi bisa update checklist"
  on accessibility_checklist for update
  using (
    exists (
      select 1 from locations
      where locations.id = accessibility_checklist.location_id
        and locations.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from locations
      where locations.id = accessibility_checklist.location_id
        and locations.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. location_photos: lubang yang sesungguhnya masih terbuka.
--
-- Kebijakan lama hanya menuntut pengguna sudah masuk, sama persis dengan pola
-- yang dulu ada pada checklist. Diganti menjadi kepemilikan lokasi.
-- ---------------------------------------------------------------------------
drop policy if exists "user login bisa upload foto" on location_photos;
drop policy if exists "hanya pemilik lokasi bisa tambah foto" on location_photos;

create policy "hanya pemilik lokasi bisa tambah foto"
  on location_photos for insert
  with check (
    exists (
      select 1 from locations
      where locations.id = location_photos.location_id
        and locations.created_by = auth.uid()
    )
  );

-- Tanpa kebijakan delete, baris foto yang salah masuk tidak bisa ditarik lagi
-- oleh pemiliknya sendiri, bahkan lewat aplikasi. Sama alasannya dengan
-- kebijakan hapus lokasi di schema-patch.sql.
drop policy if exists "hanya pemilik lokasi bisa hapus foto" on location_photos;

create policy "hanya pemilik lokasi bisa hapus foto"
  on location_photos for delete
  using (
    exists (
      select 1 from locations
      where locations.id = location_photos.location_id
        and locations.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Storage: berkas yang menempel di folder lokasi orang lain.
--
-- Jalur unggahan berbentuk <id lokasi>/<cap waktu>-<urutan>.jpg, jadi segmen
-- folder pertama adalah id lokasinya. Kebijakan lama hanya menuntut pengguna
-- sudah masuk, sehingga berkas bisa ditulis ke folder lokasi siapa pun. Tanpa
-- baris di location_photos berkas itu tidak tampil di aplikasi, tapi ia tetap
-- memakan kuota penyimpanan dan tetap bisa dijangkau lewat alamat publiknya.
-- ---------------------------------------------------------------------------
drop policy if exists "user login bisa upload foto lokasi" on storage.objects;
drop policy if exists "hanya pemilik lokasi bisa upload foto lokasi" on storage.objects;

create policy "hanya pemilik lokasi bisa upload foto lokasi"
  on storage.objects for insert
  with check (
    bucket_id = 'location-photos'
    and exists (
      select 1 from public.locations
      where locations.id::text = (storage.foldername(name))[1]
        and locations.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Membersihkan baris bukti.
--
-- Lubang location_photos dibuktikan dengan benar-benar menyisipkan satu baris
-- memakai akun uji, karena membaca berkas kebijakan saja tidak membuktikan apa
-- yang berlaku di basis data. Baris itu menempel pada lokasi Stasiun MRT Blok M
-- dan tidak bisa dihapus lewat aplikasi justru karena kebijakan delete belum ada.
-- Dihapus di sini.
-- ---------------------------------------------------------------------------
delete from location_photos where photo_url like 'https://contoh.invalid/%';

commit;

-- ---------------------------------------------------------------------------
-- Pemeriksaan setelah tambalan.
-- ---------------------------------------------------------------------------

-- a. Tidak boleh ada kebijakan yang hanya menuntut "sudah masuk" pada tabel
--    yang datanya dimiliki seseorang. Hasil yang diharapkan: nol baris.
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('locations', 'accessibility_checklist', 'location_photos')
  and cmd in ('INSERT', 'UPDATE', 'DELETE')
  and coalesce(qual, '') || coalesce(with_check, '') like '%auth.uid() IS NOT NULL%';

-- b. Baris bukti sudah hilang. Hasil yang diharapkan: nol baris.
select id, location_id, photo_url from location_photos
where photo_url like 'https://contoh.invalid/%';

-- c. Daftar kebijakan tulis yang sekarang berlaku, untuk dibaca sekilas.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'DELETE')
order by tablename, cmd;
