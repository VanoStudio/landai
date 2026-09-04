// Uji menyeluruh tahap 7, dijalankan lewat antarmuka sungguhan, bukan lewat API.
// Sekaligus mengambil tangkapan layar keadaan sudah masuk untuk laporan.

import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const BASIS = 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')
const AKUN = { email: 'uji.landai@example.com', sandi: 'UjiLandai2026' }

const langkah = []
function catat(nama, lolos, ket = '') {
  langkah.push({ nama, lolos, ket })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

async function sembunyikanDevtools(page) {
  await page.addStyleTag({
    content: `#nuxt-devtools-anchor, #nuxt-devtools-container, .nuxt-devtools-anchor,
              [data-v-inspector-container] { display: none !important; }`,
  }).catch(() => {})
}

async function klik(page, teks) {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === t)
    if (!b) throw new Error('tombol tidak ketemu: ' + t)
    b.click()
  }, teks)
  await page.waitForTimeout(600)
}

await mkdir(KELUARAN, { recursive: true })

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

// --- berkas foto tiruan, mewakili foto kamera di lokasi ---
const halamanFoto = await browser.newPage({ viewport: { width: 1200, height: 900 } })
await halamanFoto.setContent(`
  <div style="width:1200px;height:900px;background:linear-gradient(160deg,#9aa5ad,#cfd6db);
              font-family:sans-serif;display:grid;place-items:center;text-align:center;color:#2b3138">
    <div>
      <div style="font-size:64px;font-weight:700">Foto uji</div>
      <div style="font-size:28px;margin-top:12px">berkas contoh untuk menguji alur unggah</div>
    </div>
  </div>`)
const JALUR_FOTO = join(process.cwd(), 'foto-uji.jpg')
await halamanFoto.screenshot({ path: JALUR_FOTO, type: 'jpeg', quality: 85 })
await halamanFoto.close()

const konteks = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta',
})
const page = await konteks.newPage()
const galat = []
page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 160)) })

// --- 1. masuk ---
await page.goto(`${BASIS}/masuk`, { waitUntil: 'networkidle' })
await sembunyikanDevtools(page)
await page.fill('#email', AKUN.email)
await page.fill('#password', AKUN.sandi)
await klik(page, 'Masuk')
await page.waitForURL(BASIS + '/', { timeout: 20000 })
catat('Masuk dengan akun uji', true, 'dialihkan ke peta')

// --- 2. peta keadaan sudah masuk ---
await page.waitForSelector('.maplibregl-canvas')
await page.waitForTimeout(9000)
await sembunyikanDevtools(page)
await page.screenshot({ path: join(KELUARAN, 'peta-masuk-mobile.png') })
const adaKeluar = await page.evaluate(() =>
  [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Keluar'))
catat('Header berubah saat sudah masuk', adaKeluar, adaKeluar ? 'tombol Keluar muncul' : '')

// --- 3. buka form tanpa dialihkan ---
await page.goto(`${BASIS}/tambah-lokasi`, { waitUntil: 'networkidle' })
await sembunyikanDevtools(page)
const diForm = page.url().includes('tambah-lokasi')
catat('Penjaga rute melepas pengguna yang sudah masuk', diForm, page.url().replace(BASIS, ''))

// --- 4. langkah 1, geser titik dengan mengetuk peta ---
await page.waitForSelector('.maplibregl-canvas')
await page.waitForTimeout(8000)
await sembunyikanDevtools(page)
const kanvas = await page.locator('.maplibregl-canvas').boundingBox()
await page.mouse.click(kanvas.x + kanvas.width * 0.62, kanvas.y + kanvas.height * 0.42)
await page.waitForTimeout(1200)
await page.screenshot({ path: join(KELUARAN, 'form-masuk-1-titik-mobile.png') })
catat('Langkah 1, titik dipindah dengan mengetuk peta', true)

// --- 5. langkah 2, identitas tempat ---
await klik(page, 'Lanjut')
await page.fill('#nama-tempat', 'Taman Literasi Martha Christina Tiahahu')
await page.evaluate(() => {
  const r = [...document.querySelectorAll('input[type=radio]')]
    .find(i => i.value === 'taman')
  r.click()
})
await page.waitForTimeout(500)
catat('Langkah 2, nama dan jenis tempat terisi', true, 'kategori taman')

// --- 6. langkah 3, daftar periksa ---
await klik(page, 'Lanjut')
await page.waitForTimeout(600)
const kotak = await page.$$('input[type=checkbox]')
for (const i of [0, 1, 5, 6, 7]) await kotak[i].click()
await page.waitForTimeout(600)
const pratinjau = await page.evaluate(() =>
  document.querySelector('.text-5xl')?.textContent.trim())
catat('Langkah 3, skor pratinjau ikut bergerak', pratinjau === '63', `5 dari 8 terpenuhi, pratinjau ${pratinjau}`)

// --- 7. langkah 4, foto dan catatan ---
await klik(page, 'Lanjut')
await page.waitForTimeout(600)
await page.setInputFiles('input[type=file]', JALUR_FOTO)
await page.waitForTimeout(2500)
const adaPratinjauFoto = await page.evaluate(() => document.querySelectorAll('img[src^="blob:"]').length)
catat('Foto diproses dan dikecilkan di peramban', adaPratinjauFoto === 1, `${adaPratinjauFoto} pratinjau muncul`)

await page.fill('#catatan', 'Data uji menyeluruh, dibuat otomatis. Hapus sebelum pengumpulan.')
await sembunyikanDevtools(page)
await page.screenshot({ path: join(KELUARAN, 'form-masuk-4-foto-mobile.png') })

// --- 8. simpan ---
await klik(page, 'Simpan lokasi')
await page.waitForURL(/\/lokasi\//, { timeout: 45000 })
const idBaru = page.url().split('/lokasi/')[1]
catat('Lokasi tersimpan dan dialihkan ke detailnya', !!idBaru, idBaru)

// --- 9. detail lokasi baru ---
await page.waitForTimeout(2500)
await sembunyikanDevtools(page)
const skorTersimpan = await page.evaluate(() =>
  document.querySelector('.text-7xl')?.textContent.trim())
catat('Skor dihitung pemicu basis data, pembulatan searah peramban', skorTersimpan === '63', `pratinjau 63, tersimpan ${skorTersimpan}`)

const adaFoto = await page.evaluate(() =>
  [...document.images].some(i => i.src.includes('location-photos')))
catat('Foto terunggah ke Storage dan tampil', adaFoto)

const kontributor = await page.evaluate(() =>
  [...document.querySelectorAll('p')].map(p => p.textContent)
    .find(t => t.includes('Ditambahkan'))?.trim())
catat('Jejak kontributor tercatat', /Akun Uji/.test(kontributor || ''), kontributor?.slice(0, 60))

await page.screenshot({ path: join(KELUARAN, 'detail-masuk-mobile.png') })
await page.screenshot({ path: join(KELUARAN, 'detail-masuk-penuh-mobile.png'), fullPage: true })

// --- 10. konfirmasi akurasi ---
await klik(page, 'Masih akurat')
await page.waitForTimeout(2500)
const teksKonfirmasi = await page.evaluate(() =>
  [...document.querySelectorAll('p')].map(p => p.textContent)
    .find(t => t.includes('menyatakan masih akurat'))?.trim())
catat('Konfirmasi akurasi tersimpan', /^1 warga/.test(teksKonfirmasi || ''), teksKonfirmasi?.slice(0, 50))
await sembunyikanDevtools(page)
await page.screenshot({ path: join(KELUARAN, 'detail-konfirmasi-mobile.png') })

// --- 11. lokasi baru muncul di peta ---
await page.goto(BASIS, { waitUntil: 'networkidle' })
await page.waitForSelector('.maplibregl-canvas')
await page.waitForTimeout(9000)
await sembunyikanDevtools(page)
const jumlahPenanda = await page.evaluate(() =>
  document.querySelectorAll('.penanda-skor').length)
catat('Lokasi baru langsung muncul di peta', jumlahPenanda === 4, `${jumlahPenanda} penanda, 3 seed ditambah 1 baru`)

// --- 12. keluar ---
await klik(page, 'Keluar')
await page.waitForTimeout(2500)
const adaMasuk = await page.evaluate(() =>
  [...document.querySelectorAll('a')].some(a => a.textContent.trim() === 'Masuk'))
catat('Keluar mengembalikan ke mode lihat', adaMasuk)

await browser.close()

console.log('')
const gagal = langkah.filter(l => !l.lolos)
console.log(`${langkah.length - gagal.length} dari ${langkah.length} langkah lolos`)
console.log(galat.length ? `galat konsol: ${galat.join(' | ')}` : 'nol galat konsol sepanjang alur')
await writeFile('hasil-uji.json', JSON.stringify({ langkah, galat }, null, 2))
if (gagal.length) process.exitCode = 1
