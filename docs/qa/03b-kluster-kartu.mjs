// Bukti perbaikan: sekali ketuk pada kelompok memisahkan seluruh anggotanya, dan
// kartu ringkas menampilkan foto sungguhan. Dijalankan dua kali: sekali ke tautan
// hosting yang belum menerima perbaikan, sekali ke dev server yang sudah.
//   node docs/qa/03b-kluster-kartu.mjs                 -> produksi, keadaan sebelum
//   QA_BASE=http://localhost:3000 node docs/qa/03b-kluster-kartu.mjs  -> sesudah
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { BASE, bidik, catat, pantauKonsol, rest } from './lib.mjs'
import { BERKAS_AKUN } from './lib.mjs'

const simpanan = JSON.parse(readFileSync(BERKAS_AKUN, 'utf8'))
const tanda = BASE.includes('localhost') ? 'sesudah' : 'sebelum'

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const konteks = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta',
})
const page = await konteks.newPage()
const galat = pantauKonsol(page, `kluster-${tanda}`)

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.maplibregl-canvas', { timeout: 40000 })
await page.waitForTimeout(10000)
await page.addStyleTag({ content: '#nuxt-devtools-anchor,#nuxt-devtools-container{display:none!important}' }).catch(() => {})
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(e => /Mengerti|Tutup|Mulai/i.test(e.textContent))
  if (b) b.click()
})
await page.waitForTimeout(800)

// Ketuk kelompok terbesar berulang sampai tidak ada kelompok tersisa, hitung ketukan.
let ketukan = 0
let keadaan = await page.evaluate(() => ({
  kluster: [...document.querySelectorAll('.penanda-kluster.maplibregl-marker')].map(e => Number(e.textContent)),
  tunggal: document.querySelectorAll('.penanda-skor.maplibregl-marker').length,
}))
catat(`[${tanda}] awal: ${keadaan.tunggal} tunggal, kelompok ${JSON.stringify(keadaan.kluster)}`)
const awal = { ...keadaan }

while (keadaan.kluster.length && ketukan < 4) {
  await page.evaluate(() => {
    const k = [...document.querySelectorAll('.penanda-kluster.maplibregl-marker')]
      .sort((a, b) => Number(b.textContent) - Number(a.textContent))[0]
    if (k) k.click()
  })
  ketukan += 1
  await page.waitForTimeout(2500)
  keadaan = await page.evaluate(() => ({
    kluster: [...document.querySelectorAll('.penanda-kluster.maplibregl-marker')].map(e => Number(e.textContent)),
    tunggal: document.querySelectorAll('.penanda-skor.maplibregl-marker').length,
  }))
  catat(`[${tanda}] setelah ketukan ${ketukan}: ${keadaan.tunggal} tunggal, kelompok ${JSON.stringify(keadaan.kluster)}`)
}
await bidik(page, `kluster-${tanda}`)
const lolos10 = ketukan === 1 && keadaan.kluster.length === 0
catat(`${lolos10 ? 'LOLOS' : 'GAGAL'}  [10] satu ketukan memisahkan seluruh anggota (${tanda}) — kelompok awal ${JSON.stringify(awal.kluster)}, butuh ${ketukan} ketukan`)

// Kartu ringkas lokasi uji: foto sungguhan dan tautan rute.
const label = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.penanda-skor.maplibregl-marker')]
  const t = el.find(e => (e.getAttribute('aria-label') || '').includes('UJI QA Blok M Alfa'))
    || el.find(e => (e.getAttribute('aria-label') || '').includes('UJI QA'))
  if (t) { t.click(); return t.getAttribute('aria-label') }
  return null
})
await page.waitForTimeout(2500)
await bidik(page, `kartu-ringkas-${tanda}`)
const kartu = await page.evaluate(() => ({
  gambar: [...document.images].filter(i => i.src.includes('location-photos')).map(i => i.src),
  rute: [...document.querySelectorAll('a[href*="google.com/maps"]')].map(a => a.href),
}))
const { data: db } = await rest(`locations?id=eq.${simpanan.idLokasi}&select=lat,lng`)
const koordinat = `${db[0].lat},${db[0].lng}`
catat(`${kartu.gambar.length ? 'LOLOS' : 'GAGAL'}  [5] foto pada kartu ringkas (${tanda}) — penanda ${label}, ${kartu.gambar.length} gambar Storage`)
catat(`${kartu.rute.some(r => r.includes(koordinat)) ? 'LOLOS' : 'GAGAL'}  [13] tautan rute pada kartu (${tanda}) — ${kartu.rute[0]} ; basis data ${koordinat}`)
catat(`galat konsol: ${galat.length}`)
await browser.close()
