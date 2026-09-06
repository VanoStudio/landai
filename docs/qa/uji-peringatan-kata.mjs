// Alur peringatan isi kasar pada formulir tambah lokasi, diuji lewat peramban
// sungguhan dengan akun uji nyata.
//
// Yang dijaga di sini bukan deteksinya, itu sudah diuji terpisah di
// uji-saring-kata.mjs tanpa peramban. Yang dijaga adalah JANJI PERILAKUNYA:
// peringatan menahan pengiriman tepat satu kali, persetujuan berlaku hanya untuk isi
// yang persis sama, dan mengubah isi setelah disetujui membuat peringatannya berhak
// muncul lagi. Tiga hal itu yang membedakan peringatan sungguhan dari hiasan.
//
// Lokasi yang terlanjur tersimpan selama pengujian dihapus lagi di akhir.
//
// Jalankan dari akar repo selagi dev server hidup:
//
//   node docs/qa/uji-peringatan-kata.mjs

import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

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

const BANNER = 'section:has(> h2:text-is("Ada kata yang mungkin kasar"))'

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

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const konteks = await browser.newContext({
  viewport: { width: 900, height: 900 }, locale: 'id-ID',
})
const page = await konteks.newPage()

await page.goto(`${BASIS}/masuk`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await page.fill('#email', EMAIL)
await page.fill('#password', SANDI)
await page.click('button[type=submit]')
await page.waitForURL(u => !u.pathname.startsWith('/masuk'), { timeout: 25000 })

const bersihkan = () => page.addStyleTag({
  content: '#nuxt-devtools-anchor,#nuxt-devtools-container{display:none!important}',
}).catch(() => {})

// Membawa formulir dari langkah titik sampai langkah terakhir, mengisi nama di
// jalan. Dipakai ulang oleh setiap skenario supaya tiap skenario mulai dari nol.
async function isiFormulir(namaTempat) {
  await page.goto(`${BASIS}/tambah-lokasi`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.maplibregl-canvas')
  await page.waitForTimeout(5000)
  await bersihkan()

  await page.getByRole('button', { name: 'Lanjut' }).click()   // titik
  await page.waitForTimeout(600)
  await page.fill('#nama-tempat', namaTempat)
  await page.waitForTimeout(300)
}

async function keLangkahTerakhir() {
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Lanjut' }).click()
    await page.waitForTimeout(700)
  }
}

const adaBanner = () => page.locator(BANNER).isVisible().catch(() => false)

// ---------- 1. nama kasar polos tertahan saat dikirim ----------
await isiFormulir('Warung Bangsat')
await keLangkahTerakhir()
await page.getByRole('button', { name: /Simpan lokasi/ }).click()
await page.waitForTimeout(1200)

catat('Nama kasar menahan pengiriman dan memunculkan peringatan', await adaBanner())
catat('Halaman tidak berpindah, jadi lokasinya belum tersimpan',
  new URL(page.url()).pathname === '/tambah-lokasi', new URL(page.url()).pathname)

const isiBanner = await page.locator(BANNER).innerText().catch(() => '')
catat('Peringatan menyensor kata yang terpicu, tidak menuliskannya utuh',
  /b\*+t/.test(isiBanner) && !/bangsat/i.test(isiBanner),
  (isiBanner.match(/terbaca\s+\S+/) || [''])[0])
catat('Peringatan menyebut kolom mana yang bermasalah',
  /Pada nama tempat terbaca/.test(isiBanner),
  (isiBanner.match(/Pada [^.]{0,48}/) || [''])[0])
await page.screenshot({ path: join(KELUARAN, 'peringatan-kata.png') })

// ---------- 2. Perbaiki dulu membawa balik ke kolomnya ----------
await page.getByRole('button', { name: 'Perbaiki dulu' }).click()
await page.waitForTimeout(900)
const fokus = await page.evaluate(() => document.activeElement?.id ?? '')
catat('Perbaiki dulu melompat ke langkah nama dan memfokuskan kolomnya',
  fokus === 'nama-tempat', `fokus pada "${fokus}"`)
catat('Peringatan hilang setelah diajak memperbaiki', !(await adaBanner()))

// ---------- 3. leetspeak juga tertahan ----------
await page.fill('#nama-tempat', 'Warung B4NGS4T')
await page.waitForTimeout(300)
await keLangkahTerakhir()
await page.getByRole('button', { name: /Simpan lokasi/ }).click()
await page.waitForTimeout(1200)
catat('Penyamaran leetspeak ikut tertahan', await adaBanner())

// ---------- 4. Tetap kirim melanjutkan, dan tidak bertanya dua kali ----------
await page.getByRole('button', { name: 'Tetap kirim' }).click()
await page.waitForURL(u => u.pathname.startsWith('/lokasi/'), { timeout: 30000 })
catat('Tetap kirim melanjutkan pengiriman sampai halaman detail',
  page.url().includes('/lokasi/'), new URL(page.url()).pathname)

const idTersimpan = new URL(page.url()).pathname.split('/').pop()

// ---------- 5. isi yang wajar tidak pernah diganggu ----------
// Dikerjakan sebelum uji catatan, karena lokasi bersih inilah yang dipakai untuk
// mengisolasi peringatan pada kolom catatan. Kalau memakai lokasi bernama kasar dari
// langkah sebelumnya, kedua kolom akan terpicu dan kolomnya tidak teruji terpisah.
await isiFormulir('Klinik Hewan Anjing dan Kucing Sehat')
await keLangkahTerakhir()
await page.fill('#catatan', 'Ramp di pintu utara agak curam tapi masih bisa dilewati kursi roda. '
  + 'Toilet difabel ada di lantai satu dekat lift, pintunya cukup lebar.')
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Simpan lokasi/ }).click()
await page.waitForURL(u => u.pathname.startsWith('/lokasi/'), { timeout: 30000 })
catat('Nama dan catatan yang wajar tersimpan tanpa peringatan sama sekali',
  page.url().includes('/lokasi/') && !(await adaBanner()))

const idBersih = new URL(page.url()).pathname.split('/').pop()

// Membuka mode sunting sampai langkah catatan pada lokasi tertentu.
async function bukaSuntingSampaiCatatan(id) {
  await page.goto(`${BASIS}/tambah-lokasi?ubah=${id}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.maplibregl-canvas')
  await page.waitForTimeout(5000)
  await bersihkan()
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Lanjut' }).click()
    await page.waitForTimeout(700)
  }
}

// ---------- 6. catatan kasar pada mode sunting ----------
await bukaSuntingSampaiCatatan(idBersih)
await page.fill('#catatan', 'petugasnya goblok, tidak mau bantu')
await page.waitForTimeout(300)
await page.getByRole('button', { name: /Simpan perubahan/ }).click()
await page.waitForTimeout(1200)
catat('Catatan kasar juga tertahan di mode sunting', await adaBanner())

const isiBanner2 = await page.locator(BANNER).innerText().catch(() => '')
// Dicocokkan pada kalimat pembukanya saja, bukan pada seluruh isi banner. Kalimat
// penutupnya memuat frasa "nama tempat" sebagai penjelasan, jadi mencari frasa itu
// di sembarang tempat selalu gagal walaupun kodenya benar.
catat('Peringatan menyebut kolom catatan saja, karena hanya catatan yang bermasalah',
  /Pada catatan tambahan terbaca/.test(isiBanner2) && !/Pada nama tempat/.test(isiBanner2),
  (isiBanner2.match(/Pada [^.]{0,48}/) || [''])[0])

// ---------- 7. persetujuan berlaku hanya untuk isi yang sama ----------
await page.getByRole('button', { name: 'Tetap kirim' }).click()
await page.waitForTimeout(2500)
catat('Peringatan tidak muncul lagi untuk isi yang sama', !(await adaBanner()))

await bukaSuntingSampaiCatatan(idBersih)
await page.fill('#catatan', 'petugasnya tolol sekali, tidak mau bantu')
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Simpan perubahan/ }).click()
await page.waitForTimeout(1200)
catat('Mengubah isi setelah disetujui membuat peringatan muncul lagi', await adaBanner())

// ---------- 8. dua kolom bermasalah sekaligus disebut dua-duanya ----------
await bukaSuntingSampaiCatatan(idTersimpan)
await page.fill('#catatan', 'petugasnya goblok, tidak mau bantu')
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Simpan perubahan/ }).click()
await page.waitForTimeout(1200)
const isiBanner3 = await page.locator(BANNER).innerText().catch(() => '')
catat('Nama dan catatan sama-sama kasar disebut dua-duanya',
  /Pada nama tempat dan catatan tambahan terbaca/.test(isiBanner3),
  (isiBanner3.match(/Pada [^.]{0,48}/) || [''])[0])
catat('Kata dari kedua kolom dilaporkan sekaligus',
  (isiBanner3.match(/\*/g) || []).length >= 8, 'jumlah huruf tersensor')

await page.close()
await konteks.close()
await browser.close()

// ---------- bersih-bersih ----------
let terhapus = 0
for (const id of [idTersimpan, idBersih].filter(Boolean)) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/locations?id=eq.${id}`,
    { method: 'DELETE', headers: auth })
  if (r.ok) terhapus++
}
catat('Lokasi uji dihapus kembali', terhapus === 2, `${terhapus} dari 2`)

const gagal = langkah.filter(l => !l.lolos)
console.log(`\n  ${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
process.exitCode = gagal.length ? 1 : 0
