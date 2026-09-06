// Empat perbaikan alur foto dan alur simpan, diuji lewat peramban sungguhan.
//
// Yang diuji:
//   1. Setelah menyimpan lokasi baru, ada kabar keberhasilan, dan tombol kembali
//      peramban membawa ke peta, BUKAN kembali ke formulir yang sudah selesai.
//   2. Foto bisa ditambahkan langsung dari halaman detail, tanpa melewati formulir
//      sunting empat langkah.
//   3. Foto bisa dibuka ukuran penuh, berpindah antar foto, dan ditutup.
//   4. Watermark landai benar-benar tertanam DI PIKSEL berkasnya, bukan ditumpuk
//      lewat CSS. Diperiksa dengan menggambar ulang berkas yang sudah tersimpan di
//      Storage ke kanvas, lalu mencacah warnanya di pojok kiri atas.
//
// Lokasi yang dibuat selama pengujian dihapus lagi di akhir, beserta fotonya.
//
// Jalankan dari akar repo selagi dev server hidup:
//
//   node docs/qa/uji-alur-foto.mjs

import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { deflateSync } from 'node:zlib'

const BASIS = process.env.BASIS_UJI || 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')

const BERKAS_ENV = [process.env.BERKAS_ENV, '.env', '../.env', '../../.env']
  .filter(Boolean).map(x => resolve(x)).find(existsSync)

if (!BERKAS_ENV) {
  console.error('Berkas .env tidak ketemu. Jalankan dari akar repo, atau isi BERKAS_ENV.')
  process.exit(1)
}

const env = Object.fromEntries(readFileSync(BERKAS_ENV, 'utf8')
  .split(String.fromCharCode(10)).map(b => b.trim()).filter(b => b.includes('='))
  .map((b) => { const i = b.indexOf('='); return [b.slice(0, i).trim(), b.slice(i + 1).trim()] }))

const EMAIL = process.env.AKUN_UJI_EMAIL || env.AKUN_UJI_EMAIL
const SANDI = process.env.AKUN_UJI_SANDI || env.AKUN_UJI_SANDI

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

const j = await (await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: env.SUPABASE_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: SANDI }),
})).json()
const auth = {
  apikey: env.SUPABASE_KEY,
  Authorization: `Bearer ${j.access_token}`,
  'Content-Type': 'application/json',
}

// Gambar uji dibangkitkan di sini sebagai PNG yang sah, bukan untai base64 yang
// diketik tangan. Untai yang diketik tangan mudah rusak tanpa ketahuan, dan yang
// terlihat kemudian bukan "gambar rusak" melainkan "unggahan gagal", yang menuduh
// bagian yang salah.
//
// Warnanya gelap rata, supaya pil putih dan hijau merek pada watermark benar-benar
// menonjol saat pikselnya dicacah nanti.
function crc32(buf) {
  let c
  const tabel = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    tabel[n] = c >>> 0
  }
  let crc = 0xFFFFFFFF
  for (const b of buf) crc = tabel[(crc ^ b) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function potongan(jenis, isi) {
  const panjang = Buffer.alloc(4)
  panjang.writeUInt32BE(isi.length)
  const badan = Buffer.concat([Buffer.from(jenis, 'ascii'), isi])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(badan))
  return Buffer.concat([panjang, badan, crc])
}

function buatPngUji(lebar, tinggi, [r, g, b]) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(lebar, 0)
  ihdr.writeUInt32BE(tinggi, 4)
  ihdr[8] = 8    // kedalaman bit
  ihdr[9] = 2    // truecolor RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // Tiap baris diawali satu bita penanda filter, di sini selalu nol.
  const baris = Buffer.alloc(1 + lebar * 3)
  for (let x = 0; x < lebar; x++) {
    baris[1 + x * 3] = r
    baris[2 + x * 3] = g
    baris[3 + x * 3] = b
  }
  const mentah = Buffer.concat(Array.from({ length: tinggi }, () => baris))

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    potongan('IHDR', ihdr),
    potongan('IDAT', deflateSync(mentah)),
    potongan('IEND', Buffer.alloc(0)),
  ])
}

const GAMBAR_UJI = buatPngUji(800, 600, [40, 44, 52])

const NAMA_UJI = 'UJI ALUR FOTO, hapus kalau tertinggal'

async function bersihkanSisaUji() {
  const lok = await (await fetch(
    `${env.SUPABASE_URL}/rest/v1/locations?select=id,nama&nama=eq.${encodeURIComponent(NAMA_UJI)}`,
    { headers: auth })).json()

  for (const l of lok) {
    const foto = await (await fetch(
      `${env.SUPABASE_URL}/rest/v1/location_photos?select=photo_url&location_id=eq.${l.id}`,
      { headers: auth })).json()
    for (const f of foto) {
      const jalur = f.photo_url.split('/location-photos/')[1]
      await fetch(`${env.SUPABASE_URL}/storage/v1/object/location-photos/${jalur}`,
        { method: 'DELETE', headers: auth })
    }
    await fetch(`${env.SUPABASE_URL}/rest/v1/locations?id=eq.${l.id}`,
      { method: 'DELETE', headers: auth })
  }
  return lok.length
}

const sisaAwal = await bersihkanSisaUji()
if (sisaAwal) console.log(`  ${sisaAwal} sisa uji dari jalannya sebelumnya dibersihkan dulu
`)

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const konteks = await browser.newContext({
  viewport: { width: 900, height: 900 }, locale: 'id-ID',
})
const page = await konteks.newPage()

const bersihkan = () => page.addStyleTag({
  content: '#nuxt-devtools-anchor,#nuxt-devtools-container{display:none!important}',
}).catch(() => {})

await page.goto(`${BASIS}/masuk`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await page.fill('#email', EMAIL)
await page.fill('#password', SANDI)
await page.click('button[type=submit]')
await page.waitForURL(u => !u.pathname.startsWith('/masuk'), { timeout: 25000 })

// ---------- 1. alur simpan: kabar keberhasilan dan tombol kembali ----------
//
// Sengaja dimulai dari peta lalu menekan tautannya, bukan langsung ke alamat
// formulir, karena yang diuji justru tumpukan riwayat peramban.
await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.maplibregl-canvas')
await page.waitForTimeout(5000)
await bersihkan()

await page.getByRole('link', { name: /Tambah lokasi/i }).first().click()
await page.waitForURL(u => u.pathname === '/tambah-lokasi', { timeout: 20000 })
await page.waitForSelector('.maplibregl-canvas')
await page.waitForTimeout(4500)

await page.getByRole('button', { name: 'Lanjut', exact: true }).click()
await page.waitForTimeout(600)
await page.fill('#nama-tempat', NAMA_UJI)
await page.waitForTimeout(300)
for (let i = 0; i < 2; i++) {
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click()
  await page.waitForTimeout(700)
}
await page.getByRole('button', { name: /Simpan lokasi/ }).click()
await page.waitForURL(u => u.pathname.startsWith('/lokasi/'), { timeout: 30000 })

const idLokasi = new URL(page.url()).pathname.split('/').pop()

const kabar = await page.locator('[role=status], [role=alert]').allInnerTexts().catch(() => [])
catat('Menyimpan lokasi baru memberi kabar keberhasilan',
  kabar.some(t => /tersimpan/i.test(t)),
  (kabar.find(t => /tersimpan/i.test(t)) ?? kabar.join(' | ')).slice(0, 70))

await page.goBack({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
const setelahKembali = new URL(page.url()).pathname
catat('Tombol kembali membawa ke peta, bukan balik ke formulir yang sudah selesai',
  setelahKembali === '/', `mendarat di ${setelahKembali}`)

// ---------- 2. tambah foto langsung dari halaman detail ----------
await page.goto(`${BASIS}/lokasi/${idLokasi}`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await bersihkan()

const tombolTambah = page.getByRole('button', { name: 'Tambah foto' })
  .or(page.locator('label:has-text("Tambah foto")'))
catat('Halaman detail menyediakan tambah foto langsung, tanpa lewat formulir sunting',
  await tombolTambah.first().isVisible().catch(() => false))

await page.setInputFiles('input[type=file]', {
  name: 'uji.png', mimeType: 'image/png', buffer: GAMBAR_UJI,
})
await page.waitForTimeout(6000)

const jumlahFoto = await page.locator('ul li img').count()
catat('Foto tersimpan dan langsung tampil tanpa memuat ulang halaman',
  jumlahFoto >= 1, `${jumlahFoto} foto di layar`)

// Foto kedua, supaya perpindahan antar foto pada pratinjau ikut teruji.
await page.setInputFiles('input[type=file]', {
  name: 'uji2.png', mimeType: 'image/png', buffer: GAMBAR_UJI,
})
await page.waitForTimeout(6000)
catat('Foto kedua ikut tersimpan', (await page.locator('ul li img').count()) >= 2,
  `${await page.locator('ul li img').count()} foto`)

// ---------- 3. pratinjau layar penuh ----------
await page.getByRole('button', { name: /Lihat foto 1 dari/ }).click()
await page.waitForTimeout(900)

const dialog = page.locator('[role=dialog][aria-modal=true]')
catat('Mengetuk foto membuka pratinjau layar penuh', await dialog.isVisible())
catat('Pratinjau menampilkan foto utuh, tidak dipangkas',
  await dialog.locator('img.object-contain').isVisible())
catat('Pratinjau menunjukkan nomor foto keberapa',
  /1 dari 2/.test(await dialog.innerText()), (await dialog.innerText()).split('\n')[0])
await page.screenshot({ path: join(KELUARAN, 'pratinjau-foto.png') })

await page.getByRole('button', { name: 'Foto berikutnya' }).click()
await page.waitForTimeout(700)
catat('Tombol berikutnya berpindah ke foto kedua',
  /2 dari 2/.test(await dialog.innerText()))

await page.keyboard.press('Escape')
await page.waitForTimeout(600)
catat('Escape menutup pratinjau', !(await dialog.isVisible().catch(() => false)))

// ---------- 4. watermark tertanam di piksel berkasnya ----------
const alamat = await page.locator('ul li img').first().getAttribute('src')

// Berkasnya diambil ulang dari Storage lalu digambar ke kanvas. Kalau watermark-nya
// cuma lapisan CSS, warna pil putih dan hijau merek tidak akan ada di piksel berkas.
const cacah = await page.evaluate(async (url) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url })

  const k = document.createElement('canvas')
  k.width = img.naturalWidth
  k.height = img.naturalHeight
  const ctx = k.getContext('2d')
  ctx.drawImage(img, 0, 0)

  // Hanya sudut kiri atas yang dicacah, tempat tandanya seharusnya berada.
  const w = Math.round(k.width * 0.45)
  const h = Math.round(k.height * 0.2)
  const d = ctx.getImageData(0, 0, w, h).data

  let putih = 0
  let hijau = 0
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]]
    if (r > 235 && g > 235 && b > 235) putih++
    // Hijau merek #0F6E56, diberi kelonggaran karena JPEG memampatkan warna.
    if (Math.abs(r - 15) < 46 && Math.abs(g - 110) < 46 && Math.abs(b - 86) < 46) hijau++
  }
  return { lebar: k.width, tinggi: k.height, putih, hijau, total: d.length / 4 }
}, alamat)

catat('Berkas foto memuat piksel pil putih watermark',
  cacah.putih > 200, `${cacah.putih} piksel putih di sudut kiri atas`)
catat('Berkas foto memuat piksel hijau merek landai',
  cacah.hijau > 100, `${cacah.hijau} piksel hijau merek`)
catat('Watermark hanya menempati sudut, tidak menutupi isi foto',
  cacah.putih / cacah.total < 0.35,
  `${Math.round((cacah.putih / cacah.total) * 100)} persen dari area sudut`)
catat('Foto tetap diperkecil ke sisi maksimal 1600 piksel',
  Math.max(cacah.lebar, cacah.tinggi) <= 1600, `${cacah.lebar}x${cacah.tinggi}`)

await page.close()
await konteks.close()
await browser.close()

// ---------- bersih-bersih ----------
const fotoTersisa = await (await fetch(
  `${env.SUPABASE_URL}/rest/v1/location_photos?select=photo_url&location_id=eq.${idLokasi}`,
  { headers: auth })).json()

for (const f of fotoTersisa) {
  const jalur = f.photo_url.split('/location-photos/')[1]
  await fetch(`${env.SUPABASE_URL}/storage/v1/object/location-photos/${jalur}`,
    { method: 'DELETE', headers: auth })
}
await fetch(`${env.SUPABASE_URL}/rest/v1/locations?id=eq.${idLokasi}`,
  { method: 'DELETE', headers: auth })

const sisa = await (await fetch(
  `${env.SUPABASE_URL}/rest/v1/locations?select=id&nama=like.UJI*`, { headers: auth })).json()
catat('Lokasi dan foto uji dihapus kembali', Array.isArray(sisa) && sisa.length === 0,
  `${Array.isArray(sisa) ? sisa.length : '?'} tersisa`)

const gagal = langkah.filter(l => !l.lolos)
console.log(`\n  ${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
process.exitCode = gagal.length ? 1 : 0
