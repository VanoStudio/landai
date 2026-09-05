// Bukti butir 2 dan 3: transisi kartu, umpan balik penanda, easing gerakan peta,
// dan rangka pemuatan yang menggantikan layar kosong.

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


// Setelah ada pengelompokan, penanda yang dicari bisa tersembunyi di dalam kelompok.
// Kelompok dibuka dulu sampai penanda tunggalnya muncul.
async function bukaKelompok(page, angka) {
  for (let i = 0; i < 4; i++) {
    const ada = await page.evaluate(a =>
      [...document.querySelectorAll('.penanda-skor.maplibregl-marker')].some(e => e.textContent === a), angka)
    if (ada) return true
    const adaKluster = await page.evaluate(() => {
      const k = document.querySelector('.penanda-kluster.maplibregl-marker')
      if (!k) return false
      k.click()
      return true
    })
    if (!adaKluster) return false
    await page.waitForTimeout(2600)
  }
  return false
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const konteks = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  locale: 'id-ID', timezoneId: 'Asia/Jakarta',
})
const page = await konteks.newPage()
const galat = []
page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 140)) })

// --- rangka pemuatan, ditangkap secepat mungkin setelah DOM siap ---
await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
await sembunyikanDevtools(page)
await page.waitForTimeout(350)

const rangka = await page.evaluate(() => {
  const el = document.querySelector('.rangka-peta')
  if (!el) return null
  const anak = el.children.length
  const gaya = getComputedStyle(el.firstElementChild)
  return { anak, animasi: gaya.animationName, durasi: gaya.animationDuration }
})
catat('Rangka pemuatan tampil sebelum peta siap', !!rangka && rangka.anak === 7,
  rangka ? `${rangka.anak} bentuk, animasi ${rangka.animasi} ${rangka.durasi}` : 'rangka tidak ada')
if (rangka) await page.screenshot({ path: join(KELUARAN, 'rangka-pemuatan-mobile.png') })

// --- rangka hilang setelah peta siap ---
await page.waitForSelector('.maplibregl-canvas')
await page.waitForTimeout(11000)
const rangkaHilang = await page.evaluate(() => !document.querySelector('.rangka-peta'))
catat('Rangka hilang setelah ubin terlukis', rangkaHilang)

// --- transisi kartu ---
await bukaKelompok(page, '63')
const transisi = await page.evaluate(async () => {
  const m = [...document.querySelectorAll('.penanda-skor.maplibregl-marker')].find(e => e.textContent === '63')
  m.click()
  await new Promise(r => requestAnimationFrame(r))
  const kartu = document.querySelector('article')?.parentElement
  if (!kartu) return { ada: false }
  const g = getComputedStyle(kartu)
  const awal = { opacity: g.opacity, transform: g.transform }
  await new Promise(r => setTimeout(r, 500))
  const g2 = getComputedStyle(kartu)
  return { ada: true, awal, akhir: { opacity: g2.opacity, transform: g2.transform } }
})
catat('Kartu masuk dengan pudar dan geser, bukan seketika',
  transisi.ada && Number(transisi.awal.opacity) < 1 && Number(transisi.akhir.opacity) === 1,
  transisi.ada ? `opacity ${transisi.awal.opacity} menuju ${transisi.akhir.opacity}` : 'kartu tidak ada')

// --- umpan balik penanda terpilih ---
const denyut = await page.evaluate(() => {
  const el = document.querySelector('.penanda-skor.maplibregl-marker[data-terpilih="true"]')
  if (!el) return null
  const g = getComputedStyle(el)
  return { animasi: g.animationName, durasi: g.animationDuration, transform: g.transform }
})
catat('Penanda terpilih membesar sebagai umpan balik', !!denyut && denyut.animasi === 'denyut-penanda',
  denyut ? `animasi ${denyut.animasi} ${denyut.durasi}` : 'penanda terpilih tidak ada')
await page.screenshot({ path: join(KELUARAN, 'transisi-kartu-mobile.png') })

// --- easing gerakan peta saat penyaring mengubah jumlah ---
const gerak = await page.evaluate(async () => {
  // Penanda apa pun, tunggal atau kelompok, karena penyaring bisa membuat sisanya melebur.
  const titikAwal = document.querySelector('.maplibregl-marker').getBoundingClientRect()
  const chip = [...document.querySelectorAll('[aria-pressed]')].find(b => b.innerText.includes('Tunanetra'))
  chip.click()
  await new Promise(r => setTimeout(r, 120))
  const tengah = document.querySelector('.maplibregl-marker')?.getBoundingClientRect()
  await new Promise(r => setTimeout(r, 1400))
  const akhir = document.querySelector('.maplibregl-marker')?.getBoundingClientRect()
  return {
    awal: Math.round(titikAwal.top),
    tengah: tengah ? Math.round(tengah.top) : null,
    akhir: akhir ? Math.round(akhir.top) : null,
  }
})
const bergerakBertahap = gerak.tengah !== null && gerak.akhir !== null
  && gerak.tengah !== gerak.akhir
catat('Peta bergeser bertahap saat penyaring berubah, bukan melompat', bergerakBertahap,
  `posisi penanda ${gerak.awal} lalu ${gerak.tengah} lalu ${gerak.akhir}`)

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
console.log(galat.length ? `galat konsol: ${galat.join(' | ')}` : 'nol galat konsol')
if (gagal.length) process.exitCode = 1
