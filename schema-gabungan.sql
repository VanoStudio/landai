-- ============================================================================
-- landai — skema database lengkap, satu berkas sekali jalan
-- ============================================================================
--
-- Salin SELURUH isi berkas ini ke SQL Editor Supabase pada proyek yang MASIH
-- KOSONG, lalu jalankan sekali. Hasilnya skema akhir yang lengkap: tabel,
-- fungsi, trigger, Row Level Security, hak akses per kolom, dan bucket Storage.
-- Tidak perlu menjalankan berkas lain satu per satu.
--
-- Berkas ini adalah penggabungan berurutan dari:
--
--   1. schema.sql          tabel inti, trigger skor, RLS pertama
--   2. schema-patch.sql    fungsi skor dan status, kebijakan pemilik, bucket Storage
--   3. schema-patch-2.sql  WITH CHECK eksplisit, foto milik pemilik, unggahan Storage
--   4. schema-patch-3.sql  hak update per kolom pada locations, reset verifikasi
--   5. schema-patch-4.sql  kebijakan hapus berkas di Storage
--   6. schema-patch-5.sql  kolom jejak updated_by/updated_at, checklist dibuka
--   7. schema-patch-6.sql  pengunggah foto tercatat, nama akun Google tidak hilang
--
-- Urutannya WAJIB seperti di atas. Tambalan belakangan menggantikan kebijakan
-- yang dibuat lebih awal, jadi menukar urutan menghasilkan skema yang berbeda.
--
-- Ketujuh berkas asli sengaja dipertahankan di repo sebagai riwayat bertahap,
-- lengkap dengan alasan tiap keputusan. Berkas gabungan ini tidak menggantikan
-- mereka, hanya memudahkan pemasangan dari nol.
--
-- TIDAK ikut digabung, dan memang bukan bagian dari skema:
--   - seed-demo.sql          data contoh untuk mengisi peta
--   - bersihkan-data-uji.sql pembersihan data sisa pengujian
--
-- Pernyataan `select` di akhir beberapa bagian adalah pemeriksaan, bukan
-- perubahan. Pada proyek kosong wajar kalau hasilnya nol baris.
--
-- Dijalankan sebagai peran `postgres` lewat SQL Editor, karena membuat trigger
-- pada `auth.users` dan kebijakan pada `storage.objects` perlu hak pemilik.
-- ============================================================================


-- ============================================================================
-- BAGIAN 1 dari 7 — dari schema.sql
-- ============================================================================

-- Jalankan seluruh isi file ini sekali di Supabase SQL Editor

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text,
  created_at timestamptz default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  kategori text not null check (kategori in ('stasiun', 'mal', 'kantor_pemerintah', 'taman', 'kesehatan', 'lainnya')),
  lat float8 not null,
  lng float8 not null,
  skor int default 0,
  status text not null default 'belum_terverifikasi' check (status in ('belum_terverifikasi', 'terverifikasi')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table accessibility_checklist (
  location_id uuid primary key references locations(id) on delete cascade,
  ramp_tersedia bool default false,
  lebar_pintu_cukup bool default false,
  toilet_difabel bool default false,
  parkir_difabel bool default false,
  lift_tersedia_berfungsi bool default false,
  guiding_block_tersambung bool default false,
  tempat_duduk_tersedia bool default false,
  permukaan_jalan_rata bool default false,
  catatan text
);

create table location_photos (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz default now()
);

create table confirmations (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  user_id uuid not null references profiles(id),
  is_accurate bool not null,
  created_at timestamptz default now(),
  unique (location_id, user_id)
);

-- Fungsi dan trigger biar profil otomatis dibuat begitu ada user baru daftar
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nama)
  values (new.id, new.raw_user_meta_data->>'nama');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Fungsi hitung skor otomatis tiap checklist berubah
create function public.hitung_skor_lokasi()
returns trigger
language plpgsql
as $$
declare
  total int;
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
  update locations set skor = round((total::float / 8) * 100) where id = new.location_id;
  return new;
end;
$$;

create trigger on_checklist_upsert
  after insert or update on accessibility_checklist
  for each row execute procedure public.hitung_skor_lokasi();

-- Row Level Security
alter table profiles enable row level security;
alter table locations enable row level security;
alter table accessibility_checklist enable row level security;
alter table location_photos enable row level security;
alter table confirmations enable row level security;

create policy "profiles bisa dibaca siapa saja" on profiles for select using (true);
create policy "user cuma bisa update profil sendiri" on profiles for update using (auth.uid() = id);

create policy "locations bisa dibaca siapa saja" on locations for select using (true);
create policy "user login bisa tambah lokasi" on locations for insert with check (auth.uid() = created_by);
create policy "user cuma bisa update lokasi sendiri" on locations for update using (auth.uid() = created_by);

create policy "checklist bisa dibaca siapa saja" on accessibility_checklist for select using (true);
create policy "user login bisa insert checklist" on accessibility_checklist for insert with check (auth.uid() is not null);
create policy "user login bisa update checklist" on accessibility_checklist for update using (auth.uid() is not null);

create policy "foto bisa dibaca siapa saja" on location_photos for select using (true);
create policy "user login bisa upload foto" on location_photos for insert with check (auth.uid() is not null);

create policy "konfirmasi bisa dibaca siapa saja" on confirmations for select using (true);
create policy "user login bisa konfirmasi" on confirmations for insert with check (auth.uid() = user_id);

-- ============================================================================
-- BAGIAN 2 dari 7 — dari schema-patch.sql
-- ============================================================================

-- schema-patch.sql
-- Jalankan di Supabase SQL Editor, setelah schema.sql.
-- Isinya tiga perbaikan bug + policy Storage. Aman dijalankan ulang (idempoten).

-- Seluruh isi berkas ini dijalankan sebagai satu transaksi. Kalau ada satu
-- pernyataan gagal, tidak ada yang tertinggal separuh jalan.
begin;

-- ---------------------------------------------------------------------------
-- PATCH 1a (M3): hitung_skor_lokasi() harus SECURITY DEFINER.
-- Masalah: fungsi ini menjalankan UPDATE ke locations, jadi tunduk RLS pemanggil.
-- Kalau user B mengisi checklist lokasi milik user A, UPDATE-nya kena filter RLS:
-- tidak melempar error, tapi skor diam-diam tidak pernah ter-update.
--
-- PATCH 1b: pembulatan harus lewat numeric, bukan float8.
-- round() pada float8 di Postgres membulatkan setengah ke genap, sedangkan
-- Math.round() di browser membulatkan setengah ke atas. Karena checklist berisi
-- delapan item, setiap jumlah ganjil mendarat tepat di 0,5 (12,5 / 37,5 / 62,5 /
-- 87,5), sehingga pratinjau skor yang dilihat kontributor bisa berbeda satu angka
-- dari yang tersimpan. Pada 62,5 selisih itu bahkan melompati ambang warna:
-- pratinjau 63 hijau, tersimpan 62 amber. Cast ke numeric membulatkan setengah
-- menjauh dari nol, sama persis dengan browser.
-- ---------------------------------------------------------------------------
create or replace function public.hitung_skor_lokasi()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  total int;
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
  update locations set skor = round((total * 100.0 / 8)::numeric) where id = new.location_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- PATCH 2 (M4): status 'terverifikasi' tidak pernah dinaikkan oleh apa pun.
-- PRD bagian 8 mensyaratkannya. Ambang: 3 konfirmasi is_accurate = true.
-- Turun lagi kalau konfirmasi akurat berkurang di bawah ambang.
-- ---------------------------------------------------------------------------
create or replace function public.perbarui_status_lokasi()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  lokasi uuid;
  jumlah_akurat int;
begin
  lokasi := coalesce(new.location_id, old.location_id);

  select count(*) into jumlah_akurat
  from confirmations
  where location_id = lokasi and is_accurate = true;

  update locations
  set status = case when jumlah_akurat >= 3 then 'terverifikasi' else 'belum_terverifikasi' end
  where id = lokasi;

  return null;
end;
$$;

drop trigger if exists on_confirmation_change on confirmations;
create trigger on_confirmation_change
  after insert or update or delete on confirmations
  for each row execute procedure public.perbarui_status_lokasi();

-- ---------------------------------------------------------------------------
-- PATCH 3 (M5): RLS checklist terlalu longgar.
-- Sebelumnya siapa pun yang login bisa mengubah checklist lokasi orang lain,
-- dan karena skor diturunkan dari checklist, itu = mengubah skor lokasi orang lain.
-- ---------------------------------------------------------------------------
-- Nama lama dari schema.sql.
drop policy if exists "user login bisa insert checklist" on accessibility_checklist;
drop policy if exists "user login bisa update checklist" on accessibility_checklist;
-- Nama baru ikut dijatuhkan, supaya berkas ini aman dijalankan berulang.
drop policy if exists "hanya pemilik lokasi bisa insert checklist" on accessibility_checklist;
drop policy if exists "hanya pemilik lokasi bisa update checklist" on accessibility_checklist;

create policy "hanya pemilik lokasi bisa insert checklist"
  on accessibility_checklist for insert
  with check (
    exists (
      select 1 from locations
      where locations.id = accessibility_checklist.location_id
        and locations.created_by = auth.uid()
    )
  );

create policy "hanya pemilik lokasi bisa update checklist"
  on accessibility_checklist for update
  using (
    exists (
      select 1 from locations
      where locations.id = accessibility_checklist.location_id
        and locations.created_by = auth.uid()
    )
  );

-- Konfirmasi: izinkan user mengubah / menarik konfirmasinya sendiri.
-- Ada unique(location_id, user_id), jadi tanpa ini user kena error saat ganti jawaban.
drop policy if exists "user bisa ubah konfirmasi sendiri" on confirmations;
create policy "user bisa ubah konfirmasi sendiri"
  on confirmations for update using (auth.uid() = user_id);

drop policy if exists "user bisa hapus konfirmasi sendiri" on confirmations;
create policy "user bisa hapus konfirmasi sendiri"
  on confirmations for delete using (auth.uid() = user_id);

-- Kepemilikan lokasi. Tanpa ini, baris yang salah masuk tidak bisa ditarik lagi
-- oleh pembuatnya sendiri, bahkan lewat aplikasi. Tidak ada tombol hapus di UI,
-- jadi policy ini hanya membuka jalan pembersihan, bukan menambah fitur.
drop policy if exists "user cuma bisa hapus lokasi sendiri" on locations;
create policy "user cuma bisa hapus lokasi sendiri"
  on locations for delete using (auth.uid() = created_by);

-- ---------------------------------------------------------------------------
-- PATCH 3b: hitung ulang skor yang sudah terlanjur tersimpan dengan pembulatan
-- lama. Aman dijalankan ulang, hasilnya sama.
-- ---------------------------------------------------------------------------
update locations l
set skor = round((
  (
    (c.ramp_tersedia)::int + (c.lebar_pintu_cukup)::int + (c.toilet_difabel)::int +
    (c.parkir_difabel)::int + (c.lift_tersedia_berfungsi)::int +
    (c.guiding_block_tersambung)::int + (c.tempat_duduk_tersedia)::int +
    (c.permukaan_jalan_rata)::int
  ) * 100.0 / 8
)::numeric)
from accessibility_checklist c
where c.location_id = l.id;

-- ---------------------------------------------------------------------------
-- PATCH 4 (M2): bucket Storage untuk foto lokasi.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('location-photos', 'location-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "foto lokasi bisa dilihat siapa saja" on storage.objects;
create policy "foto lokasi bisa dilihat siapa saja"
  on storage.objects for select
  using (bucket_id = 'location-photos');

drop policy if exists "user login bisa upload foto lokasi" on storage.objects;
create policy "user login bisa upload foto lokasi"
  on storage.objects for insert
  with check (bucket_id = 'location-photos' and auth.uid() is not null);

commit;

-- Pemeriksaan setelah tambalan.
--
-- Yang penting: baris Taman Literasi harus berskor 63, bukan 62. Nilai itu
-- berasal dari 5 dari 8 fasilitas, yaitu tepat 62,5, jadi hanya muncul kalau
-- pembulatan sudah searah dengan peramban.
--
-- Baris bernama "Uji RLS" berskor 0 itu wajar: dia lahir dari pengujian aturan
-- keamanan dan tidak punya daftar periksa sama sekali. Ikut terhapus nanti
-- lewat pembersihan data uji.
select nama, skor, status from locations order by skor desc;


-- ============================================================================
-- BAGIAN 3 dari 7 — dari schema-patch-2.sql
-- ============================================================================

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


-- ============================================================================
-- BAGIAN 4 dari 7 — dari schema-patch-3.sql
-- ============================================================================

-- schema-patch-3.sql — SUNTING LOKASI SENDIRI DAN PENURUNAN STATUS
--
-- Jalankan setelah schema-patch-2.sql. Aman dijalankan berulang.
--
-- Berkas ini memasang tiga hal:
--   1. Kolom skor dan status dijadikan tidak bisa ditulis dari sisi klien.
--   2. Menyunting daftar periksa menurunkan lokasi kembali ke belum terverifikasi.
--   3. Tiga laporan "sudah berubah" menurunkan status, tanpa pernah menghapus baris.

begin;

-- ---------------------------------------------------------------------------
-- 1. skor dan status tidak boleh ditulis dari sisi klien.
--
-- Diukur lebih dulu, bukan diduga. Dengan akun uji biasa, lewat permintaan
-- langsung ke PostgREST:
--
--   PATCH locations {skor: 100}                  -> 200, tersimpan
--   PATCH locations {status: 'terverifikasi'}    -> 200, tersimpan
--
-- Artinya dua klaim inti produk ini tidak dipaksakan di mana pun. Halaman tentang
-- menyatakan skor dihitung di basis data "jadi tidak bisa diubah lewat formulir",
-- dan ambang tiga konfirmasi adalah satu-satunya jalan menuju terverifikasi.
-- Keduanya benar untuk antarmuka, dan keduanya tidak benar untuk API.
--
-- Kebijakan RLS tidak bisa menutup ini, karena RLS bekerja per baris sedangkan
-- yang perlu dibatasi adalah per kolom. Yang tepat adalah hak akses kolom. Hak
-- update di tingkat tabel harus dicabut lebih dulu: hak tingkat tabel tidak bisa
-- dipersempit oleh pencabutan tingkat kolom.
--
-- Kedua pemicu di bawah berjalan sebagai security definer, jadi keduanya tetap
-- bisa menulis skor dan status. Justru itu satu-satunya jalan yang tersisa.
--
-- Catatan pemeliharaan: kolom baru pada locations tidak akan bisa diperbarui
-- klien sampai ditambahkan ke daftar grant di bawah ini.
-- ---------------------------------------------------------------------------
revoke update on public.locations from authenticated, anon;
grant update (nama, kategori, lat, lng) on public.locations to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Menyunting daftar periksa mengembalikan status ke belum terverifikasi.
--
-- Konfirmasi warga berlaku untuk data versi lama. Ketika pemiliknya menyunting,
-- konfirmasi itu kehilangan dasarnya, jadi dihapus. Menyimpannya lalu berpura-pura
-- mengabaikannya akan membuat penghitung di halaman detail berbohong.
--
-- Ditaruh sebagai pemicu, bukan sebagai dua permintaan berurutan dari peramban,
-- supaya tidak ada jalan menyunting data tanpa ikut menurunkan statusnya, termasuk
-- lewat permintaan langsung ke API.
--
-- Sengaja tidak memakai penjagaan "hanya kalau nilainya berubah". Pemilik yang
-- menekan simpan sudah menyatakan datanya versi baru, dan syaratnya berbunyi
-- terlepas dari status sebelumnya.
-- ---------------------------------------------------------------------------
create or replace function public.reset_verifikasi_setelah_sunting()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from confirmations where location_id = new.location_id;

  update locations
  set status = 'belum_terverifikasi'
  where id = new.location_id;

  return null;
end;
$$;

-- Namanya sengaja urut sesudah on_checklist_change, karena pemicu dengan waktu
-- yang sama dijalankan menurut abjad: skor dihitung dulu, statusnya diturunkan
-- sesudahnya.
drop trigger if exists on_checklist_edit on accessibility_checklist;
create trigger on_checklist_edit
  after update on accessibility_checklist
  for each row execute procedure public.reset_verifikasi_setelah_sunting();

-- ---------------------------------------------------------------------------
-- 3. Tiga laporan "sudah berubah" menurunkan status.
--
-- Laporan berubah menang atas laporan akurat. Alasannya asimetri akibat: lokasi
-- terverifikasi yang ternyata sudah berubah menyesatkan orang sampai ke tempatnya,
-- sedangkan lokasi belum terverifikasi yang sebenarnya masih benar hanya kehilangan
-- satu lencana. Salah ke arah yang lebih murah.
--
-- Baris lokasi TIDAK PERNAH dihapus otomatis dalam kondisi apa pun. Data yang usang
-- tetap lebih berguna daripada peta yang kosong, dan pemiliknya masih bisa
-- memperbaikinya lewat sunting.
--
-- Ada unique (location_id, user_id), jadi tiga laporan berubah pasti berasal dari
-- tiga warga yang berbeda.
-- ---------------------------------------------------------------------------
create or replace function public.perbarui_status_lokasi()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  lokasi uuid;
  jumlah_akurat int;
  jumlah_berubah int;
begin
  lokasi := coalesce(new.location_id, old.location_id);

  select
    count(*) filter (where is_accurate = true),
    count(*) filter (where is_accurate = false)
  into jumlah_akurat, jumlah_berubah
  from confirmations
  where location_id = lokasi;

  update locations
  set status = case
        when jumlah_berubah >= 3 then 'belum_terverifikasi'
        when jumlah_akurat >= 3 then 'terverifikasi'
        else 'belum_terverifikasi'
      end
  where id = lokasi;

  return null;
end;
$$;

-- Pemicunya sudah ada dari schema-patch.sql, dipasang ulang supaya berkas ini
-- tetap benar kalau dijalankan di basis data yang belum pernah menerima tambalan itu.
drop trigger if exists on_confirmation_change on confirmations;
create trigger on_confirmation_change
  after insert or update or delete on confirmations
  for each row execute procedure public.perbarui_status_lokasi();

-- Menyelaraskan status yang sudah terlanjur tersimpan dengan aturan baru.
update locations l
set status = case
      when (select count(*) from confirmations c where c.location_id = l.id and c.is_accurate = false) >= 3
        then 'belum_terverifikasi'
      when (select count(*) from confirmations c where c.location_id = l.id and c.is_accurate = true) >= 3
        then 'terverifikasi'
      else 'belum_terverifikasi'
    end;

commit;

-- ---------------------------------------------------------------------------
-- Pemeriksaan setelah tambalan.
-- ---------------------------------------------------------------------------

-- a. Hak update kolom pada locations. Yang diharapkan: hanya nama, kategori,
--    lat, dan lng yang muncul untuk peran authenticated.
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'locations'
  and privilege_type = 'UPDATE' and grantee in ('authenticated', 'anon')
order by grantee, column_name;

-- b. Pemicu yang terpasang pada accessibility_checklist. Yang diharapkan: dua
--    baris, on_checklist_change lalu on_checklist_edit.
select trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_table = 'accessibility_checklist'
order by trigger_name;

-- c. Status dan penghitung konfirmasi tiap lokasi, untuk dibaca sekilas.
select l.nama, l.skor, l.status,
  (select count(*) from confirmations c where c.location_id = l.id and c.is_accurate) as akurat,
  (select count(*) from confirmations c where c.location_id = l.id and not c.is_accurate) as berubah
from locations l
order by l.skor desc;


-- ============================================================================
-- BAGIAN 5 dari 7 — dari schema-patch-4.sql
-- ============================================================================

-- schema-patch-4.sql — FOTO DI STORAGE TIDAK BISA DIHAPUS SIAPA PUN
--
-- Jalankan setelah schema-patch-3.sql. Aman dijalankan berulang.
--
-- ---------------------------------------------------------------------------
-- TEMUAN PENGUKURAN, bukan pembacaan berkas.
--
-- Diukur pada basis data yang sedang berjalan, memakai akun uji yang benar-benar
-- mengunggah fotonya sendiri lewat aplikasi:
--
--   DELETE /storage/v1/object/location-photos  {prefixes:[...]}  ->  HTTP 200, []
--
-- Badan jawaban kosong berarti nol berkas terhapus. Jadi permintaannya tidak gagal
-- dengan galat, ia berhasil tanpa menghapus apa pun, dan berkasnya masih terbaca di
-- alamat publiknya sesudah itu.
--
-- Sebabnya: schema-patch-2.sql memasang kebijakan INSERT untuk storage.objects, tapi
-- tidak ada kebijakan DELETE sama sekali. Tanpa kebijakan, RLS menolak diam-diam.
--
-- Akibatnya dua hal:
--   1. Menghapus lokasi menyisakan fotonya di penyimpanan, tetap bisa dibuka siapa
--      saja lewat alamat publiknya, dan tetap memakan kuota. Pada bucket yang diperiksa
--      hari ini ada enam folder yang lokasinya sudah tidak ada lagi.
--   2. Pembersihan data uji sebelum pengumpulan tidak bisa tuntas lewat aplikasi.
--
-- Baris di tabel location_photos memang ikut terhapus lewat on delete cascade dari
-- locations, jadi fotonya tidak lagi muncul di antarmuka. Yang tertinggal adalah
-- berkasnya sendiri di bucket.
-- ---------------------------------------------------------------------------

begin;

-- Dua jalan, keduanya perlu.
--
-- Lewat kolom owner: storage mengisi kolom itu sendiri dengan uid pengunggah saat
-- berkas masuk, jadi ia tidak bisa dipalsukan dari sisi klien. Ini satu-satunya jalan
-- yang masih berlaku untuk berkas yatim, yaitu berkas yang lokasinya sudah dihapus:
-- setelah barisnya hilang, tidak ada lagi created_by yang bisa dicocokkan.
--
-- Lewat kepemilikan lokasi: menutup berkas lama yang kolom owner-nya kosong, dan
-- menyamakan aturannya dengan kebijakan unggah di schema-patch-2.sql.
drop policy if exists "hanya pemilik lokasi bisa hapus foto lokasi" on storage.objects;

create policy "hanya pemilik lokasi bisa hapus foto lokasi"
  on storage.objects for delete
  using (
    bucket_id = 'location-photos'
    and (
      owner = auth.uid()
      or exists (
        select 1 from public.locations
        where locations.id::text = (storage.foldername(name))[1]
          and locations.created_by = auth.uid()
      )
    )
  );

commit;

-- ---------------------------------------------------------------------------
-- Pemeriksaan setelah tambalan.
-- ---------------------------------------------------------------------------

-- a. Kebijakan storage yang berlaku untuk bucket ini. Yang diharapkan: satu baris
--    INSERT dan satu baris DELETE.
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by cmd, policyname;

-- b. Berkas yang folder pertamanya bukan id lokasi mana pun, alias berkas yatim.
--    Daftar ini yang perlu dibersihkan lewat dasbor Storage, karena berkas yatim
--    milik akun yang sudah dihapus tidak punya siapa pun yang berhak menghapusnya.
select
  (storage.foldername(name))[1] as folder,
  count(*) as berkas,
  pg_size_pretty(sum((metadata ->> 'size')::bigint)) as ukuran
from storage.objects
where bucket_id = 'location-photos'
  and not exists (
    select 1 from public.locations where locations.id::text = (storage.foldername(name))[1]
  )
group by 1
order by 1;


-- ============================================================================
-- BAGIAN 6 dari 7 — dari schema-patch-5.sql
-- ============================================================================

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
-- Catatan pemeliharaan, dua hal.
--
-- Pertama, kolom baru pada accessibility_checklist tidak akan bisa diperbarui klien
-- sampai ditambahkan ke daftar grant di bawah ini.
--
-- Kedua, dan ini menggigit: UPSERT tidak lagi bisa dipakai pada tabel ini. Upsert
-- PostgREST menjadi insert on conflict do update yang menyetel seluruh kolom yang
-- dikirim, termasuk location_id, dan Postgres memeriksa hak update saat menyusun
-- rencana, bukan saat konflik benar-benar terjadi. Jadi upsert menuntut hak update atas
-- location_id walaupun barisnya baru dan tidak akan pernah bentrok, lalu dijawab
-- "42501 permission denied for table accessibility_checklist". Aplikasi karena itu
-- memakai insert dan update terpisah, bukan upsert.
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


-- ============================================================================
-- BAGIAN 7 dari 7 — dari schema-patch-6.sql
-- ============================================================================

-- schema-patch-6.sql — PENYUMBANG FOTO BOLEH MENARIK FOTONYA, DAN NAMA AKUN GOOGLE
--
-- Jalankan di Supabase SQL Editor setelah schema-patch-5.sql. Aman dijalankan
-- berulang: kolom memakai if not exists, kebijakan dijatuhkan lebih dulu, dan seluruh
-- berkas dibungkus satu transaksi.
--
-- ---------------------------------------------------------------------------
-- DUA HAL, KEDUANYA DARI PEMAKAIAN SUNGGUHAN.
--
-- 1. Sejak schema-patch-5.sql siapa pun yang masuk boleh menambahkan foto, tetapi yang
--    boleh menghapus hanya pemilik lokasi. Artinya orang yang salah unggah tidak bisa
--    menarik kembali fotonya sendiri, dan harus menunggu orang lain. Itu terbalik:
--    menambah bukti adalah hak penyumbang, menariknya kembali seharusnya juga.
--
-- 2. Diukur pada basis data yang sedang berjalan, bukan diduga:
--
--      profiles  fbc13008  nama = "Akun Uji"
--      profiles  26a1611f  nama = NULL
--      profiles  231467d8  nama = NULL   <- akun yang menambahkan The Park Pejaten
--
--    Halaman detail lalu menulis "Ditambahkan Warga pada 5 September 2026", bukan nama
--    orangnya. Sebabnya handle_new_user() hanya membaca raw_user_meta_data->>'nama',
--    sedangkan Google mengirim 'name' dan 'full_name'. Jadi SETIAP orang yang masuk
--    lewat Google menjadi kontributor tanpa nama, di halaman detail maupun di papan
--    kontributor. Pendaftaran lewat email tidak kena, karena formulirnya memang
--    mengirim 'nama'.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. Siapa yang mengunggah tiap foto.
--
-- Diisi lewat DEFAULT, bukan dikirim peramban, lalu hak sisip pada kolom itu dicabut.
-- Dengan begitu nilainya tidak bisa dipalsukan: klien hanya boleh menyebut location_id
-- dan photo_url, sisanya diisi basis data.
--
-- Baris foto lama tetap NULL karena tidak ada catatan siapa pengunggahnya. Baris itu
-- tetap bisa dihapus pemilik lokasi, seperti aturan sebelumnya.
-- ---------------------------------------------------------------------------
alter table location_photos
  add column if not exists uploaded_by uuid references profiles(id) default auth.uid();

revoke insert on public.location_photos from authenticated, anon;
grant insert (location_id, photo_url) on public.location_photos to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Hapus foto: pemilik lokasi ATAU pengunggahnya.
-- ---------------------------------------------------------------------------
drop policy if exists "hanya pemilik lokasi bisa hapus foto" on location_photos;
drop policy if exists "pemilik lokasi atau pengunggah bisa hapus foto" on location_photos;

create policy "pemilik lokasi atau pengunggah bisa hapus foto"
  on location_photos for delete
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from locations
      where locations.id = location_photos.location_id
        and locations.created_by = auth.uid()
    )
  );

-- Berkasnya sendiri di Storage sudah tertutup sejak schema-patch-4.sql: kebijakan
-- hapusnya menerima owner = auth.uid(), dan kolom owner itu diisi Storage sendiri
-- dengan uid pengunggah. Jadi pengunggah memang sudah bisa menghapus berkasnya, yang
-- belum bisa hanyalah barisnya. Tidak ada yang perlu diubah di sana.

-- ---------------------------------------------------------------------------
-- 3. Nama akun dari Google.
--
-- Urutannya sengaja: 'nama' dulu, karena itu yang dikirim formulir pendaftaran sendiri
-- dan paling tepat. Baru 'full_name' dan 'name' dari Google. Kalau ketiganya kosong,
-- bagian depan alamat surel dipakai sebagai jalan terakhir, supaya kontributor punya
-- sebutan dan bukan sekadar "Warga".
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nama)
  values (
    new.id,
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'nama',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )), '')
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Menambal profil yang sudah terlanjur kosong.
--
-- Hanya menyentuh baris yang namanya benar-benar kosong, jadi nama yang sudah diisi
-- orang tidak akan tertimpa.
-- ---------------------------------------------------------------------------
update public.profiles p
set nama = nullif(trim(coalesce(
      u.raw_user_meta_data ->> 'nama',
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      split_part(coalesce(u.email, ''), '@', 1)
    )), '')
from auth.users u
where u.id = p.id
  and (p.nama is null or trim(p.nama) = '');

commit;

-- ---------------------------------------------------------------------------
-- Pemeriksaan setelah tambalan.
-- ---------------------------------------------------------------------------

-- a. Tidak boleh ada lagi profil tanpa nama. Yang diharapkan: nol baris.
select id, nama from public.profiles where nama is null or trim(nama) = '';

-- b. Nama tiap kontributor, untuk dibaca sekilas.
select p.id, p.nama, count(l.id) as lokasi
from public.profiles p
left join public.locations l on l.created_by = p.id
group by p.id, p.nama
order by lokasi desc;

-- c. Hak sisip kolom pada location_photos. Yang diharapkan: hanya location_id dan
--    photo_url. uploaded_by TIDAK boleh muncul.
select column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'location_photos'
  and privilege_type = 'INSERT' and grantee = 'authenticated'
order by column_name;

-- d. Kebijakan hapus foto yang berlaku sekarang.
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'location_photos' and cmd = 'DELETE';


