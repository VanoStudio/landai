// Menghapus satu lokasi sisa pengujian sesi lama: Taman Literasi Martha Christina
// Tiahahu, milik akun "Akun Uji".
//
// Sasarannya dikunci pada satu id, bukan pada pencocokan nama, dan penghapusannya
// memakai token akun pemiliknya sendiri. Dua lapis itu berarti kalau idnya keliru,
// RLS yang menolak, bukan skrip ini yang menyadarinya belakangan.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { TANGKAPAN, catat, rest, masukApi, AKAR } from './lib.mjs'

const ID = '629b9433-58e4-44f9-b4b7-e2c91106236a'
const NAMA = 'Taman Literasi Martha Christina Tiahahu'

const env = (() => {
  const isi = readFileSync(path.join(AKAR, '.env'), 'utf8')
  const h = {}
  for (const b of isi.split(/\r?\n/)) {
    const m = b.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) h[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return h
})()

async function potret(label) {
  const { data: lokasi } = await rest(`locations?id=eq.${ID}&select=id,nama,skor,status,created_by,created_at`)
  const { data: checklist } = await rest(`accessibility_checklist?location_id=eq.${ID}&select=location_id,ramp_tersedia,catatan`)
  const { data: foto } = await rest(`location_photos?location_id=eq.${ID}&select=id,photo_url`)
  const { data: konfirmasi } = await rest(`confirmations?location_id=eq.${ID}&select=user_id,is_accurate`)
  const { data: semua } = await rest('locations?select=id,nama&order=created_at')
  catat(`--- ${label} ---`)
  catat(`baris locations   : ${lokasi.length}${lokasi.length ? ` (${lokasi[0].nama}, skor ${lokasi[0].skor}, pemilik ${lokasi[0].created_by})` : ''}`)
  catat(`baris checklist   : ${checklist.length}`)
  catat(`baris foto        : ${foto.length}${foto.length ? ` (${foto.map(f => f.photo_url.split('/').slice(-2).join('/')).join(', ')})` : ''}`)
  catat(`baris konfirmasi  : ${konfirmasi.length}`)
  catat(`total lokasi      : ${semua.length} (${semua.map(l => l.nama).join(' | ')})`)
  return { label, lokasi, checklist, foto, konfirmasi, semua }
}

const sebelum = await potret('sebelum penghapusan')
if (sebelum.lokasi.length !== 1) {
  catat('lokasi sasaran tidak ada. berhenti.')
  process.exit(0)
}

// Token pemilik. Kredensialnya dibaca dari .env, tidak pernah ditulis di berkas ini.
if (!env.AKUN_UJI_EMAIL || !env.AKUN_UJI_SANDI) {
  catat('AKUN_UJI_EMAIL dan AKUN_UJI_SANDI belum ada di .env. berhenti.')
  process.exit(1)
}
const sesi = await masukApi(env.AKUN_UJI_EMAIL, env.AKUN_UJI_SANDI)
if (sesi.status !== 200) {
  catat(`gagal masuk sebagai pemilik: HTTP ${sesi.status} ${JSON.stringify(sesi.data).slice(0, 120)}`)
  process.exit(1)
}
const uid = sesi.data.user.id
catat(`masuk sebagai ${env.AKUN_UJI_EMAIL}, uid ${uid}`)
if (uid !== sebelum.lokasi[0].created_by) {
  catat(`uid tidak cocok dengan created_by ${sebelum.lokasi[0].created_by}. berhenti, tidak menghapus apa pun.`)
  process.exit(1)
}
catat('uid cocok dengan created_by lokasi sasaran')

// Berkas foto di Storage dicoba lebih dulu, selagi barisnya masih ada sehingga
// kepemilikannya masih bisa dibuktikan kebijakan. Kalau schema-patch-4.sql belum
// dipasang, ini akan menjawab 200 dengan nol berkas terhapus.
const { SUPABASE_URL, ANON } = await import('./lib.mjs')
const daftar = await fetch(`${SUPABASE_URL}/storage/v1/object/list/location-photos`, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: `Bearer ${sesi.data.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prefix: `${ID}/`, limit: 100 }),
})
const berkas = await daftar.json()
const jalur = (Array.isArray(berkas) ? berkas : []).map(b => `${ID}/${b.name}`)
let hapusBerkas = { status: null, diminta: jalur.length, terhapus: 0 }
if (jalur.length) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/location-photos`, {
    method: 'DELETE',
    headers: { apikey: ANON, Authorization: `Bearer ${sesi.data.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: jalur }),
  })
  const jawab = await r.json()
  hapusBerkas = { status: r.status, diminta: jalur.length, terhapus: Array.isArray(jawab) ? jawab.length : 0 }
}
catat(`berkas Storage: diminta ${hapusBerkas.diminta}, HTTP ${hapusBerkas.status}, terhapus ${hapusBerkas.terhapus}`)

// Baris lokasi. Satu id, satu baris.
const hapus = await rest(`locations?id=eq.${ID}`, {
  method: 'DELETE',
  token: sesi.data.access_token,
  headers: { Prefer: 'return=representation' },
})
catat(`DELETE locations?id=eq.${ID} -> HTTP ${hapus.status}, ${Array.isArray(hapus.data) ? hapus.data.length : 0} baris terhapus`)

const sesudah = await potret('sesudah penghapusan')
const bersih = sesudah.lokasi.length === 0 && sesudah.checklist.length === 0
  && sesudah.foto.length === 0 && sesudah.konfirmasi.length === 0
catat(`${bersih ? 'BERSIH' : 'BELUM BERSIH'}: "${NAMA}" beserta checklist, foto, dan konfirmasinya`)

writeFileSync(path.join(TANGKAPAN, 'hapus-taman-literasi.json'),
  JSON.stringify({ sebelum, hapusBerkas, hapus: { status: hapus.status }, sesudah }, null, 2))
