// Serangan C: empat event change ditembakkan serentak pada satu input, sebelum
// satu pun pemrosesan selesai. Kalau batas tiga foto hanya dijaga oleh v-if di
// template, keempatnya lolos karena input belum sempat hilang dari DOM.

import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const BASIS = 'http://localhost:3000'
// Kredensial akun uji dibaca dari environment, tidak ditulis di dalam berkas ini.
// Repo ini publik, dan sandi yang tertulis mentah di dalamnya berarti siapa pun bisa
// masuk sebagai kontributor. Isi lewat .env atau di depan perintahnya:
//   AKUN_UJI_EMAIL=... AKUN_UJI_SANDI=... node docs/uji-menyeluruh.mjs
const AKUN = {
  email: process.env.AKUN_UJI_EMAIL,
  sandi: process.env.AKUN_UJI_SANDI,
}

if (!AKUN.email || !AKUN.sandi) {
  console.error('AKUN_UJI_EMAIL dan AKUN_UJI_SANDI belum diisi. Lihat docs/README.md.')
  process.exit(1)
}

const b64 = (await readFile(join(process.cwd(), 'foto-uji.jpg'))).toString('base64')

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

const klik = async (t) => {
  await page.evaluate((x) => {
    [...document.querySelectorAll('button')].find(b => b.textContent.trim() === x)?.click()
  }, t)
  await page.waitForTimeout(500)
}

await page.goto(`${BASIS}/masuk`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.fill('#email', AKUN.email)
await page.fill('#password', AKUN.sandi)
await klik('Masuk')
await page.waitForURL(BASIS + '/', { timeout: 20000 })

await page.goto(`${BASIS}/tambah-lokasi`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)
await klik('Lanjut')
await page.fill('#nama-tempat', 'Uji Batas Foto Ketat')
// Jenis tempat wajib dipilih sejak schema-patch-7.sql: nilai awalnya sengaja kosong
// supaya tidak ada lokasi yang tercatat dengan jenis yang tidak dipilih siapa pun.
await page.evaluate(() => {
  const r = document.querySelector('fieldset input[type=radio]')
  r && r.click()
})
await page.waitForTimeout(300)
await klik('Lanjut')
await klik('Lanjut')
await page.waitForTimeout(600)

const hasil = await page.evaluate(async (data) => {
  const bin = Uint8Array.from(atob(data), c => c.charCodeAt(0))
  const input = document.querySelector('input[type=file]')
  if (!input) return { gagal: 'input tidak ada' }

  // Empat event change beruntun dalam satu tick, tanpa jeda sama sekali.
  for (let i = 0; i < 4; i++) {
    const dt = new DataTransfer()
    dt.items.add(new File([bin], `foto-${i}.jpg`, { type: 'image/jpeg' }))
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }
  return { ditembak: 4 }
}, b64)

await page.waitForTimeout(6000)
const jumlah = await page.evaluate(() => document.querySelectorAll('img[src^="blob:"]').length)

console.log('  event change ditembakkan serentak:', hasil.ditembak ?? hasil.gagal)
console.log('  foto yang benar-benar masuk     :', jumlah)
console.log('  batas tiga ditegakkan           :', jumlah <= 3 ? 'YA' : `TIDAK, tembus ke ${jumlah}`)

await browser.close()
process.exitCode = jumlah <= 3 ? 0 : 1
