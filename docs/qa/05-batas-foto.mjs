// Bagian empat: keamanan pengunggahan, langkah 20.
// Lima event pemilihan berkas ditembakkan dalam satu tick, sebelum satu pun selesai
// diproses. Kalau batas tiga hanya dijaga v-if di template, kelimanya lolos.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { BASE, TANGKAPAN, BERKAS_AKUN, bidik, catat, pantauKonsol, rest } from './lib.mjs'

const simpanan = JSON.parse(readFileSync(BERKAS_AKUN, 'utf8'))
const b64 = readFileSync(path.join(TANGKAPAN, 'foto-uji-qa.jpg')).toString('base64')
const hasil = []
function nilai(nomor, nama, lolos, ket = '') {
  hasil.push({ nomor, nama, lolos, ket })
  catat(`${lolos ? 'LOLOS' : 'GAGAL'}  [${nomor}] ${nama}  ${ket}`)
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const konteks = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta',
})
const page = await konteks.newPage()
const galat = pantauKonsol(page, 'bagian-4')
const klik = async (t) => {
  await page.evaluate((x) => {
    [...document.querySelectorAll('button')].find(b => b.textContent.trim() === x)?.click()
  }, t)
  await page.waitForTimeout(800)
}

await page.goto(`${BASE}/masuk`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.fill('#email', simpanan.akun.utama.email)
await page.fill('#password', simpanan.akun.utama.sandi)
await page.evaluate(() => document.querySelector('form').requestSubmit())
await page.waitForTimeout(6000)

await page.goto(`${BASE}/tambah-lokasi`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.maplibregl-canvas', { timeout: 40000 })
await page.waitForTimeout(8000)
await klik('Lanjut')
await page.fill('#nama-tempat', 'UJI QA Batas Foto')
await klik('Lanjut')
const kotak = await page.$$('input[type=checkbox]')
for (const i of [0, 3]) await kotak[i].click()
await klik('Lanjut')
await page.waitForTimeout(800)

const tembakan = await page.evaluate(async (data) => {
  const bin = Uint8Array.from(atob(data), c => c.charCodeAt(0))
  const input = document.querySelector('input[type=file]')
  if (!input) return { gagal: 'input tidak ada' }
  for (let i = 0; i < 5; i++) {
    const dt = new DataTransfer()
    dt.items.add(new File([bin], `foto-${i}.jpg`, { type: 'image/jpeg' }))
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }
  return { ditembak: 5 }
}, b64)
await page.waitForTimeout(9000)
const pratinjau = await page.evaluate(() => document.querySelectorAll('img[src^="blob:"]').length)
await bidik(page, 'batas-foto-pratinjau')
nilai(20, 'Lima pemilihan berkas serentak tetap menyisakan tepat tiga foto',
  pratinjau === 3, `${tembakan.ditembak} event change dalam satu tick, ${pratinjau} pratinjau tersisa`)

await page.fill('#catatan', 'Data uji QA otomatis. Dihapus di akhir sesi.')
await klik('Simpan lokasi')
await page.waitForURL(/\/lokasi\//, { timeout: 90000 })
const id = page.url().split('/lokasi/')[1].split(/[?#]/)[0]
await page.waitForTimeout(4000)
await bidik(page, 'batas-foto-detail', { penuh: true })
const { data: fotoDb } = await rest(`location_photos?location_id=eq.${id}&select=id,photo_url`)
const fotoTampil = await page.evaluate(() =>
  [...document.images].filter(i => i.src.includes('location-photos')).length)
nilai(20, 'Yang tersimpan di basis data juga tepat tiga foto',
  fotoDb.length === 3 && fotoTampil === 3,
  `${fotoDb.length} baris location_photos, ${fotoTampil} gambar tampil di detail`)

simpanan.lokasiTambahan = [...(simpanan.lokasiTambahan || []), { id, nama: 'UJI QA Batas Foto', pemilik: 'utama' }]
writeFileSync(BERKAS_AKUN, JSON.stringify(simpanan, null, 2))
writeFileSync(path.join(TANGKAPAN, 'hasil-05.json'), JSON.stringify({ hasil, galat }, null, 2))
await browser.close()
catat(`bagian 4 selesai, galat konsol ${galat.length}`)
