// Memastikan `schema-gabungan.sql` benar-benar bisa dijalankan sekali jalan pada
// basis data kosong, dan hasilnya berperilaku seperti yang dijanjikan.
//
// Kenapa perlu diuji sama sekali: berkas itu gabungan tujuh skrip yang ditulis
// berhari-hari secara bertahap. Tambalan belakangan menjatuhkan kebijakan yang
// dibuat lebih awal, jadi salah urut menghasilkan skema yang berbeda tanpa satu
// pun pesan galat muncul. Yang diperiksa di sini bukan cuma "tidak error",
// melainkan skema akhirnya betul.
//
// Dijalankan di atas Postgres sungguhan lewat PGlite, Postgres yang dikompilasi
// ke WebAssembly, jadi tidak perlu Docker maupun server. Yang ditiru hanya
// bagian Supabase yang memang dirujuk skrip: tabel `auth.users`, fungsi
// `auth.uid()`, `storage.buckets`, `storage.objects`, dan `storage.foldername`.
//
// BATASNYA, dan ini penting untuk jujur: tiruan tetap tiruan. Pemeriksaan ini
// menangkap galat sintaks, urutan dependensi, tabrakan nama kebijakan, dan
// kesalahan logika trigger. Ia TIDAK membuktikan perilaku Supabase yang
// sesungguhnya, misalnya bagaimana PostgREST menerjemahkan penolakan hak akses
// menjadi kode 42501. Pembuktian akhir tetap menjalankan berkasnya di SQL Editor
// pada proyek Supabase yang benar-benar kosong.
//
// Jalankan dari akar repo:
//
//   npm install @electric-sql/pglite
//   node docs/qa/uji-schema-gabungan.mjs
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BERKAS = process.argv[2] || join(process.cwd(), 'schema-gabungan.sql')

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

// Bagian Supabase yang dirujuk skrip, dibuat seminimal mungkin. Sengaja tidak
// lebih lengkap dari yang dipakai, supaya kalau skrip kelak merujuk objek baru,
// pemeriksaan ini gagal dan bukan diam-diam lolos.
const PANGGUNG = `
create role anon;
create role authenticated;
create role service_role;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public bool default false
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable
  as $$ select string_to_array(name, '/') $$;
`

// Pemenggal pernyataan yang sadar dollar-quoting. Tanpa ini, titik koma di dalam
// badan fungsi plpgsql akan dikira akhir pernyataan dan fungsinya terpotong.
function penggal(sql) {
  const keluar = []
  let buf = '', i = 0, tag = null
  while (i < sql.length) {
    const c = sql[i]
    if (tag) {
      if (sql.startsWith(tag, i)) { buf += tag; i += tag.length; tag = null; continue }
      buf += c; i++; continue
    }
    if (c === '-' && sql[i + 1] === '-') {
      const akhir = sql.indexOf('\n', i)
      i = akhir === -1 ? sql.length : akhir + 1
      continue
    }
    if (c === "'" || c === '"') {
      const j = sql.indexOf(c, i + 1)
      buf += sql.slice(i, j + 1); i = j + 1; continue
    }
    if (c === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i))
      if (m) { tag = m[0]; buf += tag; i += tag.length; continue }
    }
    if (c === ';') { keluar.push(buf.trim()); buf = ''; i++; continue }
    buf += c; i++
  }
  if (buf.trim()) keluar.push(buf.trim())
  return keluar.filter(Boolean)
}

const db = new PGlite()
await db.exec(PANGGUNG)

// ---------- tiap pernyataan dijalankan sendiri, supaya yang gagal ketahuan ----------
const isi = readFileSync(BERKAS, 'utf8')
const pernyataan = penggal(isi)
const galat = []

for (const [n, p] of pernyataan.entries()) {
  try { await db.exec(p + ';') }
  catch (e) {
    galat.push(`pernyataan ${n + 1}: ${e.message.split('\n')[0]}  <<  ${p.replace(/\s+/g, ' ').slice(0, 70)}`)
  }
}

catat(`Seluruh ${pernyataan.length} pernyataan jalan tanpa satu pun galat`,
  galat.length === 0, galat.length ? `${galat.length} gagal` : '')
for (const g of galat) console.log(`         ${g}`)

if (galat.length) {
  await db.close()
  console.log(`\n  ${langkah.length - 1} dari ${langkah.length} pemeriksaan lolos`)
  process.exitCode = 1
}
else {
  // ---------- profil lahir otomatis, dan namanya tidak pernah kosong ----------
  const buatAkun = async (email, meta) => (await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
    [email, JSON.stringify(meta)])).rows[0].id

  const u1 = await buatAkun('a@contoh.test', { nama: 'Nama Dari Formulir' })
  const u2 = await buatAkun('b@contoh.test', { full_name: 'Nama Dari Google' })
  const u3 = await buatAkun('penyumbang.tanpa.nama@contoh.test', {})

  const nama = Object.fromEntries(
    (await db.query(`select id, nama from profiles`)).rows.map(r => [r.id, r.nama]))

  catat('Profil lahir otomatis untuk tiap akun baru', Object.keys(nama).length === 3)
  catat('Nama dari formulir pendaftaran dipakai apa adanya',
    nama[u1] === 'Nama Dari Formulir', nama[u1])
  catat('Nama dari akun Google terbaca lewat full_name',
    nama[u2] === 'Nama Dari Google', nama[u2])
  catat('Akun tanpa nama jatuh ke potongan email, bukan kosong',
    nama[u3] === 'penyumbang.tanpa.nama', nama[u3])

  // ---------- skor dihitung trigger, pembulatannya searah peramban ----------
  const lok = (await db.query(
    `insert into locations (nama, kategori, lat, lng, created_by)
     values ('Uji Gabungan', 'taman', -6.24, 106.8, $1) returning id`, [u1])).rows[0].id

  await db.query(
    `insert into accessibility_checklist (location_id, ramp_tersedia, lebar_pintu_cukup,
       toilet_difabel, parkir_difabel, lift_tersedia_berfungsi)
     values ($1, true, true, true, true, true)`, [lok])

  const awal = (await db.query(`select skor, status from locations where id=$1`, [lok])).rows[0]
  // 5 dari 8 itu tepat 62,5. Angkanya harus 63, sama dengan pembulatan di peramban.
  catat('Lima dari delapan fasilitas menghasilkan skor 63, bukan 62',
    awal.skor === 63, `skor ${awal.skor}`)
  catat('Lokasi baru berstatus belum_terverifikasi',
    awal.status === 'belum_terverifikasi', awal.status)

  await db.query(`update accessibility_checklist set toilet_difabel=false where location_id=$1`, [lok])
  catat('Skor ikut turun begitu checklist diubah',
    (await db.query(`select skor from locations where id=$1`, [lok])).rows[0].skor === 50)

  // ---------- status naik dan turun mengikuti konfirmasi warga ----------
  const status = async () =>
    (await db.query(`select status from locations where id=$1`, [lok])).rows[0].status

  for (const u of [u1, u2, u3]) {
    await db.query(
      `insert into confirmations (location_id, user_id, is_accurate) values ($1,$2,true)`, [lok, u])
  }
  catat('Tiga konfirmasi akurat menaikkan status jadi terverifikasi',
    await status() === 'terverifikasi')

  await db.query(`update confirmations set is_accurate=false where location_id=$1`, [lok])
  catat('Tiga laporan "sudah berubah" menurunkan status kembali',
    await status() === 'belum_terverifikasi')

  await db.query(`update confirmations set is_accurate=true where location_id=$1`, [lok])
  catat('Terverifikasi lagi setelah konfirmasi dipulihkan', await status() === 'terverifikasi')

  await db.query(`update accessibility_checklist set lift_tersedia_berfungsi=false where location_id=$1`, [lok])
  catat('Menyunting checklist mereset verifikasi lokasi', await status() === 'belum_terverifikasi')

  // ---------- hak per kolom, pertahanan yang tidak kelihatan dari UI ----------
  // RLS bekerja per baris dan tidak bisa membatasi kolom. Yang menutup kolom
  // seperti skor dan status justru grant per kolom, bukan kebijakan RLS.
  const bolehUbah = async (tabel, kolom) => (await db.query(
    `select 1 from information_schema.column_privileges
     where grantee='authenticated' and privilege_type='UPDATE'
       and table_name=$1 and column_name=$2`, [tabel, kolom])).rows.length > 0

  catat('Kolom location_id checklist tertutup, memindahkan baris ke lokasi lain mustahil',
    !(await bolehUbah('accessibility_checklist', 'location_id')))
  catat('Kolom checklist yang wajar disunting tetap terbuka',
    await bolehUbah('accessibility_checklist', 'ramp_tersedia'))
  catat('Kolom skor tertutup, skor tidak bisa dipalsukan dari klien',
    !(await bolehUbah('locations', 'skor')))
  catat('Kolom status tertutup, verifikasi tidak bisa dipalsukan dari klien',
    !(await bolehUbah('locations', 'status')))
  catat('Kolom created_by tertutup, kepemilikan lokasi tidak bisa dirampas',
    !(await bolehUbah('locations', 'created_by')))
  catat('Kolom nama lokasi tetap boleh disunting', await bolehUbah('locations', 'nama'))

  const insKolom = (await db.query(
    `select column_name from information_schema.column_privileges
     where grantee='authenticated' and privilege_type='INSERT' and table_name='location_photos'
     order by 1`)).rows.map(r => r.column_name)
  catat('Insert foto hanya boleh mengisi location_id dan photo_url',
    insKolom.join(',') === 'location_id,photo_url', insKolom.join(','))

  // Kolom uploaded_by tidak ada di daftar grant, jadi klien tidak bisa mengisinya.
  // Nilainya datang dari default auth.uid(), bukan dari kiriman klien.
  await db.exec(`select set_config('request.jwt.claim.sub', '${u2}', false)`)
  const foto = (await db.query(
    `insert into location_photos (location_id, photo_url)
     values ($1, 'https://x.supabase.co/storage/v1/object/public/location-photos/a.jpg')
     returning uploaded_by`, [lok])).rows[0]
  catat('Kolom uploaded_by terisi sendiri dari auth.uid(), bukan dari kiriman klien',
    foto.uploaded_by === u2, String(foto.uploaded_by))

  // ---------- bentuk akhir skema ----------
  const hitung = async (q, p = []) => (await db.query(q, p)).rows.length
  catat('Lima tabel inti terbentuk',
    await hitung(`select 1 from information_schema.tables where table_schema='public'`) === 5)
  catat('Empat fungsi dan empat trigger terpasang',
    await hitung(`select 1 from information_schema.routines where routine_schema='public'`) === 4
    && await hitung(`select 1 from pg_trigger where not tgisinternal`) === 4)
  catat('Bucket Storage location-photos ada dan publik',
    (await db.query(`select public from storage.buckets where id='location-photos'`)).rows[0]?.public === true)
  catat('Sembilan belas kebijakan RLS terpasang di public dan storage',
    await hitung(`select 1 from pg_policies where schemaname in ('public','storage')`) === 19)

  await db.close()
  const gagal = langkah.filter(l => !l.lolos)
  console.log(`\n  ${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
  process.exitCode = gagal.length ? 1 : 0
}
