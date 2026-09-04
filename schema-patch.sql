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
