// Bagian lima: papan kontributor dan halaman pendukung, langkah 21 sampai 23.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { BASE, TANGKAPAN, bidik, catat, pantauKonsol, rest } from './lib.mjs'

const hasil = []
function nilai(nomor, nama, lolos, ket = '') {
  hasil.push({ nomor, nama, lolos, ket })
  catat(`${lolos ? 'LOLOS' : 'GAGAL'}  [${nomor}] ${nama}  ${ket}`)
}

// Kebenaran dari basis data: berapa lokasi per kontributor.
const { data: baris } = await rest('locations?select=created_by,profiles(nama)&created_by=not.is.null')
const per = new Map()
for (const b of baris) {
  const p = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles
  const s = per.get(b.created_by) || { nama: p?.nama || 'Warga', jumlah: 0 }
  s.jumlah += 1
  per.set(b.created_by, s)
}
const harapan = [...per.values()].sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama))
const TINGKAT = [
  { nama: 'Baru mulai', minimal: 1, berikutnya: 3 },
  { nama: 'Kontributor aktif', minimal: 3, berikutnya: 6 },
  { nama: 'Kontributor utama', minimal: 6, berikutnya: null },
]
const tingkatDari = j => [...TINGKAT].reverse().find(t => j >= t.minimal) ?? TINGKAT[0]
const kemajuanDari = (j, t) => t.berikutnya === null ? 100 : Math.min(100, Math.round(j / t.berikutnya * 100))
catat('kebenaran basis data: ' + JSON.stringify(harapan))

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const konteks = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta',
})
const page = await konteks.newPage()
const galat = pantauKonsol(page, 'bagian-5')

// --- langkah 21: papan kontributor ---
await page.goto(`${BASE}/papan-kontributor`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)
await bidik(page, 'papan-kontributor', { penuh: true })
const papan = await page.evaluate(() => {
  const kartu = [...document.querySelectorAll('li, article')].filter(e => /lokasi/.test(e.textContent))
  return kartu.map((e) => {
    const bilah = e.querySelector('[style*="width"]')
    return {
      teks: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 120),
      lebar: bilah ? bilah.getAttribute('style') : null,
    }
  })
})
catat('kartu papan: ' + JSON.stringify(papan, null, 1).slice(0, 900))

const urutanTampil = papan.map(k => k.teks)
const urutanBenar = harapan.every((h, i) => (urutanTampil[i] || '').includes(h.nama))
nilai(21, 'Urutan papan kontributor sesuai jumlah lokasi tiap akun', urutanBenar,
  harapan.map(h => `${h.nama}=${h.jumlah}`).join(', '))

const tingkatBenar = harapan.every((h, i) => {
  const t = tingkatDari(h.jumlah)
  return (urutanTampil[i] || '').includes(t.nama)
})
nilai(21, 'Tingkat tiap kontributor sesuai ambang yang ditentukan', tingkatBenar,
  harapan.map(h => `${h.nama}: ${h.jumlah} lokasi, ${tingkatDari(h.jumlah).nama}`).join(' | '))

const kemajuanBenar = harapan.every((h, i) => {
  const t = tingkatDari(h.jumlah)
  const target = kemajuanDari(h.jumlah, t)
  const gaya = papan[i]?.lebar || ''
  const angka = Number((gaya.match(/width:\s*([\d.]+)%/) || [])[1])
  return Math.abs(angka - target) < 1.5
})
nilai(21, 'Bilah kemajuan sesuai rumus ambang', kemajuanBenar,
  harapan.map((h, i) => {
    const t = tingkatDari(h.jumlah)
    return `${h.nama}: harap ${kemajuanDari(h.jumlah, t)}%, tampil ${(papan[i]?.lebar || '-').replace(/.*width:\s*/, '')}`
  }).join(' | '))

// --- langkah 22: halaman tentang ---
await page.goto(`${BASE}/tentang`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
await bidik(page, 'tentang', { penuh: true })
const teksTentang = await page.evaluate(() => document.body.innerText)
const adaApresiasi = /apresiasi/i.test(teksTentang)
const kalimat = (teksTentang.match(/[^.]*apresiasi[^.]*\./i) || [''])[0].trim()
nilai(22, 'Paragraf rencana pengembangan tentang program apresiasi kontributor ada',
  adaApresiasi, kalimat.slice(0, 130))

const tautan = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === '/papan-kontributor')
  if (!a) return null
  a.click()
  return a.textContent.trim()
})
await page.waitForTimeout(3500)
await bidik(page, 'tentang-ke-papan')
nilai(22, 'Tautan menuju papan kontributor berfungsi',
  !!tautan && page.url().includes('/papan-kontributor'),
  `tombol "${tautan}", mendarat di ${page.url().replace(BASE, '')}`)

// --- langkah 23: rantai pengalihan masuk dengan Google ---
// Tidak diselesaikan dengan kredensial sungguhan; yang dibuktikan hanya rantainya.
const jejak = []
page.on('request', (r) => {
  if (r.isNavigationRequest()) jejak.push(r.url())
})
await page.goto(`${BASE}/masuk`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
await bidik(page, 'masuk-tombol-google')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(e => /Google/.test(e.textContent))
  b.click()
})
await page.waitForTimeout(8000)
const urlAkhir = page.url()
await bidik(page, 'google-layar-izin')
const rantai = jejak.filter(u => /supabase|google/.test(u))
nilai(23, 'Tombol masuk dengan Google mengantar sampai layar izin Google',
  /accounts\.google\.com/.test(urlAkhir),
  `mendarat di ${urlAkhir.split('?')[0]} ; rantai ${rantai.map(u => u.split('?')[0]).join(' -> ')}`)
const layar = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 120))
catat('isi layar Google: ' + layar)

writeFileSync(path.join(TANGKAPAN, 'hasil-06.json'), JSON.stringify({ hasil, galat, harapan }, null, 2))
await browser.close()
catat(`bagian 5 selesai, galat konsol ${galat.length}`)
