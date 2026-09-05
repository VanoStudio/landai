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
