// Uji ulang kepemilikan dan keamanan tulis data, langsung ke PostgREST memakai token
// pengguna sungguhan. Setara langkah 15 sampai 19 pada laporan QA menyeluruh:
//
//   - ambang tiga konfirmasi menaikkan status
//   - tiga konfirmasi "sudah berubah" menurunkan status
//   - penyuntingan oleh pemilik
//   - penyuntingan oleh BUKAN pemilik: boleh untuk daftar periksa dan foto,
//     tetap ditolak untuk nama, kategori, dan koordinat
//
// Berkas ini sadar keadaan: ia mendeteksi apakah schema-patch-5.sql sudah dijalankan,
// lalu menuntut hasil yang sesuai untuk keadaan itu. Sebelum tambalan, penyuntingan
// oleh bukan pemilik HARUS ditolak; sesudahnya HARUS berhasil. Jadi berkas yang sama
// tetap berarti di kedua sisi, dan tidak ada uji yang lulus hanya karena longgar.
//
// Kredensial dibaca dari lingkungan atau .env, tidak pernah ditulis di berkas ini:
//   AKUN_UJI_EMAIL, AKUN_UJI_SANDI
//
// Dua akun tambahan dibuat lewat pendaftaran biasa, dengan alamat bertanda + supaya
// jelas turunan dari akun uji yang sama dan gampang dibersihkan nanti.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BERKAS_ENV = [process.env.BERKAS_ENV, '.env', '../.env', '../../.env']
  .filter(Boolean).map(x => resolve(x)).find(existsSync)

if (!BERKAS_ENV) {
  console.error('Berkas .env tidak ketemu. Jalankan dari akar repo, atau isi BERKAS_ENV.')
  process.exit(1)
}

const env = Object.fromEntries(readFileSync(BERKAS_ENV, 'utf8')
  .split(/\r?\n/).filter(b => b.includes('=')).map((b) => {
    const i = b.indexOf('=')
    return [b.slice(0, i).trim(), b.slice(i + 1).trim()]
  }))

const URL_ = env.SUPABASE_URL
const KUNCI = env.SUPABASE_KEY
const EMAIL = process.env.AKUN_UJI_EMAIL || env.AKUN_UJI_EMAIL
const SANDI = process.env.AKUN_UJI_SANDI || env.AKUN_UJI_SANDI

if (!URL_ || !KUNCI || !EMAIL || !SANDI) {
  console.error('SUPABASE_URL, SUPABASE_KEY, AKUN_UJI_EMAIL, dan AKUN_UJI_SANDI wajib ada.')
  process.exit(1)
}

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

const dasar = { apikey: KUNCI, 'Content-Type': 'application/json' }

async function masuk(email, sandi) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: dasar, body: JSON.stringify({ email, password: sandi }),
  })
  const j = await r.json()
  return j.access_token ?? null
}

async function daftar(email, sandi, nama) {
  const r = await fetch(`${URL_}/auth/v1/signup`, {
    method: 'POST', headers: dasar,
    body: JSON.stringify({ email, password: sandi, data: { nama } }),
  })
  const j = await r.json()
  return j.access_token ?? null
}

function sesi(token) {
  const h = { ...dasar, Authorization: `Bearer ${token}`, Prefer: 'return=representation' }
  return {
    uid: JSON.parse(atob(token.split('.')[1])).sub,
    async kirim(metode, jalur, badan, tambahan = {}) {
      const r = await fetch(`${URL_}/rest/v1/${jalur}`, {
        method: metode,
        headers: { ...h, ...tambahan },
        body: badan === undefined ? undefined : JSON.stringify(badan),
      })
      const teks = await r.text()
      let kode = '-'
      try { kode = JSON.parse(teks).code ?? '-' } catch {}
      let baris = null
      try { baris = JSON.parse(teks) } catch {}
      return {
        status: r.status,
        kode,
        teks,
        baris: Array.isArray(baris) ? baris : null,
        // Berhasil berarti benar-benar ada baris yang tersentuh, bukan sekadar HTTP 2xx.
        // Update yang tidak lolos USING membalas 200 dengan senarai kosong.
        tembus: r.status < 300 && Array.isArray(baris) && baris.length > 0,
      }
    },
  }
}

// ---------- akun ----------
const tokenA = await masuk(EMAIL, SANDI)
if (!tokenA) {
  console.error('Gagal masuk dengan akun uji utama.')
  process.exit(1)
}

const [lokal, domain] = EMAIL.split('@')
const SANDI_TAMBAHAN = SANDI
const AKUN_TAMBAHAN = [
  { email: `${lokal}+ujib@${domain}`, nama: 'Akun Uji B' },
  { email: `${lokal}+ujic@${domain}`, nama: 'Akun Uji C' },
]

const token = [tokenA]
for (const a of AKUN_TAMBAHAN) {
  let t = await masuk(a.email, SANDI_TAMBAHAN)
  if (!t) t = await daftar(a.email, SANDI_TAMBAHAN, a.nama)
  if (!t) {
    console.error(`Gagal menyiapkan akun ${a.email}. Pendaftaran mungkin butuh konfirmasi email.`)
    process.exit(1)
  }
  token.push(t)
}

const A = sesi(token[0])
const B = sesi(token[1])
const C = sesi(token[2])
console.log(`Tiga akun siap: A ${A.uid.slice(0, 8)}, B ${B.uid.slice(0, 8)}, C ${C.uid.slice(0, 8)}\n`)

// ---------- apakah schema-patch-5.sql sudah dijalankan ----------
const cekKolom = await A.kirim('GET', 'locations?select=updated_by,updated_at&limit=1')
const TAMBALAN5 = cekKolom.status < 300
console.log(TAMBALAN5
  ? 'schema-patch-5.sql TERPASANG. Menuntut perilaku setelah pelonggaran.\n'
  : 'schema-patch-5.sql BELUM dipasang. Menuntut perilaku sebelum pelonggaran.\n')

// ---------- lokasi uji milik A ----------
const buat = await A.kirim('POST', 'locations', {
  nama: 'UJI TULIS BERSAMA, hapus setelah pengujian',
  kategori: 'lainnya',
  lat: -6.2599,
  lng: 106.7799,
  created_by: A.uid,
})

if (!buat.tembus) {
  console.error('Gagal membuat lokasi uji:', buat.teks.slice(0, 200))
  process.exit(1)
}
const ID = buat.baris[0].id

await A.kirim('POST', 'accessibility_checklist', {
  location_id: ID,
  ramp_tersedia: true, lebar_pintu_cukup: true, toilet_difabel: false,
  parkir_difabel: false, lift_tersedia_berfungsi: false,
  guiding_block_tersambung: false, tempat_duduk_tersedia: false,
  permukaan_jalan_rata: false,
  catatan: 'Baris pengujian otomatis.',
})

const bacaLokasi = async () => (await A.kirim('GET',
  `locations?select=*&id=eq.${ID}`)).baris?.[0] ?? {}

let l = await bacaLokasi()
catat('Lokasi uji dibuat dan skornya dihitung pemicu', l.skor === 25 && l.status === 'belum_terverifikasi',
  `skor ${l.skor}, status ${l.status}`)

try {
  // ---------- 15. ambang tiga konfirmasi menaikkan status ----------
  console.log('\n15. Ambang tiga konfirmasi')
  const status = []
  for (const [nama, s] of [['A', A], ['B', B], ['C', C]]) {
    await s.kirim('POST', 'confirmations',
      { location_id: ID, user_id: s.uid, is_accurate: true },
      { Prefer: 'resolution=merge-duplicates,return=representation' })
    l = await bacaLokasi()
    status.push(`${nama}:${l.status}`)
  }
  catat('Status naik ke terverifikasi tepat pada konfirmasi ketiga',
    status[0].endsWith('belum_terverifikasi') && status[1].endsWith('belum_terverifikasi')
    && status[2].endsWith('terverifikasi'),
    status.join('  '))

  // ---------- 16. tiga konfirmasi "sudah berubah" menurunkan status ----------
  console.log('\n16. Tiga konfirmasi sudah berubah')
  const turun = []
  for (const [nama, s] of [['A', A], ['B', B], ['C', C]]) {
    await s.kirim('PATCH', `confirmations?location_id=eq.${ID}&user_id=eq.${s.uid}`,
      { is_accurate: false })
    l = await bacaLokasi()
    turun.push(`${nama}:${l.status}`)
  }
  catat('Status turun kembali ke belum terverifikasi',
    l.status === 'belum_terverifikasi', turun.join('  '))

  const barisLokasi = await A.kirim('GET', `locations?select=id&id=eq.${ID}`)
  catat('Baris lokasi TIDAK pernah dihapus otomatis',
    barisLokasi.baris?.length === 1)

  // Dinaikkan lagi supaya penurunan akibat penyuntingan bisa terlihat.
  for (const s of [A, B, C]) {
    await s.kirim('PATCH', `confirmations?location_id=eq.${ID}&user_id=eq.${s.uid}`,
      { is_accurate: true })
  }
  l = await bacaLokasi()
  catat('Status bisa naik lagi setelah laporan berubah ditarik',
    l.status === 'terverifikasi', `status ${l.status}`)

  // ---------- 17. penyuntingan oleh pemilik ----------
  console.log('\n17. Penyuntingan oleh pemilik')
  const suntingA = await A.kirim('PATCH', `accessibility_checklist?location_id=eq.${ID}`,
    { toilet_difabel: true, parkir_difabel: true })
  l = await bacaLokasi()
  catat('Pemilik bisa memperbarui daftar periksa', suntingA.tembus,
    `HTTP ${suntingA.status}, kode ${suntingA.kode}`)
  catat('Skor dihitung ulang oleh pemicu', l.skor === 50, `skor ${l.skor}`)
  catat('Status turun ke belum terverifikasi setelah disunting',
    l.status === 'belum_terverifikasi', `status ${l.status}`)

  const sisaKonfirmasi = await A.kirim('GET', `confirmations?select=id&location_id=eq.${ID}`)
  catat('Konfirmasi lama dihapus karena berlaku untuk data versi lama',
    sisaKonfirmasi.baris?.length === 0, `${sisaKonfirmasi.baris?.length} tersisa`)

  const namaA = await A.kirim('PATCH', `locations?id=eq.${ID}`, { nama: 'UJI TULIS BERSAMA, diubah pemilik' })
  catat('Pemilik tetap bisa mengubah nama lokasinya sendiri', namaA.tembus,
    `HTTP ${namaA.status}`)

  if (TAMBALAN5) {
    l = await bacaLokasi()
    catat('Jejak updated_by terisi pelaku penyuntingan',
      l.updated_by === A.uid && !!l.updated_at,
      `updated_by ${String(l.updated_by).slice(0, 8)}, updated_at ${l.updated_at ? 'terisi' : 'kosong'}`)
  }

  // ---------- 18. penyuntingan oleh BUKAN pemilik ----------
  console.log('\n18. Penyuntingan oleh bukan pemilik')
  const suntingB = await B.kirim('PATCH', `accessibility_checklist?location_id=eq.${ID}`,
    { lift_tersedia_berfungsi: true })

  if (TAMBALAN5) {
    l = await bacaLokasi()
    catat('Bukan pemilik BISA memperbarui daftar periksa, ini disengaja',
      suntingB.tembus, `HTTP ${suntingB.status}, kode ${suntingB.kode}`)
    catat('Skor dihitung ulang setelah pembaruan oleh bukan pemilik',
      l.skor === 63, `skor ${l.skor}`)
    catat('Jejak updated_by mencatat bukan pemilik sebagai pelakunya',
      l.updated_by === B.uid, `updated_by ${String(l.updated_by).slice(0, 8)} berbanding B ${B.uid.slice(0, 8)}`)
    catat('Status kembali belum terverifikasi setelah pembaruan siapa pun',
      l.status === 'belum_terverifikasi', `status ${l.status}`)
  }
  else {
    catat('Sebelum tambalan, bukan pemilik masih ditolak memperbarui daftar periksa',
      !suntingB.tembus, `HTTP ${suntingB.status}, kode ${suntingB.kode}`)
  }

  // ---------- 19. batas yang TIDAK boleh ikut longgar ----------
  console.log('\n19. Batas yang tidak boleh ikut longgar')

  const namaB = await B.kirim('PATCH', `locations?id=eq.${ID}`, { nama: 'DIBAJAK OLEH B' })
  catat('Bukan pemilik TETAP ditolak mengubah nama lokasi', !namaB.tembus,
    `HTTP ${namaB.status}, ${namaB.baris?.length ?? 0} baris berubah`)

  const kategoriB = await B.kirim('PATCH', `locations?id=eq.${ID}`, { kategori: 'mal' })
  catat('Bukan pemilik TETAP ditolak mengubah kategori', !kategoriB.tembus,
    `HTTP ${kategoriB.status}, ${kategoriB.baris?.length ?? 0} baris berubah`)

  const titikB = await B.kirim('PATCH', `locations?id=eq.${ID}`, { lat: -6.1, lng: 106.9 })
  catat('Bukan pemilik TETAP ditolak mengubah koordinat', !titikB.tembus,
    `HTTP ${titikB.status}, ${titikB.baris?.length ?? 0} baris berubah`)

  const sesudah = await bacaLokasi()
  catat('Nama, kategori, dan koordinat benar-benar tidak berubah',
    sesudah.nama === 'UJI TULIS BERSAMA, diubah pemilik'
    && sesudah.kategori === 'lainnya'
    && Math.abs(sesudah.lat + 6.2599) < 1e-6,
    `${sesudah.nama}, ${sesudah.kategori}, ${sesudah.lat}`)

  const skorB = await B.kirim('PATCH', `locations?id=eq.${ID}`, { skor: 100 })
  catat('Bukan pemilik ditolak menulis skor', !skorB.tembus, `HTTP ${skorB.status}`)

  const skorA = await A.kirim('PATCH', `locations?id=eq.${ID}`, { skor: 100 })
  catat('Pemilik sendiri pun ditolak menulis skor', !skorA.tembus,
    `HTTP ${skorA.status}, kode ${skorA.kode}`)

  const statusA = await A.kirim('PATCH', `locations?id=eq.${ID}`, { status: 'terverifikasi' })
  catat('Pemilik sendiri pun ditolak menulis status', !statusA.tembus,
    `HTTP ${statusA.status}, kode ${statusA.kode}`)

  if (TAMBALAN5) {
    // Lubang yang ikut terbuka bersama pelonggaran: memindahkan baris daftar periksa
    // korban ke lokasi milik penyerang. Ditutup lewat hak akses kolom, bukan RLS.
    const lokasiB = await B.kirim('POST', 'locations', {
      nama: 'UJI MILIK B, hapus setelah pengujian',
      kategori: 'lainnya', lat: -6.2601, lng: 106.7801, created_by: B.uid,
    })
    const idB = lokasiB.baris?.[0]?.id

    const pindah = await B.kirim('PATCH', `accessibility_checklist?location_id=eq.${ID}`,
      { location_id: idB })
    catat('Bukan pemilik ditolak MEMINDAHKAN baris daftar periksa ke lokasinya sendiri',
      !pindah.tembus, `HTTP ${pindah.status}, kode ${pindah.kode}`)

    const masihDiSini = await A.kirim('GET', `accessibility_checklist?select=location_id&location_id=eq.${ID}`)
    catat('Baris daftar periksa masih menempel pada lokasi aslinya',
      masihDiSini.baris?.length === 1)

    const jejakB = await A.kirim('PATCH', `locations?id=eq.${ID}`, { updated_by: C.uid })
    catat('Kolom jejak updated_by tidak bisa ditulis klien', !jejakB.tembus,
      `HTTP ${jejakB.status}, kode ${jejakB.kode}`)

    if (idB) await B.kirim('DELETE', `locations?id=eq.${idB}`)

    // ---------- foto ----------
    console.log('\n19b. Foto oleh bukan pemilik')
    const alamatSah = `${URL_}/storage/v1/object/public/location-photos/${ID}/uji.jpg`
    const fotoSah = await B.kirim('POST', 'location_photos', { location_id: ID, photo_url: alamatSah })
    catat('Bukan pemilik BISA menambahkan foto, ini disengaja', fotoSah.tembus,
      `HTTP ${fotoSah.status}, kode ${fotoSah.kode}`)

    const fotoLuar = await B.kirim('POST', 'location_photos',
      { location_id: ID, photo_url: 'https://contoh.invalid/gambar-liar.jpg' })
    catat('Alamat gambar di luar penyimpanan proyek ditolak', !fotoLuar.tembus,
      `HTTP ${fotoLuar.status}, kode ${fotoLuar.kode}`)
  }
}
finally {
  // ---------- pembersihan ----------
  console.log('\nPembersihan')
  await A.kirim('DELETE', `locations?id=eq.${ID}`)
  const sisa = await A.kirim('GET', `locations?select=id&id=eq.${ID}`)
  catat('Lokasi uji terhapus beserta seluruh baris turunannya',
    sisa.baris?.length === 0)

  const nyasar = await A.kirim('GET', 'locations?select=id,nama&nama=like.UJI*')
  catat('Tidak ada baris uji yang tertinggal', (nyasar.baris?.length ?? 0) === 0,
    (nyasar.baris ?? []).map(x => x.nama).join(', ') || 'nihil')
}

const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
console.log(`Dua akun turunan dibuat untuk pengujian ini: ${AKUN_TAMBAHAN.map(a => a.email).join(', ')}`)
console.log('Keduanya perlu ikut dihapus saat pembersihan akun uji sebelum pengumpulan.')
if (gagal.length) process.exitCode = 1
