-- schema-patch-5.sql — SIAPA PUN BOLEH MEMPERBARUI KONDISI FASILITAS
--
-- Jalankan di Supabase SQL Editor setelah schema-patch-4.sql. Aman dijalankan
-- berulang: kebijakan lama dijatuhkan lebih dulu, kolom memakai if not exists, dan
-- seluruh berkas dibungkus satu transaksi.
--
-- ---------------------------------------------------------------------------
-- PELONGGARAN INI DISENGAJA, BUKAN REGRESI.
--
-- schema-patch-2.sql sengaja mempersempit kebijakan update pada
-- accessibility_checklist menjadi hanya pemilik lokasi, karena sebelumnya kebijakan
-- itu hanya menuntut "sudah masuk" dan itu adalah celah: siapa pun bisa mengubah
-- skor lokasi siapa pun tanpa jejak apa pun, dan tanpa akibat apa pun.
--
-- Sekarang kebijakan itu dilonggarkan kembali, tetapi celahnya TIDAK dikembalikan.
-- Tiga hal yang membedakannya dari keadaan lama:
--
--   1. Ada jejak. Setiap pembaruan mengisi locations.updated_by dengan auth.uid()
--      pelakunya dan updated_at dengan waktunya, diisi pemicu di basis data, bukan
--      dikirim peramban, jadi tidak bisa dipalsukan.
--   2. Ada akibat. Setiap pembaruan menurunkan status kembali ke belum terverifikasi
--      dan menghapus konfirmasi lama, lewat pemicu on_checklist_edit dari
--      schema-patch-3.sql. Jadi data yang diubah orang lain harus lulus pemeriksaan
--      komunitas lagi dari nol.
--   3. Batasnya jelas. Yang dibuka hanya KONDISI fasilitas. Nama, kategori, dan
--      koordinat tetap milik pembuatnya, karena mengubah identitas atau posisi sebuah
--      lokasi jauh lebih rawan disalahgunakan daripada memperbarui kondisinya.
--
-- ---------------------------------------------------------------------------
-- KEADAAN SEBELUM TAMBALAN INI, DIUKUR BUKAN DIDUGA.
--
-- Dijalankan pada basis data yang sedang berjalan memakai akun uji sungguhan:
--
--   locations                 kolom updated_by / updated_at   ->  BELUM ADA
--   accessibility_checklist   update oleh bukan pemilik       ->  200, nol baris
--   locations                 update nama oleh bukan pemilik  ->  200, nol baris
--   location_photos           insert oleh bukan pemilik       ->  403, kode 42501
--
-- Jadi tambalan 2, 3, dan 4 memang sudah terpasang, dan titik berangkatnya benar.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. Jejak pembaruan.
--
-- Sengaja tidak diberi nilai bawaan dan tidak diisi saat baris dibuat. Lokasi yang
-- belum pernah diperbarui sejak dibuat harus tetap kosong di sini, supaya halaman
-- detail bisa membedakan "ditambahkan oleh" dari "terakhir diperbarui oleh" tanpa
-- membandingkan cap waktu yang selisihnya semilidetik.
-- ---------------------------------------------------------------------------
alter table locations add column if not exists updated_by uuid references profiles(id);
alter table locations add column if not exists updated_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Pemicu penghitung skor sekaligus pencatat jejak.
--
-- Kolom updated_by dan updated_at TIDAK boleh ditulis dari peramban, dan memang
-- tidak bisa: hak update kolom pada locations sudah dicabut di schema-patch-3.sql dan
-- hanya diberikan untuk nama, kategori, lat, dan lng. Fungsi ini berjalan sebagai
-- security definer, jadi ia satu-satunya jalan yang tersisa untuk mengisinya.
--
-- auth.uid() tetap terbaca di dalam security definer, karena ia membaca klaim JWT
-- dari pengaturan sesi, bukan dari identitas pemilik fungsi.
--
-- Dua penjagaan yang penting:
--
--   a. Jejak hanya dicatat pada UPDATE, tidak pada INSERT. Mengisinya saat baris
--      pertama dibuat akan membuat setiap lokasi baru langsung tampak "sudah pernah
--      diperbarui" oleh pembuatnya sendiri.
--   b. Jejak hanya ditulis kalau auth.uid() ada isinya. Perawatan lewat SQL Editor
--      berjalan tanpa JWT, dan tanpa penjagaan ini satu perintah perbaikan massal
--      akan menghapus catatan siapa yang benar-benar terakhir memperbarui data.
-- ---------------------------------------------------------------------------
create or replace function public.hitung_skor_lokasi()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  total int;
  pelaku uuid;
begin
  total := (
    (new.ramp_tersedia)::int +
    (new.lebar_pintu_cukup)::int +
    (new.toilet_difabel)::int +
    (new.parkir_difabel)::int +
    (new.lift_tersedia_berfungsi)::int +
    (new.guiding_block_tersambung)::int +
    (new.tempat_duduk_tersedia)::int +
    (new.permukaan_jalan_rata)::int
  );

  pelaku := auth.uid();

  if tg_op = 'UPDATE' and pelaku is not null then
    update locations
    set skor = round((total * 100.0 / 8)::numeric),
        updated_by = pelaku,
        updated_at = now()
    where id = new.location_id;
  else
    update locations
    set skor = round((total * 100.0 / 8)::numeric)
    where id = new.location_id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Kebijakan update daftar periksa: siapa pun yang sudah masuk.
-- ---------------------------------------------------------------------------
drop policy if exists "user login bisa update checklist" on accessibility_checklist;
drop policy if exists "hanya pemilik lokasi bisa update checklist" on accessibility_checklist;
drop policy if exists "siapa pun yang masuk bisa perbarui checklist" on accessibility_checklist;

create policy "siapa pun yang masuk bisa perbarui checklist"
  on accessibility_checklist for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- 4. Lubang yang ikut terbuka bersama pelonggaran itu, dan cara menutupnya.
--
-- Dengan kebijakan update yang hanya menuntut "sudah masuk", satu perintah ini
-- menjadi mungkin bagi siapa saja:
--
--   update accessibility_checklist
--   set location_id = '<lokasi milik penyerang>'
--   where location_id = '<lokasi korban>';
--
-- USING lolos karena penyerang sudah masuk, WITH CHECK juga lolos karena syaratnya
-- sama. Akibatnya baris daftar periksa korban BERPINDAH ke lokasi penyerang: korban
-- kehilangan seluruh datanya, dan penyerang mendapat skor yang bukan miliknya.
-- Pelonggaran yang diminta adalah pada ISI daftar periksa, bukan pada kepemilikan
-- barisnya, jadi yang perlu dikunci adalah satu kolom, bukan seluruh kebijakan.
--
-- RLS bekerja per baris dan tidak bisa membedakan kolom, jadi jawabannya hak akses
-- kolom. Hak tingkat tabel dicabut lebih dulu, karena hak tingkat tabel tidak bisa
-- dipersempit oleh pencabutan tingkat kolom.
--
-- Catatan pemeliharaan: kolom baru pada accessibility_checklist tidak akan bisa
-- diperbarui klien sampai ditambahkan ke daftar grant di bawah ini.
-- ---------------------------------------------------------------------------
revoke update on public.accessibility_checklist from authenticated, anon;

grant update (
  ramp_tersedia,
  lebar_pintu_cukup,
  toilet_difabel,
  parkir_difabel,
  lift_tersedia_berfungsi,
  guiding_block_tersambung,
  tempat_duduk_tersedia,
  permukaan_jalan_rata,
  catatan
) on public.accessibility_checklist to authenticated;

-- Ditegaskan ulang di sini supaya berkas ini tetap benar walau dijalankan pada basis
-- data yang belum menerima schema-patch-3.sql. Kolom updated_by dan updated_at
-- sengaja TIDAK ikut diberikan.
revoke update on public.locations from authenticated, anon;
grant update (nama, kategori, lat, lng) on public.locations to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Foto: siapa pun yang masuk boleh menambahkan bukti.
--
-- schema-patch-2.sql mempersempit ini menjadi pemilik saja, satu paket dengan
-- daftar periksa. Karena daftar periksanya dibuka, fotonya harus ikut dibuka: bukti
-- foto tanpa daftar periksa, atau sebaliknya, hanya setengah pembaruan.
--
-- Tetapi lubang yang dulu ditutup bersamanya tidak boleh ikut terbuka. Kolom
-- photo_url adalah teks bebas, jadi tanpa penjagaan siapa pun bisa menempelkan
-- alamat gambar mana pun di internet ke lokasi mana pun, dan gambar itu akan tampil
-- sebagai foto kondisi lokasi di kartu ringkas dan panel daftar.
--
-- Karena itu alamatnya dibatasi pada bentuk alamat publik bucket Storage proyek ini.
-- Polanya diikat di awal string dan hanya menerima subdomain supabase.co, jadi
-- alamat milik siapa pun di luar itu ditolak. Nama proyek sengaja tidak ditulis di
-- sini supaya berkas ini tetap bisa dipakai pada proyek lain.
-- ---------------------------------------------------------------------------
drop policy if exists "user login bisa upload foto" on location_photos;
drop policy if exists "hanya pemilik lokasi bisa tambah foto" on location_photos;
drop policy if exists "siapa pun yang masuk bisa tambah foto" on location_photos;

create policy "siapa pun yang masuk bisa tambah foto"
  on location_photos for insert
  with check (
    auth.uid() is not null
    and photo_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/location-photos/'
    and exists (select 1 from locations where locations.id = location_photos.location_id)
  );

-- Menghapus foto tetap hanya untuk pemilik lokasi. Menambahkan bukti adalah menambah
-- informasi, menghapusnya adalah menghilangkan informasi, dan keduanya tidak setara
-- risikonya. Kebijakan ini sudah ada dari schema-patch-2.sql, ditulis ulang di sini
-- supaya keadaannya utuh walau berkas ini dijalankan sendirian.
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
-- 6. Storage: berkas fotonya sendiri.
--
-- Tanpa ini, kebijakan location_photos di atas tidak ada gunanya: barisnya boleh
-- masuk tetapi berkasnya tidak pernah bisa diunggah, jadi alamat yang tercatat
-- menunjuk ke berkas yang tidak ada.
--
-- Segmen folder pertama tetap harus id lokasi yang benar-benar ada, jadi berkas
-- tidak bisa ditaruh di folder karangan.
-- ---------------------------------------------------------------------------
drop policy if exists "user login bisa upload foto lokasi" on storage.objects;
drop policy if exists "hanya pemilik lokasi bisa upload foto lokasi" on storage.objects;
drop policy if exists "siapa pun yang masuk bisa upload foto lokasi" on storage.objects;

create policy "siapa pun yang masuk bisa upload foto lokasi"
  on storage.objects for insert
  with check (
    bucket_id = 'location-photos'
    and auth.uid() is not null
    and exists (
      select 1 from public.locations
      where locations.id::text = (storage.foldername(name))[1]
    )
  );

commit;

-- ---------------------------------------------------------------------------
-- Pemeriksaan setelah tambalan.
-- ---------------------------------------------------------------------------

-- a. Kolom jejak sudah ada, dan belum terisi apa pun karena belum ada pembaruan.
select id, nama, updated_by, updated_at from locations order by nama;

-- b. Hak update kolom pada accessibility_checklist. Yang diharapkan: sembilan kolom
--    isi, dan location_id TIDAK muncul.
select column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'accessibility_checklist'
  and privilege_type = 'UPDATE' and grantee = 'authenticated'
order by column_name;

-- c. Hak update kolom pada locations. Yang diharapkan: hanya nama, kategori, lat,
--    lng. updated_by dan updated_at TIDAK boleh muncul.
select column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'locations'
  and privilege_type = 'UPDATE' and grantee = 'authenticated'
order by column_name;

-- d. Kebijakan tulis yang berlaku sekarang.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'DELETE')
order by tablename, cmd, policyname;
