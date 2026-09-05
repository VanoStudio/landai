-- bersihkan-data-uji.sql
--
-- ---------------------------------------------------------------------------
-- APA MAKSUD "PEMBERSIHAN" INI
--
-- Sepanjang pengembangan, basis data ini terisi tiga macam baris:
--
--   1. DATA CONTOH. Tiga lokasi dari seed-demo.sql: Stasiun MRT Blok M, Blok M
--      Plaza, Kantor Kecamatan Kebayoran Baru. Koordinatnya diperiksa, tetapi isi
--      daftar periksanya DIKARANG, tidak pernah disurvei di lokasi. Gunanya cuma
--      supaya peta tidak kosong sebelum data asli masuk.
--
--   2. DATA PENGUJIAN. Lokasi bernama "UJI ..." dan lokasi yang dibuat akun uji.
--      Lahir dari pengujian otomatis, bukan dari orang yang benar-benar ke sana.
--
--   3. AKUN UJI. Akun yang dipakai pengujian otomatis, bernama "Akun Uji ...".
--      Salah satunya pernah punya sandi yang ikut tercatat di riwayat git.
--
-- Ketiganya harus hilang sebelum karya dikumpulkan, karena juri akan membaca peta ini
-- sebagai data aksesibilitas sungguhan. Meninggalkan daftar periksa karangan di sana
-- sama saja menyajikan data palsu, dan itu jauh lebih merugikan daripada peta yang
-- isinya sedikit tetapi jujur.
--
-- ---------------------------------------------------------------------------
-- KAPAN DIJALANKAN
--
-- PALING AKHIR. Hanya setelah data survei asli dari Husein sudah masuk cukup banyak.
--
-- Menjalankannya lebih cepat membuat peta pada tautan hosting kosong melompong, dan
-- siapa pun yang membukanya di antara sekarang dan hari pengumpulan, termasuk juri
-- yang mengecek lebih awal, akan melihat aplikasi yang tampak tidak berisi apa-apa.
--
-- ---------------------------------------------------------------------------
-- CARA MENJALANKAN
--
-- Buka Supabase, menu SQL Editor, lalu jalankan blok 1 dulu SENDIRIAN dan baca
-- hasilnya. Blok 1 tidak menghapus apa pun. Kalau daftarnya sudah sesuai harapan,
-- baru jalankan blok 2. Blok 3 dan 4 dikerjakan lewat dasbor, bukan lewat SQL.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- BLOK 1. Lihat dulu apa yang akan dihapus. Tidak menghapus apa pun.
-- ---------------------------------------------------------------------------
select
  l.id,
  l.nama,
  l.skor,
  coalesce(p.nama, 'tanpa akun') as kontributor,
  case
    when l.created_by is null then 'DATA CONTOH dari seed-demo.sql'
    when l.nama like 'UJI%' then 'DATA PENGUJIAN, dari berkas uji otomatis'
    else 'DATA PENGUJIAN, dibuat akun uji lewat aplikasi'
  end as alasan_dihapus,
  l.created_at
from locations l
left join profiles p on p.id = l.created_by
where l.created_by is null
   or l.nama like 'UJI%'
   or l.created_by in (select id from profiles where nama like 'Akun Uji%')
order by l.created_at;

-- Lokasi yang AKAN DIPERTAHANKAN. Ini yang nanti tersisa di peta.
select
  l.id, l.nama, l.skor, l.status,
  coalesce(p.nama, 'tanpa akun') as kontributor,
  l.created_at
from locations l
left join profiles p on p.id = l.created_by
where not (
  l.created_by is null
  or l.nama like 'UJI%'
  or l.created_by in (select id from profiles where nama like 'Akun Uji%')
)
order by l.created_at;

-- ---------------------------------------------------------------------------
-- BLOK 2. Hapus. Jalankan HANYA setelah daftar di blok 1 sesuai harapan.
--
-- Daftar periksa, foto, dan konfirmasi ikut terhapus lewat on delete cascade, jadi
-- tidak perlu dihapus satu per satu.
-- ---------------------------------------------------------------------------
begin;

delete from locations
where created_by is null
   or nama like 'UJI%'
   or created_by in (select id from profiles where nama like 'Akun Uji%');

commit;

-- ---------------------------------------------------------------------------
-- BLOK 3. Berkas foto di Storage.
--
-- Berkasnya hidup di luar tabel, jadi tidak ikut terhapus oleh cascade. Kueri di
-- bawah ini mendaftar folder yang lokasinya sudah tidak ada lagi. Salin nama
-- foldernya, lalu hapus lewat dasbor: Storage, bucket location-photos.
--
-- Perlu lewat dasbor karena berkas milik akun yang sudah dihapus tidak punya siapa
-- pun yang berhak menghapusnya dari dalam aplikasi.
-- ---------------------------------------------------------------------------
select
  (storage.foldername(name))[1] as folder_yang_harus_dihapus,
  count(*) as jumlah_berkas,
  pg_size_pretty(sum((metadata ->> 'size')::bigint)) as ukuran
from storage.objects
where bucket_id = 'location-photos'
  and not exists (
    select 1 from public.locations
    where locations.id::text = (storage.foldername(name))[1]
  )
group by 1
order by 1;

-- ---------------------------------------------------------------------------
-- BLOK 4. Akun uji.
--
-- Hapus lewat dasbor: Authentication, menu Users. Kueri di bawah mendaftar akun mana
-- saja yang harus dihapus. Baris profiles-nya ikut terhapus otomatis lewat cascade.
--
-- Salah satu akun uji pernah punya sandi yang ikut tercatat di riwayat git, jadi
-- menghapusnya bukan sekadar kerapian.
-- ---------------------------------------------------------------------------
select u.id, u.email, p.nama, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.nama like 'Akun Uji%'
   or u.email like '%uji.landai%'
order by u.created_at;

-- ---------------------------------------------------------------------------
-- PEMERIKSAAN AKHIR. Jalankan setelah blok 2, 3, dan 4 selesai.
--
-- Yang diharapkan: hanya lokasi hasil survei sungguhan yang tersisa, dan tidak ada
-- lagi lokasi tanpa kontributor.
-- ---------------------------------------------------------------------------
select
  count(*) as sisa_lokasi,
  count(*) filter (where created_by is null) as tanpa_kontributor_harus_nol,
  count(*) filter (where nama like 'UJI%') as sisa_data_uji_harus_nol
from locations;
