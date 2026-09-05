// Menelusuri galat konsol "Hydration completed but contains mismatches" pada
// halaman detail. Dijalankan di dev server lokal karena hanya build pengembangan
// yang menyebutkan simpul mana yang berbeda.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { BERKAS_AKUN } from './lib.mjs'

const simpanan = JSON.parse(readFileSync(BERKAS_AKUN, 'utf8'))
const LOKAL = 'http://localhost:3000'
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'id-ID' })
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}] ${m.text().slice(0, 600)}`)
})
page.on('pageerror', e => console.log('[pageerror] ' + e))

for (const jalur of [`/lokasi/${simpanan.idLokasi}`, '/', '/papan-kontributor', '/tentang', '/daftar', '/masuk']) {
  console.log('=== ' + jalur)
  await page.goto(LOKAL + jalur, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
}
await browser.close()
