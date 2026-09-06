-- ---------------------------------------------------------------------------
-- PATCH 7: jenis tempat digeneralkan, dari enam menjadi sembilan pilihan.
--
-- Sebabnya terbaca langsung dari data survei pertama. Empat halte bus di koridor
-- Pejaten semuanya terpaksa dicatat sebagai "Lainnya", karena satu-satunya pilihan
-- transportasi yang tersedia adalah "Stasiun". Padahal halte, terminal, dan stasiun
-- adalah persoalan aksesibilitas yang sama persis: naik turun peron, ramp, dan jalur
-- pemandu. Menyimpannya sebagai "Lainnya" membuang informasi yang justru paling
-- berguna untuk dicari orang.
--
-- Yang berubah:
--   stasiun           menjadi  transportasi_umum   halte, stasiun, terminal, bandara
--   mal               menjadi  perbelanjaan        mal, pasar, pertokoan
--   kantor_pemerintah menjadi  kantor_layanan      kelurahan, kecamatan, kantor pos
--   taman             menjadi  ruang_publik        taman, alun-alun, trotoar utama
--   kesehatan         tetap                        rumah sakit, puskesmas, klinik
--   lainnya           tetap
--
-- Yang baru:
--   pendidikan   sekolah, kampus, perpustakaan
--   ibadah       masjid, gereja, pura, vihara, klenteng
--   kuliner      rumah makan, kafe, warung
--
-- CATATAN PENTING TENTANG URUTAN MENJALANKAN.
-- Batasan barunya sengaja menerima nilai LAMA sekaligus nilai BARU. Dengan begitu
-- tambalan ini boleh dijalankan sebelum maupun sesudah kodenya ter-deploy, tanpa
-- jendela waktu yang membuat penyimpanan lokasi gagal. Nilai lama memang tidak akan
-- pernah dikirim lagi oleh antarmuka, tetapi membiarkannya diterima jauh lebih murah
-- daripada menimbulkan galat pada orang yang sedang berdiri di lapangan.
--
-- Aman diulang. Menjalankannya dua kali tidak mengubah apa pun pada jalan kedua.
-- ---------------------------------------------------------------------------

begin;

-- Sebelum: sebaran jenis yang tersimpan sekarang.
select kategori, count(*) as jumlah
from public.locations
group by kategori
order by jumlah desc;

-- ---------------------------------------------------------------------------
-- 1. Batasan lama dilepas.
--
-- Namanya dicari lewat katalog, bukan ditulis mati. Batasan ini lahir sebagai
-- pemeriksaan inline pada definisi kolom, jadi namanya dibuat otomatis Postgres dan
-- bisa berbeda pada basis data yang skemanya pernah dipasang ulang.
-- ---------------------------------------------------------------------------
do $$
declare nama_batasan text;
begin
  select conname into nama_batasan
  from pg_constraint
  where conrelid = 'public.locations'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%kategori%';

  if nama_batasan is not null then
    execute format('alter table public.locations drop constraint %I', nama_batasan);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Nilai lama dipindahkan ke padanan barunya.
-- ---------------------------------------------------------------------------
update public.locations set kategori = 'transportasi_umum' where kategori = 'stasiun';
update public.locations set kategori = 'perbelanjaan'      where kategori = 'mal';
update public.locations set kategori = 'kantor_layanan'    where kategori = 'kantor_pemerintah';
update public.locations set kategori = 'ruang_publik'      where kategori = 'taman';

-- Halte yang terlanjur tercatat sebagai "Lainnya" hanya karena pilihannya belum ada.
-- Dicocokkan dari namanya, dan hanya baris yang memang masih "Lainnya" yang disentuh,
-- jadi lokasi yang sudah sengaja dikategorikan tidak ikut berubah.
update public.locations
set kategori = 'transportasi_umum'
where kategori = 'lainnya'
  and (nama ilike 'halte%' or nama ilike '%terminal%' or nama ilike 'stasiun%');

-- ---------------------------------------------------------------------------
-- 3. Batasan baru dipasang. Menerima nilai lama sekaligus baru, alasannya ada di
--    catatan urutan menjalankan di kepala berkas ini.
-- ---------------------------------------------------------------------------
alter table public.locations add constraint locations_kategori_check
  check (kategori in (
    -- sembilan jenis yang dipakai antarmuka sekarang
    'transportasi_umum',
    'perbelanjaan',
    'kantor_layanan',
    'kesehatan',
    'pendidikan',
    'ibadah',
    'ruang_publik',
    'kuliner',
    'lainnya',
    -- nilai lama, tetap diterima supaya tidak ada jendela waktu yang gagal
    'stasiun',
    'mal',
    'kantor_pemerintah',
    'taman'
  ));

commit;

-- ---------------------------------------------------------------------------
-- Pemeriksaan setelah tambalan.
-- ---------------------------------------------------------------------------

-- a. Sebaran jenis sesudahnya. Tidak boleh ada lagi baris bernilai stasiun, mal,
--    kantor_pemerintah, atau taman.
select kategori, count(*) as jumlah
from public.locations
group by kategori
order by jumlah desc;

-- b. Daftar lokasi beserta jenis barunya, untuk diperiksa sekilas dengan mata.
select nama, kategori
from public.locations
order by created_at;

-- c. Batasan yang sekarang berlaku.
select pg_get_constraintdef(oid) as batasan_kategori
from pg_constraint
where conrelid = 'public.locations'::regclass
  and contype = 'c'
  and pg_get_constraintdef(oid) ilike '%kategori%';
