// Menguji tiap penyaring kebutuhan secara terpisah, lalu satu kombinasi.
// Yang diperiksa bukan cuma tampilan: jumlah penanda di peta dibandingkan dengan
// jumlah lokasi yang benar-benar memenuhi syarat menurut isi basis data.

import { chromium } from 'playwright'
import { join } from 'node:path'

const BASIS = 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')

const KASUS = [
  { nama: 'filter-kursi-roda', pilih: ['Kursi roda'], harap: 3 },
  { nama: 'filter-lansia', pilih: ['Lansia atau stroller'], harap: 4 },
  { nama: 'filter-tunanetra', pilih: ['Tunanetra'], harap: 2 },
  { nama: 'filter-gabungan', pilih: ['Kursi roda', 'Tunanetra'], harap: 2 },
]

async function sembunyikanDevtools(page) {
  await page.addStyleTag({
    content: '#nuxt-devtools-anchor,#nuxt-devtools-container,.nuxt-devtools-anchor{display:none!important}',
  }).catch(() => {})
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const hasil = []

for (const [label, viewport] of [
  ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
]) {
  const konteks = await browser.newContext({ ...viewport, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })

  for (const kasus of KASUS) {
    const page = await konteks.newPage()
    const galat = []
    page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 120)) })

    await page.goto(BASIS, { waitUntil: 'networkidle' })
    await sembunyikanDevtools(page)
    await page.waitForSelector('.maplibregl-canvas')
    await page.waitForTimeout(9000)

    const sebelum = await page.evaluate(() => document.querySelectorAll('.penanda-skor').length)

    for (const teks of kasus.pilih) {
      await page.evaluate((t) => {
        const c = [...document.querySelectorAll('[aria-pressed]')].find(b => b.innerText.includes(t))
        c.click()
      }, teks)
      await page.waitForTimeout(1500)
    }
    await page.waitForTimeout(3500)
    await sembunyikanDevtools(page)

    const sesudah = await page.evaluate(() => document.querySelectorAll('.penanda-skor').length)
    const ditekan = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-pressed="true"]')].map(b => b.innerText.split('\n')[0].trim()))

    await page.screenshot({ path: join(KELUARAN, `${kasus.nama}-${label}.png`) })

    const lolos = sesudah === kasus.harap
    hasil.push({ kasus: kasus.nama, label, sebelum, sesudah, harap: kasus.harap, lolos, ditekan, galat })
    console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${kasus.nama.padEnd(20)} ${label.padEnd(8)} ${sebelum} penanda jadi ${sesudah}, diharapkan ${kasus.harap}  aktif: ${ditekan.join(' + ')}`)
    await page.close()
  }
  await konteks.close()
}

await browser.close()

const gagal = hasil.filter(h => !h.lolos)
const bergalat = hasil.filter(h => h.galat.length)
console.log(`\n${hasil.length - gagal.length} dari ${hasil.length} pemeriksaan lolos`)
console.log(bergalat.length ? 'ada galat konsol' : 'nol galat konsol')
if (gagal.length) process.exitCode = 1
