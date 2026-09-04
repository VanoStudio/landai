-- bersihkan-data-uji.sql
--
-- Menghapus seluruh data yang bukan hasil survei: tiga baris data contoh dari
-- seed-demo.sql, dan baris-baris yang lahir dari pengujian menyeluruh.
-- Checklist, foto, dan konfirmasi ikut terhapus lewat on delete cascade.
--
-- Jalankan di Supabase SQL Editor. Aman dijalankan berulang.
--
-- JANGAN DIJALANKAN SEKARANG.
--
-- Berkas ini adalah langkah paling akhir sebelum pengumpulan, dan hanya boleh
-- dijalankan setelah data survei asli dari Husein sudah masuk cukup banyak.
-- Menjalankannya lebih cepat membuat peta pada tautan hosting kosong melompong,
-- dan siapa pun yang membukanya di antara sekarang dan hari pengumpulan akan
-- melihat aplikasi yang tampak tidak berisi apa-apa.
--
-- Blok pertama di bawah hanya menampilkan daftar calon hapus, tidak menghapus
-- apa pun. Selalu baca daftar itu dulu.

-- ---------------------------------------------------------------------------
-- 1. Lihat dulu apa yang akan dihapus. Jalankan blok ini sendirian.
-- ---------------------------------------------------------------------------
select
  l.id,
  l.nama,
  l.skor,
  case
    when l.created_by is null then 'data contoh dari seed'
    else 'dibuat lewat aplikasi'
  end as asal,
  l.created_at
from locations l
where l.id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333'
  )
  or l.nama in ('Uji RLS', 'Uji Simpan')
  or l.created_by in (select id from profiles where nama = 'Akun Uji')
order by l.created_at;

-- ---------------------------------------------------------------------------
-- 2. Hapus. Jalankan setelah daftar di atas sesuai harapan.
-- ---------------------------------------------------------------------------
delete from locations
where id in (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333'
  )
  or nama in ('Uji RLS', 'Uji Simpan')
  or created_by in (select id from profiles where nama = 'Akun Uji');

-- ---------------------------------------------------------------------------
-- 3. Sisa foto di Storage tidak ikut terhapus oleh cascade, karena berkasnya
--    hidup di luar tabel. Hapus lewat dasbor: Storage, bucket location-photos,
--    buang folder yang namanya tidak lagi cocok dengan id lokasi mana pun.
--    Untuk melihat id lokasi yang masih sah:
-- ---------------------------------------------------------------------------
-- select id, nama from locations order by created_at;

-- ---------------------------------------------------------------------------
-- 4. Akun uji. Hapus lewat dasbor Authentication, Users, cari uji.landai@example.com.
--    Baris profiles-nya ikut terhapus otomatis karena on delete cascade.
-- ---------------------------------------------------------------------------

-- Pemeriksaan akhir, harusnya menyisakan data survei saja.
select count(*) as sisa_lokasi from locations;
