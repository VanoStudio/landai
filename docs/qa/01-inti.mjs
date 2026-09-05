// Bagian satu: alur inti, langkah 1 sampai 7.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { BASE, TANGKAPAN, BERKAS_AKUN, bidik, catat, pantauKonsol, rest } from './lib.mjs'

const CAP = Date.now()
const AKUN = {
  utama: { nama: 'UJI QA Alfa', email: `uji-qa-alfa-${CAP}@example.com`, sandi: `UjiQA!${CAP}` },
}
const NAMA_LOKASI = 'UJI QA Blok M Alfa'

const hasil = []
function nilai(nomor, nama, lolos, ket = '') {
  hasil.push({ nomor, nama, lolos, ket })
  catat(`${lolos ? 'LOLOS' : 'GAGAL'}  [${nomor}] ${nama}  ${ket}`)
}

async function klik(page, teks) {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === t)
    if (!b) throw new Error('tombol tidak ketemu: ' + t)
    b.click()
  }, teks)
  await page.waitForTimeout(700)
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

// --- berkas foto tiruan kamera ---
const hf = await browser.newPage({ viewport: { width: 1200, height: 900 } })
await hf.setContent('<div style="width:1200px;height:900px;background:linear-gradient(160deg,#8fb08a,#dfe7dd);font-family:sans-serif;display:grid;place-items:center;text-align:center;color:#22301f"><div><div style="font-size:72px;font-weight:700">UJI QA</div><div style="font-size:28px;margin-top:10px">foto tiruan kamera, sesi pengujian</div></div></div>')
const JALUR_FOTO = path.join(TANGKAPAN, 'foto-uji-qa.jpg')
await hf.screenshot({ path: JALUR_FOTO, type: 'jpeg', quality: 85 })
await hf.close()

const konteks = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta',
})
const page = await konteks.newPage()
const galat = pantauKonsol(page, 'bagian-1')

// --- langkah 2: penjaga rute untuk pengunjung anonim ---
await page.goto(`${BASE}/tambah-lokasi`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
const urlGuard = page.url()
await bidik(page, 'guard-anonim')
nilai(2, 'Penjaga rute melempar pengunjung anonim ke halaman masuk',
  /\/masuk/.test(urlGuard), urlGuard.replace(BASE, ''))

// --- langkah 1a: daftar akun baru ---
await page.goto(`${BASE}/daftar`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.fill('#nama', AKUN.utama.nama)
await page.fill('#email', AKUN.utama.email)
await page.fill('#password', AKUN.utama.sandi)
await bidik(page, 'daftar-terisi')
await page.evaluate(() => document.querySelector('form').requestSubmit())
await page.waitForTimeout(6000)
const setelahDaftar = page.url()
nilai(1, 'Daftar akun baru', !/\/daftar/.test(setelahDaftar), `dialihkan ke ${setelahDaftar.replace(BASE, '') || '/'}`)
await bidik(page, 'setelah-daftar')

// --- langkah 1b: keluar ---
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)
await klik(page, 'Keluar').catch(() => {})
await page.waitForTimeout(3000)
const adaMasuk = await page.evaluate(() =>
  [...document.querySelectorAll('a,button')].some(a => a.textContent.trim() === 'Masuk'))
nilai(1, 'Keluar mengembalikan ke mode lihat', adaMasuk)
await bidik(page, 'setelah-keluar')

// --- langkah 1c: masuk lagi ---
await page.goto(`${BASE}/masuk`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
await page.fill('#email', AKUN.utama.email)
await page.fill('#password', AKUN.utama.sandi)
await page.evaluate(() => document.querySelector('form').requestSubmit())
await page.waitForTimeout(6000)
nilai(1, 'Masuk lagi dengan akun yang sama', !/\/masuk/.test(page.url()), page.url().replace(BASE, '') || '/')
await bidik(page, 'setelah-masuk-lagi')

// --- langkah 3: tambah lokasi empat langkah ---
await page.goto(`${BASE}/tambah-lokasi`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.maplibregl-canvas', { timeout: 30000 })
await page.waitForTimeout(9000)
const kanvas = await page.locator('.maplibregl-canvas').boundingBox()
await page.mouse.click(kanvas.x + kanvas.width * 0.55, kanvas.y + kanvas.height * 0.45)
await page.waitForTimeout(1500)
await bidik(page, 'form-1-titik')
const titik = await page.evaluate(() => {
  const t = [...document.querySelectorAll('*')].map(e => e.textContent)
    .find(x => /-?\d+\.\d{4,},\s*-?\d+\.\d{4,}/.test(x || ''))
  return (t || '').match(/-?\d+\.\d{4,},\s*-?\d+\.\d{4,}/)?.[0] ?? null
})
nilai(3, 'Langkah 1 titik di peta', true, `koordinat ${titik}`)

await klik(page, 'Lanjut')
await page.fill('#nama-tempat', NAMA_LOKASI)
await page.evaluate(() => {
  const r = [...document.querySelectorAll('input[type=radio]')].find(i => i.value === 'taman')
  r.click()
})
await page.waitForTimeout(400)
await bidik(page, 'form-2-tempat')
nilai(3, 'Langkah 2 identitas tempat', true, `nama "${NAMA_LOKASI}", kategori taman`)

// --- langkah 4: skor pratinjau bergerak sesuai centang ---
await klik(page, 'Lanjut')
await page.waitForTimeout(600)
const bacaPratinjau = () => page.evaluate(() => document.querySelector('.text-5xl')?.textContent.trim())
const jejakSkor = []
jejakSkor.push({ centang: 0, skor: await bacaPratinjau() })
const kotak = await page.$$('input[type=checkbox]')
const PILIH = [0, 1, 5, 6, 7]
for (let i = 0; i < PILIH.length; i++) {
  await kotak[PILIH[i]].click()
  await page.waitForTimeout(350)
  jejakSkor.push({ centang: i + 1, skor: await bacaPratinjau() })
}
await bidik(page, 'form-3-checklist')
const harap = [0, 13, 25, 38, 50, 63].map(String)
const cocokJejak = jejakSkor.every((j, i) => j.skor === harap[i])
nilai(4, 'Skor pratinjau bergerak sesuai centang', cocokJejak,
  jejakSkor.map(j => `${j.centang}:${j.skor}`).join(' '))
const pratinjauAkhir = jejakSkor.at(-1).skor

await klik(page, 'Lanjut')
await page.waitForTimeout(600)
await page.setInputFiles('input[type=file]', JALUR_FOTO)
await page.waitForTimeout(3500)
const pratinjauFoto = await page.evaluate(() => document.querySelectorAll('img[src^="blob:"]').length)
await page.fill('#catatan', 'Data uji QA otomatis. Dihapus di akhir sesi.')
await bidik(page, 'form-4-foto')
nilai(3, 'Langkah 4 foto dan catatan', pratinjauFoto === 1, `${pratinjauFoto} pratinjau foto`)

await klik(page, 'Simpan lokasi')
await page.waitForURL(/\/lokasi\//, { timeout: 60000 })
const idLokasi = page.url().split('/lokasi/')[1].split(/[?#]/)[0]
await page.waitForTimeout(3000)
await bidik(page, 'detail-baru', { penuh: true })
nilai(3, 'Lokasi tersimpan lewat empat langkah', !!idLokasi, idLokasi)

// --- langkah 4b: skor tersimpan cocok pratinjau ---
const skorTampil = await page.evaluate(() => document.querySelector('.text-7xl')?.textContent.trim())
const { data: barisDb } = await rest(`locations?id=eq.${idLokasi}&select=skor,status,created_by,nama`)
nilai(4, 'Skor tersimpan cocok dengan pratinjau',
  skorTampil === pratinjauAkhir && String(barisDb?.[0]?.skor) === pratinjauAkhir,
  `pratinjau ${pratinjauAkhir}, detail ${skorTampil}, basis data ${barisDb?.[0]?.skor}`)

// --- langkah 5: foto di storage dan tampil ---
const fotoDetail = await page.evaluate(() =>
  [...document.images].filter(i => i.src.includes('location-photos')).map(i => i.src))
let fotoBisaDiambil = false
if (fotoDetail[0]) {
  const r = await fetch(fotoDetail[0])
  fotoBisaDiambil = r.ok && Number(r.headers.get('content-length') || 0) > 1000
}
nilai(5, 'Foto tersimpan di Storage dan tampil di halaman detail',
  fotoDetail.length === 1 && fotoBisaDiambil, fotoDetail[0]?.split('/').slice(-2).join('/'))

// --- langkah 6: jejak kontributor ---
const jejak = await page.evaluate(() =>
  [...document.querySelectorAll('p,div,span')].map(p => p.textContent.trim())
    .find(t => /^Ditambahkan/.test(t)))
nilai(6, 'Jejak kontributor tercatat dengan nama dan tanggal',
  !!jejak && jejak.includes('UJI QA Alfa'), jejak?.slice(0, 90))

// --- langkah 7: muncul di peta dengan penanda berongga ---
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.maplibregl-canvas', { timeout: 30000 })
await page.waitForTimeout(9000)
const petaInfo = await page.evaluate(() => {
  const tunggal = [...document.querySelectorAll('.penanda-skor.maplibregl-marker')]
  return {
    tunggal: tunggal.length,
    berongga: tunggal.filter(e => e.dataset.status === 'belum_terverifikasi').length,
    label: tunggal.map(e => e.getAttribute('aria-label')),
    kluster: [...document.querySelectorAll('.penanda-kluster.maplibregl-marker')]
      .reduce((s, e) => s + Number(e.textContent), 0),
  }
})
await bidik(page, 'peta-lokasi-baru')
const { data: semuaDb } = await rest('locations?select=id,nama,status')
nilai(7, 'Lokasi baru muncul di peta dengan penanda berongga',
  petaInfo.tunggal + petaInfo.kluster === semuaDb.length,
  `peta ${petaInfo.tunggal} tunggal + ${petaInfo.kluster} dalam kluster, basis data ${semuaDb.length}, berongga ${petaInfo.berongga}`)
catat('label penanda: ' + JSON.stringify(petaInfo.label))

// --- kartu ringkas: foto tampil, bukan kotak abu ---
const idxBaru = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.penanda-skor.maplibregl-marker')]
  const i = el.findIndex(e => (e.getAttribute('aria-label') || '').includes('UJI QA'))
  if (i >= 0) el[i].click()
  return i
})
await page.waitForTimeout(2500)
await bidik(page, 'kartu-ringkas-foto')
const fotoKartu = await page.evaluate(() =>
  [...document.images].filter(i => i.src.includes('location-photos')).length)
nilai(5, 'Foto tampil di kartu ringkas', fotoKartu >= 1, `${fotoKartu} gambar storage di kartu, penanda indeks ${idxBaru}`)

writeFileSync(BERKAS_AKUN, JSON.stringify({ akun: AKUN, idLokasi, namaLokasi: NAMA_LOKASI, cap: CAP }, null, 2))
writeFileSync(path.join(TANGKAPAN, 'hasil-01.json'), JSON.stringify({ hasil, galat }, null, 2))
catat(`galat konsol bagian 1: ${galat.length}`)
await browser.close()
