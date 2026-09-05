// Bagian tujuh: pembersihan data uji, langkah 32.
//
// Hanya menyentuh yang dibuat sesi ini: empat lokasi berawalan "UJI QA" beserta foto,
// daftar periksa, dan konfirmasinya. Baris lain tidak disentuh sama sekali, termasuk
// tiga data contoh dari seed dan satu lokasi milik akun uji sesi sebelumnya.
//
// Penghapusan dilakukan memakai token pemilik masing-masing lokasi, bukan kunci
// service role, jadi sekaligus membuktikan kebijakan hapus milik pemilik bekerja.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { TANGKAPAN, BERKAS_AKUN, catat, rest, masukApi, SUPABASE_URL, ANON } from './lib.mjs'

const simpanan = JSON.parse(readFileSync(BERKAS_AKUN, 'utf8'))

async function potret(label) {
  const { data: lokasi } = await rest('locations?select=id,nama,created_by,created_at&order=created_at')
  const { data: foto } = await rest('location_photos?select=id,location_id,photo_url')
  const { data: konfirmasi } = await rest('confirmations?select=location_id,user_id,is_accurate')
  const { data: profil } = await rest('profiles?select=id,nama&order=created_at')
  const potretIni = { label, lokasi, jumlahFoto: foto.length, foto, konfirmasi, profil }
  catat(`--- ${label} ---`)
  catat(`lokasi (${lokasi.length}): ${lokasi.map(l => l.nama).join(' | ')}`)
  catat(`foto ${foto.length}, konfirmasi ${konfirmasi.length}, profil ${profil.length}: ${profil.map(p => p.nama ?? '(tanpa nama)').join(' | ')}`)
  return potretIni
}

const sebelum = await potret('sebelum pembersihan')

// Lokasi uji: yang dibuat sesi ini saja, dikenali dari awalan nama.
const sasaran = sebelum.lokasi.filter(l => l.nama.startsWith('UJI QA'))
catat(`sasaran hapus (${sasaran.length}): ${sasaran.map(l => `${l.nama} ${l.id}`).join(', ')}`)

const pemilikDari = {
  [simpanan.akun.utama.email]: simpanan.akun.utama,
  [simpanan.akun.beta.email]: simpanan.akun.beta,
}
const token = {}
for (const akun of Object.values(pemilikDari)) {
  const s = await masukApi(akun.email, akun.sandi)
  const { data: profil } = await rest(`profiles?select=id&id=eq.${s.data.user.id}`)
  token[s.data.user.id] = { akses: s.data.access_token, nama: akun.nama, ada: profil.length > 0 }
}

const catatanHapus = []
for (const l of sasaran) {
  const t = token[l.created_by]
  if (!t) { catatanHapus.push({ ...l, hasil: 'tidak ada token pemilik' }); continue }

  // 1. Berkas di Storage. Cascade basis data tidak menyentuhnya karena berkasnya
  //    hidup di luar tabel.
  const daftar = await fetch(`${SUPABASE_URL}/storage/v1/object/list/location-photos`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${t.akses}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: `${l.id}/`, limit: 100 }),
  })
  const berkas = await daftar.json()
  const jalur = (Array.isArray(berkas) ? berkas : []).map(b => `${l.id}/${b.name}`)
  let hapusBerkas = { status: 0, jumlah: 0 }
  if (jalur.length) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/location-photos`, {
      method: 'DELETE',
      headers: { apikey: ANON, Authorization: `Bearer ${t.akses}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: jalur }),
    })
    hapusBerkas = { status: r.status, jumlah: jalur.length }
  }

  // 2. Baris lokasi. Checklist, foto, dan konfirmasi ikut lewat on delete cascade.
  const hapus = await rest(`locations?id=eq.${l.id}`, {
    method: 'DELETE', token: t.akses, headers: { Prefer: 'return=representation' },
  })
  catatanHapus.push({
    nama: l.nama, id: l.id, pemilik: t.nama,
    berkasStorage: hapusBerkas, hapusBaris: hapus.status,
    baris: Array.isArray(hapus.data) ? hapus.data.length : 0,
  })
  catat(`hapus ${l.nama}: ${hapusBerkas.jumlah} berkas Storage (HTTP ${hapusBerkas.status}), baris lokasi HTTP ${hapus.status}`)
}

const sesudah = await potret('sesudah pembersihan')

// Sisa berkas di bucket yang tidak lagi punya lokasi.
const idSah = new Set(sesudah.lokasi.map(l => l.id))
const daftarAkar = await fetch(`${SUPABASE_URL}/storage/v1/object/list/location-photos`, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prefix: '', limit: 200 }),
})
const folder = await daftarAkar.json()
const yatim = (Array.isArray(folder) ? folder : []).map(f => f.name).filter(n => !idSah.has(n))
catat(`folder Storage: ${(Array.isArray(folder) ? folder : []).map(f => f.name).join(', ') || '(kosong)'}`)
catat(`folder tanpa lokasi: ${yatim.join(', ') || 'tidak ada'}`)

const sisaUji = sesudah.lokasi.filter(l => l.nama.startsWith('UJI QA'))
catat(`${sisaUji.length === 0 ? 'BERSIH' : 'MASIH ADA'}: sisa lokasi berawalan UJI QA = ${sisaUji.length}`)

writeFileSync(path.join(TANGKAPAN, 'pembersihan.json'),
  JSON.stringify({ sebelum, catatanHapus, sesudah, folderStorage: folder, yatim }, null, 2))
