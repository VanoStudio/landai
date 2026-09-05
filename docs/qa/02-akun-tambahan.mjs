// Menyiapkan tiga akun uji tambahan untuk langkah 15 dan 16, sekaligus dua lokasi
// uji tambahan supaya urutan papan kontributor dan pengelompokan penanda bisa diuji.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { BASE, TANGKAPAN, BERKAS_AKUN, bidik, catat, pantauKonsol } from './lib.mjs'

const simpanan = JSON.parse(readFileSync(BERKAS_AKUN, 'utf8'))
const CAP = simpanan.cap
const tambahan = {
  beta: { nama: 'UJI QA Beta', email: `uji-qa-beta-${CAP}@example.com`, sandi: `UjiQA!${CAP}b` },
  gama: { nama: 'UJI QA Gama', email: `uji-qa-gama-${CAP}@example.com`, sandi: `UjiQA!${CAP}g` },
  delta: { nama: 'UJI QA Delta', email: `uji-qa-delta-${CAP}@example.com`, sandi: `UjiQA!${CAP}d` },
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

async function klik(page, teks) {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === t)
    if (!b) throw new Error('tombol tidak ketemu: ' + t)
    b.click()
  }, teks)
  await page.waitForTimeout(700)
}

async function sesiBaru() {
  const k = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta',
  })
  const p = await k.newPage()
  pantauKonsol(p, 'bagian-2')
  return { k, p }
}

async function daftar(p, akun) {
  await p.goto(`${BASE}/daftar`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1200)
  await p.fill('#nama', akun.nama)
  await p.fill('#email', akun.email)
  await p.fill('#password', akun.sandi)
  await p.evaluate(() => document.querySelector('form').requestSubmit())
  await p.waitForTimeout(6000)
  const ok = !/\/daftar/.test(p.url())
  catat(`${ok ? 'LOLOS' : 'GAGAL'}  daftar ${akun.nama}  ${p.url().replace(BASE, '') || '/'}`)
  return ok
}

async function tambahLokasi(p, nama, fraksiX, fraksiY, indeksCentang) {
  await p.goto(`${BASE}/tambah-lokasi`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.maplibregl-canvas', { timeout: 30000 })
  await p.waitForTimeout(9000)
  const kanvas = await p.locator('.maplibregl-canvas').boundingBox()
  await p.mouse.click(kanvas.x + kanvas.width * fraksiX, kanvas.y + kanvas.height * fraksiY)
  await p.waitForTimeout(1200)
  await klik(p, 'Lanjut')
  await p.fill('#nama-tempat', nama)
  await p.evaluate(() => {
    const r = [...document.querySelectorAll('input[type=radio]')].find(i => i.value === 'mal')
    r.click()
  })
  await klik(p, 'Lanjut')
  await p.waitForTimeout(600)
  const kotak = await p.$$('input[type=checkbox]')
  for (const i of indeksCentang) await kotak[i].click()
  await p.waitForTimeout(500)
  await klik(p, 'Lanjut')
  await p.waitForTimeout(600)
  await p.fill('#catatan', 'Data uji QA otomatis. Dihapus di akhir sesi.')
  await klik(p, 'Simpan lokasi')
  await p.waitForURL(/\/lokasi\//, { timeout: 60000 })
  const id = p.url().split('/lokasi/')[1].split(/[?#]/)[0]
  catat(`lokasi uji dibuat: ${nama} ${id}`)
  return id
}

const dibuat = { lokasi: [] }

// Beta: satu lokasi, dekat titik Alfa supaya pengelompokan penanda bisa diuji.
{
  const { k, p } = await sesiBaru()
  await daftar(p, tambahan.beta)
  const id = await tambahLokasi(p, 'UJI QA Blok M Beta', 0.5, 0.5, [0, 2, 4])
  dibuat.lokasi.push({ id, nama: 'UJI QA Blok M Beta', pemilik: 'beta' })
  await bidik(p, 'lokasi-beta-detail')
  await k.close()
}

// Gama dan Delta hanya perlu akun, dipakai untuk konfirmasi.
for (const kunci of ['gama', 'delta']) {
  const { k, p } = await sesiBaru()
  await daftar(p, tambahan[kunci])
  await k.close()
}

// Alfa menambah satu lokasi lagi supaya urutan papan kontributor punya pembeda.
{
  const { k, p } = await sesiBaru()
  await p.goto(`${BASE}/masuk`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1200)
  await p.fill('#email', simpanan.akun.utama.email)
  await p.fill('#password', simpanan.akun.utama.sandi)
  await p.evaluate(() => document.querySelector('form').requestSubmit())
  await p.waitForTimeout(6000)
  const id = await tambahLokasi(p, 'UJI QA Blok M Delta', 0.45, 0.55, [0, 1, 3, 5, 6, 7])
  dibuat.lokasi.push({ id, nama: 'UJI QA Blok M Delta', pemilik: 'utama' })
  await k.close()
}

simpanan.akun = { ...simpanan.akun, ...tambahan }
simpanan.lokasiTambahan = dibuat.lokasi
writeFileSync(BERKAS_AKUN, JSON.stringify(simpanan, null, 2))
writeFileSync(path.join(TANGKAPAN, 'hasil-02.json'), JSON.stringify(dibuat, null, 2))
await browser.close()
catat('bagian 2 selesai')
