// Bukti butir 8 dan 10. Butir 9 tidak bisa diuji di sini karena provider Google
// masih mati di Supabase; yang justru bisa dibuktikan sekarang adalah jalur galatnya.

import { chromium } from 'playwright'
import { join } from 'node:path'

const BASIS = 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

const sembunyikanDevtools = page => page.addStyleTag({
  content: '#nuxt-devtools-anchor,#nuxt-devtools-container,.nuxt-devtools-anchor{display:none!important}',
}).catch(() => {})

const browser = await chromium.launch()
const konteks = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  locale: 'id-ID', timezoneId: 'Asia/Jakarta',
})
const page = await konteks.newPage()
const galat = []
page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 140)) })

// --- butir 8: tombol ada di kedua halaman ---
for (const rute of ['/masuk', '/daftar']) {
  await page.goto(BASIS + rute, { waitUntil: 'networkidle' })
  await sembunyikanDevtools(page)
  await page.waitForTimeout(600)

  const tombol = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Masuk dengan Google'))
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { tinggi: Math.round(r.height), lebar: Math.round(r.width), lambang: b.querySelectorAll('svg path').length }
  })
  catat(`Tombol Masuk dengan Google ada di ${rute}`, !!tombol && tombol.tinggi >= 44,
    tombol ? `${tombol.lebar}x${tombol.tinggi}px, lambang ${tombol.lambang} jalur` : 'tombol tidak ada')
}

// --- butir 10: provider mati harus menjelaskan sebabnya, bukan gagal diam ---
await page.goto(`${BASIS}/masuk`, { waitUntil: 'networkidle' })
await sembunyikanDevtools(page)
await page.waitForTimeout(600)

const alamatSebelum = page.url()
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find(x => x.textContent.includes('Masuk dengan Google'))?.click()
})
await page.waitForTimeout(4000)

const pesan = await page.evaluate(() =>
  [...document.querySelectorAll('[role=alert]')].map(e => e.textContent.trim()).join(' '))
const tetapDiHalaman = page.url() === alamatSebelum

catat('Provider mati menjelaskan sebabnya, bukan gagal diam',
  pesan.includes('Google belum aktif') && pesan.includes('Supabase'), pesan.slice(0, 110))
catat('Pengguna tidak dilempar ke halaman JSON mentah', tetapDiHalaman, page.url().replace(BASIS, '') || '/')

await sembunyikanDevtools(page)
await page.screenshot({ path: join(KELUARAN, 'google-provider-mati-mobile.png') })

// --- galat yang datang lewat alamat pendaratan juga diterjemahkan ---
await page.goto(`${BASIS}/konfirmasi?error=server_error&error_description=Unsupported+provider%3A+provider+is+not+enabled`, { waitUntil: 'networkidle' })
await sembunyikanDevtools(page)
await page.waitForTimeout(900)
const pesanPendaratan = await page.evaluate(() =>
  document.querySelector('[role=alert]')?.textContent.trim() ?? '')
catat('Galat dari alamat pendaratan ikut diterjemahkan',
  pesanPendaratan.includes('Google belum aktif'), pesanPendaratan.slice(0, 90))
await page.screenshot({ path: join(KELUARAN, 'google-pendaratan-galat-mobile.png') })

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
console.log(galat.length ? `galat konsol: ${galat.join(' | ')}` : 'nol galat konsol')
if (gagal.length) process.exitCode = 1
