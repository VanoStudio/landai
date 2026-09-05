// Pola judul halaman, diperiksa di peramban sungguhan pada SETIAP halaman.
//
// Aturannya satu, dan pengecualiannya juga satu:
//
//   - Peta, satu-satunya pengecualian, memakai judul lengkap yang deskriptif.
//     Halaman itu yang paling sering dibagikan tautannya, jadi judulnya harus
//     berdiri sendiri tanpa konteks apa pun.
//   - Halaman lain memakai "Nama Halaman | Landai".
//   - Halaman detail lokasi memakai nama lokasinya: "The Park Pejaten | Landai".
//
// Dua halaman di antaranya berpenjaga rute, jadi pengujian ini masuk memakai akun
// uji lebih dulu. Tanpa itu keduanya hanya akan dialihkan ke halaman masuk dan
// judulnya tidak pernah teruji.
//
// Jalankan dari akar repo selagi dev server hidup:
//
//   node docs/qa/uji-judul-halaman.mjs

import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const BASIS = process.env.BASIS_UJI || 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')

const JUDUL_PETA = 'Landai: Peta Aksesibilitas Kota yang Ramah Difabel'

const BERKAS_ENV = [process.env.BERKAS_ENV, '.env', '../.env', '../../.env']
  .filter(Boolean).map(x => resolve(x)).find(existsSync)

if (!BERKAS_ENV) {
  console.error('Berkas .env tidak ketemu. Jalankan dari akar repo, atau isi BERKAS_ENV.')
  process.exit(1)
}

const env = Object.fromEntries(readFileSync(BERKAS_ENV, 'utf8')
  .split(String.fromCharCode(10)).map(b => b.trim()).filter(b => b.includes('='))
  .map((b) => {
    const i = b.indexOf('=')
    return [b.slice(0, i).trim(), b.slice(i + 1).trim()]
  }))

const EMAIL = process.env.AKUN_UJI_EMAIL || env.AKUN_UJI_EMAIL
const SANDI = process.env.AKUN_UJI_SANDI || env.AKUN_UJI_SANDI

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

// Satu lokasi sungguhan diambil dari basis data, supaya judul dinamisnya diuji
// terhadap nama yang benar-benar ada, bukan terhadap tebakan.
const lokasi = (await (await fetch(
  `${env.SUPABASE_URL}/rest/v1/locations?select=id,nama&limit=1`,
  { headers: { apikey: env.SUPABASE_KEY } })).json())[0]

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const konteks = await browser.newContext({
  viewport: { width: 1280, height: 900 }, locale: 'id-ID',
})
const page = await konteks.newPage()

await page.goto(`${BASIS}/masuk`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await page.fill('#email', EMAIL)
await page.fill('#password', SANDI)
await page.click('button[type=submit]')
await page.waitForURL(u => !u.pathname.startsWith('/masuk'), { timeout: 25000 })
await page.waitForTimeout(1500)

const HALAMAN = [
  { alamat: '/', harap: JUDUL_PETA, catatan: 'pengecualian, judul lengkap' },
  { alamat: '/tentang', harap: 'Tentang | Landai' },
  { alamat: '/akun', harap: 'Akun | Landai' },
  { alamat: '/papan-kontributor', harap: 'Papan Kontributor | Landai' },
  { alamat: '/tambah-lokasi', harap: 'Tambah Lokasi | Landai' },
]

if (lokasi) HALAMAN.push({ alamat: `/lokasi/${lokasi.id}`, harap: `${lokasi.nama} | Landai` })

for (const h of HALAMAN) {
  await page.goto(BASIS + h.alamat, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const judul = await page.title()
  catat(`Judul ${h.alamat}${h.catatan ? ' (' + h.catatan + ')' : ''}`,
    judul === h.harap, `"${judul}"`)
}

// Halaman masuk dan daftar diperiksa tanpa akun, karena keduanya mengalihkan
// pengunjung yang sudah masuk kembali ke peta.
const tamu = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'id-ID' })
const pTamu = await tamu.newPage()
for (const h of [
  { alamat: '/masuk', harap: 'Masuk | Landai' },
  { alamat: '/daftar', harap: 'Daftar Akun | Landai' },
]) {
  await pTamu.goto(BASIS + h.alamat, { waitUntil: 'domcontentloaded' })
  await pTamu.waitForTimeout(1800)
  const judul = await pTamu.title()
  catat(`Judul ${h.alamat}`, judul === h.harap, `"${judul}"`)
}

// Tautan menuju pendaftaran tidak boleh berbunyi "Daftar" sendirian, karena di
// halaman masuk kata itu bersanding dengan tombol yang benar-benar mendaftarkan.
await pTamu.goto(`${BASIS}/masuk`, { waitUntil: 'domcontentloaded' })
await pTamu.waitForTimeout(1500)
const tautanDaftar = await pTamu.evaluate(() =>
  [...document.querySelectorAll('a[href="/daftar"]')].map(a => a.textContent.trim()))
catat('Tautan pendaftaran di halaman masuk berbunyi "Daftar akun"',
  tautanDaftar.every(t => t === 'Daftar akun'), tautanDaftar.join(' | '))

await pTamu.close()
await tamu.close()

// ---------- label pemindah tampilan ----------
await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.maplibregl-canvas')
await page.waitForTimeout(5000)
await page.addStyleTag({
  content: '#nuxt-devtools-anchor,#nuxt-devtools-container{display:none!important}',
}).catch(() => {})

const label = await page.evaluate(() =>
  [...document.querySelectorAll('[role=tablist][aria-label="Pindah tampilan"] [role=tab]')]
    .map(b => b.textContent.trim()))

catat('Pemindah tampilan berlabel Peta dan Daftar Lokasi',
  label.join(' | ') === 'Peta | Daftar Lokasi', label.join(' | '))

const sisaDaftar = await page.evaluate(() =>
  [...document.querySelectorAll('button, a')]
    .map(e => e.textContent.trim())
    .filter(t => t === 'Daftar'))
catat('Tidak ada kendali berlabel "Daftar" sendirian di peta',
  sisaDaftar.length === 0, `${sisaDaftar.length} ditemukan`)

await page.screenshot({ path: join(KELUARAN, 'judul-label-peta.png') })

await page.close()
await konteks.close()
await browser.close()

const gagal = langkah.filter(l => !l.lolos)
console.log(`\n  ${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
process.exitCode = gagal.length ? 1 : 0
