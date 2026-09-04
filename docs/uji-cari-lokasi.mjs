// Bukti butir 4 dan 5: tombol lokasi saya dengan titik biru, dan kolom pencarian
// area yang memindahkan pandangan peta.

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

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const [label, viewport] of [
  ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
]) {
  // Posisi palsu di Blok M, supaya izin lokasi tidak menghentikan pengujian.
  const konteks = await browser.newContext({
    ...viewport, locale: 'id-ID', timezoneId: 'Asia/Jakarta',
    permissions: ['geolocation'],
    geolocation: { latitude: -6.2447, longitude: 106.7995, accuracy: 25 },
  })
  const page = await konteks.newPage()
  const galat = []
  page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 140)) })

  await page.goto(BASIS, { waitUntil: 'networkidle' })
  await sembunyikanDevtools(page)
  await page.waitForSelector('.maplibregl-canvas')
  await page.waitForTimeout(9500)

  // --- tidak ada limpahan mendatar setelah header dirombak ---
  const lebar = await page.evaluate(() => {
    const inp = document.querySelector('[aria-label="Cari area di peta"]')
    return {
      vw: innerWidth,
      scroll: document.documentElement.scrollWidth,
      lebarKolom: inp ? Math.round(inp.getBoundingClientRect().width) : 0,
    }
  })
  catat(`Header baru tidak melimpah mendatar (${label})`, lebar.scroll <= lebar.vw,
    `lebar layar ${lebar.vw}, lebar gulung ${lebar.scroll}, kolom cari ${lebar.lebarKolom}px`)

  // --- butir 4: lokasi saya ---
  const sebelum = await page.evaluate(() => document.querySelectorAll('.titik-saya').length)
  await page.click('[aria-label="Ke lokasi saya"]')
  await page.waitForTimeout(3500)
  const titik = await page.evaluate(() => {
    const el = document.querySelector('.titik-saya')
    if (!el) return null
    const g = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return { warna: g.backgroundColor, ukuran: Math.round(r.width), x: Math.round(r.x), y: Math.round(r.y) }
  })
  catat(`Titik biru posisi pengguna muncul (${label})`, sebelum === 0 && !!titik,
    titik ? `${titik.warna}, ${titik.ukuran}px` : 'titik tidak ada')

  await sembunyikanDevtools(page)
  await page.screenshot({ path: join(KELUARAN, `lokasi-saya-${label}.png`) })

  // --- butir 5: cari area ---
  const pusatAwal = await page.evaluate(() => {
    const c = document.querySelector('.maplibregl-canvas')
    return c ? c.width : 0
  })
  await page.fill('[aria-label="Cari area di peta"]', 'Stasiun Kebayoran')
  await page.click('[aria-label="Cari area"]')
  await page.waitForTimeout(4000)

  const daftar = await page.evaluate(() =>
    [...document.querySelectorAll('ul li button span:first-child')].map(s => s.textContent.trim()).slice(0, 3))
  catat(`Pencarian area mengembalikan hasil (${label})`, daftar.length > 0, daftar.join(' | ') || 'kosong')

  await sembunyikanDevtools(page)
  await page.screenshot({ path: join(KELUARAN, `cari-area-${label}.png`) })

  if (daftar.length) {
    const pusat = await page.evaluate(async () => {
      const ambil = () => {
        const p = document.querySelector('.penanda-skor')
        return p ? Math.round(p.getBoundingClientRect().top) : null
      }
      const awal = ambil()
      document.querySelector('ul li button').click()
      await new Promise(r => setTimeout(r, 1600))
      return { awal, akhir: ambil() }
    })
    catat(`Memilih hasil memindahkan pandangan peta (${label})`,
      pusat.awal !== pusat.akhir, `posisi penanda ${pusat.awal} jadi ${pusat.akhir}`)
  }

  if (galat.length) console.log('  galat konsol:', galat.join(' | '))
  await konteks.close()
}

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
