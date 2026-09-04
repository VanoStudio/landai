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
