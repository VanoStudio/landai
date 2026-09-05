// Bug penanda melompat, diperiksa per jalur perpindahan pandangan.
//
// Perbaikan sebelumnya hanya menyasar jalur zoom, dan gejalanya masih muncul saat
// penanda diketuk. Berkas ini tidak menebak: ia mengukur enam jalur satu per satu
// dan melaporkan jalur mana yang benar-benar bermasalah.
//
// Cara mengukurnya, dan ini bagian pentingnya:
//
// MapLibre menaruh posisi penanda pada `element.style.transform`, ditulis ulang tiap
// bingkai selama peta bergerak. Itu POSISI YANG DIPERINTAHKAN. Yang benar-benar
// terlukis di layar adalah `getComputedStyle(element).transform`. Pada penanda yang
// sehat keduanya selalu sama. Kalau ada transisi CSS pada properti transform, tiap
// tulisan MapLibre justru memulai animasi sendiri, sehingga yang terlukis tertinggal
// di belakang yang diperintahkan, dan penanda terlihat melayang lepas dari peta.
// Selisih dua nilai itulah simpangan yang diukur di sini, dalam piksel.
//
// Diukur juga dua hal lain:
//   - elemen penanda yang DIBUAT ULANG dari nol selagi pandangan berpindah, dikenali
//     dari penanda yang muncul tanpa tanda pengenal yang dipasang sebelum perekaman
//   - penanda yang sempat terlukis di dekat titik nol wadah, yaitu pojok kiri atas
//     peta, padahal tempat akhirnya jauh dari sana
//
// Jalankan dari akar repo selagi dev server hidup:
//
//   node docs/qa/uji-penanda-jalur.mjs

import { chromium } from 'playwright'
import { join } from 'node:path'

const BASIS = process.env.BASIS_UJI || 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')

// Ambang simpangan. Satu piksel masih wajar karena pembulatan sub-piksel peramban.
// Di atas delapan piksel penanda sudah terlihat lepas dari tempatnya.
const AMBANG_SIMPANGAN = 8
const AMBANG_POJOK = 90

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

// Dipasang di halaman. Menandai setiap penanda yang SUDAH ada sebelum perekaman,
// lalu merekam tiap bingkai: posisi yang diperintahkan, posisi yang terlukis, dan
// penanda mana yang lahir di tengah jalan.
const INSTRUMEN = `
window.__uji = {
  mulai(durasiMs) {
    const wadah = document.querySelector('.maplibregl-canvas-container') || document.body
    const kotakWadah = wadah.getBoundingClientRect()

    let nomor = 0
    const tandai = (el) => {
      if (!el.dataset.ujiUid) el.dataset.ujiUid = 'lama-' + (nomor++)
    }
    document.querySelectorAll('.maplibregl-marker').forEach(tandai)
    const sebelum = new Set([...document.querySelectorAll('.maplibregl-marker')]
      .map(e => e.dataset.ujiUid))

    const bingkai = []
    let lahirBaru = 0
    let mati = 0

    const pengamat = new MutationObserver((rekaman) => {
      for (const r of rekaman) {
        r.addedNodes.forEach((n) => {
          if (n.nodeType === 1 && n.classList?.contains('maplibregl-marker')) lahirBaru++
        })
        r.removedNodes.forEach((n) => {
          if (n.nodeType === 1 && n.classList?.contains('maplibregl-marker')) mati++
        })
      }
    })
    pengamat.observe(wadah, { childList: true })

    // Menguraikan "translate(-50%,-50%) translate(123px, 45px)" menjadi pergeseran
    // piksel yang sesungguhnya, dengan persen diselesaikan terhadap kotak elemen.
    const bacaPerintah = (el) => {
      const t = el.style.transform || ''
      const persen = /translate\\(\\s*(-?[\\d.]+)%\\s*,\\s*(-?[\\d.]+)%\\s*\\)/.exec(t)
      const piksel = /translate\\(\\s*(-?[\\d.]+)px\\s*,\\s*(-?[\\d.]+)px\\s*\\)/.exec(t)
      if (!piksel) return null
      const px = parseFloat(piksel[1]), py = parseFloat(piksel[2])
      const gx = persen ? (parseFloat(persen[1]) / 100) * el.offsetWidth : 0
      const gy = persen ? (parseFloat(persen[2]) / 100) * el.offsetHeight : 0
      return { x: px + gx, y: py + gy }
    }

    const bacaTerlukis = (el) => {
      const m = getComputedStyle(el).transform
      if (!m || m === 'none') return null
      const n = m.match(/matrix\\(([^)]+)\\)/)
      if (!n) return null
      const a = n[1].split(',').map(v => parseFloat(v.trim()))
      return { x: a[4], y: a[5] }
    }

    const habis = performance.now() + durasiMs
    const rekamSatu = () => {
      const isi = []
      for (const el of document.querySelectorAll('.maplibregl-marker')) {
        tandai(el)
        const perintah = bacaPerintah(el)
        const terlukis = bacaTerlukis(el)
        const kotak = el.getBoundingClientRect()
        isi.push({
          uid: el.dataset.ujiUid,
          baru: !sebelum.has(el.dataset.ujiUid),
          perintah, terlukis,
          // Posisi tengah relatif terhadap wadah peta, untuk mendeteksi pojok.
          cx: kotak.left + kotak.width / 2 - kotakWadah.left,
          cy: kotak.top + kotak.height / 2 - kotakWadah.top,
        })
      }
      bingkai.push({ t: Math.round(performance.now()), isi })
      if (performance.now() < habis) requestAnimationFrame(rekamSatu)
      else { pengamat.disconnect(); window.__uji.selesai = { bingkai, lahirBaru, mati } }
    }

    window.__uji.selesai = null
    requestAnimationFrame(rekamSatu)
  },
}
`

function analisis(hasil) {
  const { bingkai, lahirBaru, mati } = hasil
  let simpanganMaks = 0
  let bingkaiMenyimpang = 0
  let pojok = 0
  const akhir = new Map()

  for (const b of bingkai.at(-1)?.isi ?? []) akhir.set(b.uid, { x: b.cx, y: b.cy })

  for (const b of bingkai) {
    let adaYangMenyimpang = false
    for (const p of b.isi) {
      if (!p.perintah || !p.terlukis) continue
      const d = Math.hypot(p.perintah.x - p.terlukis.x, p.perintah.y - p.terlukis.y)
      if (d > simpanganMaks) simpanganMaks = d
      if (d > AMBANG_SIMPANGAN) adaYangMenyimpang = true

      // Pojok hanya dihitung kalau penanda memang terlukis MELESET ke sana. Penanda
      // yang posisi sebenarnya kebetulan lewat dekat pojok saat peta digeser bukan
      // gejala, dan tanpa syarat ini ia terhitung sebagai positif palsu.
      if (d > AMBANG_SIMPANGAN && Math.hypot(p.cx, p.cy) < AMBANG_POJOK) pojok++
    }
    if (adaYangMenyimpang) bingkaiMenyimpang++
  }

  return {
    bingkai: bingkai.length,
    simpanganMaks: Math.round(simpanganMaks * 10) / 10,
    bingkaiMenyimpang,
    pojok,
    lahirBaru,
    mati,
  }
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const konteks = await browser.newContext({
  viewport: { width: 900, height: 800 },
  deviceScaleFactor: 1,
  locale: 'id-ID',
  permissions: ['geolocation'],
  geolocation: { latitude: -6.2455, longitude: 106.7995 },
})

const page = await konteks.newPage()
await page.addInitScript(INSTRUMEN)
await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.maplibregl-canvas')
await page.waitForTimeout(7000)
await page.addStyleTag({
  content: '#nuxt-devtools-anchor,#nuxt-devtools-container{display:none!important}',
}).catch(() => {})

const jumlahPenanda = await page.evaluate(() =>
  document.querySelectorAll('.maplibregl-marker').length)
console.log(`  ${jumlahPenanda} penanda di peta sebelum pengujian\n`)

if (jumlahPenanda === 0) {
  console.error('Tidak ada penanda sama sekali. Pastikan basis data terisi.')
  await browser.close()
  process.exit(1)
}

async function ukurJalur(nama, aksi, durasi = 2200) {
  // Dikembalikan ke keadaan awal supaya tiap jalur diuji dari titik yang sama.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(600)

  await page.evaluate(d => window.__uji.mulai(d), durasi)
  await page.waitForTimeout(60)
  await aksi()
  await page.waitForFunction(() => window.__uji.selesai !== null, { timeout: 20000 })
  const hasil = await page.evaluate(() => window.__uji.selesai)
  return { nama, ...analisis(hasil) }
}

const laporan = []

// ---------- 1. mengetuk penanda langsung di peta ----------
laporan.push(await ukurJalur('Mengetuk penanda di peta', async () => {
  const p = page.locator('.penanda-skor').first()
  if (await p.count()) await p.click({ force: true })
}))

await page.evaluate(() => document.querySelector('.maplibregl-canvas')?.click())
await page.waitForTimeout(800)

// ---------- 2. mengetuk butir pada panel daftar ----------
laporan.push(await ukurJalur('Mengetuk butir panel daftar lokasi', async () => {
  await page.getByRole('tab', { name: /daftar/i }).click()
  await page.waitForTimeout(500)
  const b = page.locator('[aria-label="Daftar lokasi"] li button').first()
  if (await b.count()) await b.click()
}, 3000))

await page.getByRole('tab', { name: /^peta$/i }).click().catch(() => {})
await page.waitForTimeout(800)

// ---------- 3. memilih hasil pencarian area ----------
laporan.push(await ukurJalur('Memilih hasil pencarian area', async () => {
  await page.fill('input[placeholder="Cari area"]', 'Blok M')
  await page.waitForTimeout(2200)
  const h = page.locator('ul li button').first()
  if (await h.count()) await h.click().catch(() => {})
}, 4200))

await page.waitForTimeout(600)

// ---------- 4. tombol lokasi saya ----------
laporan.push(await ukurJalur('Menekan tombol lokasi saya', async () => {
  await page.click('[aria-label="Ke lokasi saya"]').catch(() => {})
}, 3000))

// ---------- 5. zoom lewat kontrol tombol ----------
laporan.push(await ukurJalur('Memperbesar lewat kontrol tombol', async () => {
  await page.click('.maplibregl-ctrl-zoom-in')
  await page.waitForTimeout(500)
  await page.click('.maplibregl-ctrl-zoom-out')
}, 3000))

// ---------- 6. zoom lewat gulir ----------
laporan.push(await ukurJalur('Memperbesar lewat gulir', async () => {
  await page.mouse.move(450, 400)
  await page.mouse.wheel(0, -450)
  await page.waitForTimeout(500)
  await page.mouse.wheel(0, 450)
}, 3000))

await page.screenshot({ path: join(KELUARAN, 'penanda-jalur.png') })

console.log('')
console.log('  jalur                                  bingkai  simpangan  bingkai   pojok  lahir  mati')
console.log('                                                     maks    menyimpang')
for (const r of laporan) {
  console.log(
    `  ${r.nama.padEnd(38)}${String(r.bingkai).padStart(5)}`
    + `${String(r.simpanganMaks).padStart(11)}px`
    + `${String(r.bingkaiMenyimpang).padStart(9)}`
    + `${String(r.pojok).padStart(8)}`
    + `${String(r.lahirBaru).padStart(7)}`
    + `${String(r.mati).padStart(6)}`,
  )
}
console.log('')

for (const r of laporan) {
  catat(`${r.nama}: penanda tetap di tempat yang diperintahkan peta`,
    r.simpanganMaks <= AMBANG_SIMPANGAN,
    `simpangan maks ${r.simpanganMaks}px pada ${r.bingkaiMenyimpang} bingkai`)
}
for (const r of laporan) {
  catat(`${r.nama}: tidak ada penanda terlukis di pojok kiri atas`,
    r.pojok === 0, `${r.pojok} kemunculan`)
}

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n  ${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
process.exitCode = gagal.length ? 1 : 0
