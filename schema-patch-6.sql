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
