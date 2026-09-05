// Menghapus sisa berkas foto milik data uji sesi ini di Storage.
//
// Dijalankan setelah schema-patch-4.sql dipasang, atau kapan saja kalau
// SUPABASE_SERVICE_ROLE_KEY sudah ada di .env. Tanpa salah satu dari keduanya,
// berkas ini akan melaporkan bahwa nol berkas terhapus, dan itu memang jawabannya:
// tidak ada yang berhak menghapus.
//
// Hanya menyentuh folder milik lokasi uji sesi ini. Folder yatim dari sesi lain
// dilaporkan tapi tidak disentuh.
import { readFileSync } from 'node:fs'
import { BERKAS_AKUN, catat, rest, masukApi, SUPABASE_URL, ANON, SERVICE } from './lib.mjs'

const simpanan = JSON.parse(readFileSync(BERKAS_AKUN, 'utf8'))
const FOLDER_UJI = [
  simpanan.idLokasi,
  ...(simpanan.lokasiTambahan || []).map(l => l.id),
]

let kunci = ANON
let token = ANON
if (SERVICE) {
  kunci = SERVICE
  token = SERVICE
  catat('memakai kunci service role dari .env')
}
else {
  const s = await masukApi(simpanan.akun.utama.email, simpanan.akun.utama.sandi)
  token = s.data.access_token
  catat(`memakai token akun uji ${simpanan.akun.utama.nama}`)
}

const daftarFolder = async (prefix) => {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/location-photos`, {
    method: 'POST',
    headers: { apikey: kunci, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 200 }),
  })
  const j = await r.json()
  return Array.isArray(j) ? j : []
}

let terhapus = 0
let tersisa = 0
for (const id of FOLDER_UJI) {
  const isi = await daftarFolder(`${id}/`)
  if (!isi.length) { catat(`${id}: kosong`); continue }
  const jalur = isi.map(b => `${id}/${b.name}`)
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/location-photos`, {
    method: 'DELETE',
    headers: { apikey: kunci, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: jalur }),
  })
  const jawab = await r.json()
  const jumlah = Array.isArray(jawab) ? jawab.length : 0
  terhapus += jumlah
  const sisa = await daftarFolder(`${id}/`)
  tersisa += sisa.length
  catat(`${id}: ${jalur.length} berkas, HTTP ${r.status}, terhapus ${jumlah}, sisa ${sisa.length}`)
}

// Folder yang tidak lagi punya lokasi, termasuk peninggalan sesi lain.
const { data: lokasi } = await rest('locations?select=id')
const sah = new Set(lokasi.map(l => l.id))
const akar = await daftarFolder('')
const yatim = akar.map(f => f.name).filter(n => !sah.has(n))
catat(`folder di bucket: ${akar.map(f => f.name).join(', ') || '(kosong)'}`)
catat(`folder tanpa lokasi: ${yatim.join(', ') || 'tidak ada'}`)
catat(`ringkas: ${terhapus} berkas uji terhapus, ${tersisa} berkas uji masih tersisa`)
