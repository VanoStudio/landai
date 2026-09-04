// Membuktikan penanda tidak lagi berkedip ke pojok kiri atas saat peta diperbesar.
//
// Dua hal yang diukur, keduanya langsung pada penyebabnya, bukan pada gejalanya:
//
//   1. Setiap elemen penanda yang disisipkan ke DOM harus SUDAH punya transform yang
//      benar pada saat penyisipan. Transform kosong atau matriks identitas berarti
//      elemen itu terlukis satu bingkai di titik nol wadah, yaitu pojok kiri atas.
//      Diamati dengan MutationObserver supaya keadaannya terbaca pada saat itu juga,
//      bukan setelah MapLibre sempat memperbaikinya di bingkai berikutnya.
//
//   2. Penanda yang keanggotaan kelompoknya tidak berubah harus elemen yang sama
//      persis, bukan elemen baru yang kebetulan mirip. Ditandai dengan atribut data
//      sebelum peta digerakkan, lalu diperiksa masih ada sesudahnya.
//
// Selain itu posisi seluruh penanda direkam tiap bingkai sepanjang animasi zoom,
// untuk memastikan tidak ada yang melompat ke pojok di tengah animasi.

import { chromium } from 'playwright'
import { join } from 'node:path'

const BASIS = 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')
const PENANDA = '.penanda-skor.maplibregl-marker, .penanda-kluster.maplibregl-marker'

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

const PASANG_PEMANTAU = `(() => {
  const PENANDA = ${JSON.stringify(PENANDA)}
  window.__jejak = { sisip: [], bingkai: [] }

  // Transform pada saat penyisipan. Inilah bingkai yang dulu bocor ke layar.
  new MutationObserver((mut) => {
    for (const m of mut) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue
        const el = n.matches && n.matches(PENANDA) ? n : (n.querySelector && n.querySelector(PENANDA))
        if (!el) continue
        const t = getComputedStyle(el).transform
        const r = el.getBoundingClientRect()
        window.__jejak.sisip.push({
          transform: t,
          kosong: t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)',
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2),
          teks: (el.textContent || '').slice(0, 6),
        })
      }
    }
  }).observe(document.body, { childList: true, subtree: true })

  // Posisi tiap penanda pada tiap bingkai. Tiap elemen diberi nomor seri sekali
  // saja, supaya perbandingan antar bingkai membandingkan penanda yang sama dan
  // bukan indeks yang bergeser ketika ada penanda muncul atau hilang.
  let jalan = true
  let seri = 0
  const wadah = document.querySelector('.maplibregl-map').getBoundingClientRect()
  const rekam = () => {
    if (!jalan) return
    const titik = {}
    for (const e of document.querySelectorAll(PENANDA)) {
      if (!e.dataset.seriUji) e.dataset.seriUji = String(++seri)
      const r = e.getBoundingClientRect()
      titik[e.dataset.seriUji] = {
        x: Math.round(r.left + r.width / 2 - wadah.left),
        y: Math.round(r.top + r.height / 2 - wadah.top),
      }
    }
    window.__jejak.bingkai.push(titik)
    requestAnimationFrame(rekam)
  }
  requestAnimationFrame(rekam)
  window.__berhenti = () => { jalan = false }
})()`

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const [label, vp] of [
  ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
]) {
  const konteks = await browser.newContext({ ...vp, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })
  const page = await konteks.newPage()
  const galat = []
  page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 130)) })

  await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({
    content: '#nuxt-devtools-anchor,#nuxt-devtools-container{display:none!important}',
  }).catch(() => {})
  await page.waitForSelector('.maplibregl-canvas')
  await page.waitForTimeout(10000)

  const jumlahAwal = await page.evaluate(p => document.querySelectorAll(p).length, PENANDA)

  // ---------- 1. penanda yang tetap harus elemen yang sama ----------
  await page.evaluate(PASANG_PEMANTAU)

  // Geseran lima piksel. Pengelompokan memakai jarak layar dengan ambang 48px, dan
  // geseran menggeser seluruh titik sama besar, jadi pada jarak sependek ini
  // keanggotaan kelompok tidak mungkin berubah. Setiap penyisipan yang muncul di
  // sini berarti penanda dibuat ulang tanpa alasan.
  const kotak = await page.locator('.maplibregl-canvas').boundingBox()

  // Titik pangkal geseran dipilih pada bidang yang benar-benar kosong. Memulai di
  // atas penanda berarti memilihnya, dan penanda terpilih memang sengaja ditarik
  // keluar dari kelompoknya, jadi kelompoknya akan pecah karena perilaku yang benar.
  const pangkal = await page.evaluate((p) => {
    const jauhDariPenanda = (x, y) => [...document.querySelectorAll(p)].every((e) => {
      const r = e.getBoundingClientRect()
      return Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y) > 90
    })
    const k = document.querySelector('.maplibregl-canvas').getBoundingClientRect()
    for (const [fx, fy] of [[0.2, 0.25], [0.8, 0.3], [0.25, 0.6], [0.75, 0.65], [0.5, 0.4]]) {
      const x = k.left + k.width * fx, y = k.top + k.height * fy
      if (jauhDariPenanda(x, y)) return { x: Math.round(x), y: Math.round(y) }
    }
    return null
  }, PENANDA)

  if (!pangkal) throw new Error('tidak ada bidang kosong untuk memulai geseran')

  await page.mouse.move(pangkal.x, pangkal.y)
  await page.mouse.down()
  await page.mouse.move(pangkal.x + 5, pangkal.y + 3, { steps: 4 })
  await page.mouse.up()
  await page.waitForTimeout(1600)

  const sesudahGeser = await page.evaluate(p => ({
    sisip: window.__jejak.sisip.length,
    total: document.querySelectorAll(p).length,
  }), PENANDA)

  catat(`Geser peta tidak membuat ulang penanda (${label})`,
    sesudahGeser.sisip === 0 && sesudahGeser.total === jumlahAwal,
    `${jumlahAwal} penanda sebelum dan ${sesudahGeser.total} sesudah, ${sesudahGeser.sisip} penyisipan baru`)

  // ---------- 2. perbesar dan perkecil sambil merekam tiap bingkai ----------

  // Klik dikirim langsung ke elemennya. Lewat locator, pemeriksaan kestabilan
  // Playwright kadang tidak pernah selesai pada peta yang terus merender, dan yang
  // sedang diuji di sini bukan kemampuan klik tombolnya melainkan perilaku penanda
  // selama animasi zoom.
  const tekan = pemilih => page.evaluate(s => document.querySelector(s).click(), pemilih)

  for (let i = 0; i < 3; i++) { await tekan('.maplibregl-ctrl-zoom-in'); await page.waitForTimeout(700) }
  await page.waitForTimeout(900)
  for (let i = 0; i < 3; i++) { await tekan('.maplibregl-ctrl-zoom-out'); await page.waitForTimeout(700) }
  await page.waitForTimeout(1200)

  await page.evaluate(() => window.__berhenti())
  const jejak = await page.evaluate(() => window.__jejak)

  const sisipBuruk = jejak.sisip.filter(s => s.kosong)
  catat(`Penanda baru sudah punya posisi saat disisipkan (${label})`,
    sisipBuruk.length === 0,
    `${jejak.sisip.length} penyisipan sepanjang zoom, ${sisipBuruk.length} tanpa transform`)

  // Titik nol wadah peta, tempat elemen tanpa transform akan terlukis. Ambangnya
  // sengaja sempit: penanda yang wajar bergerak keluar lewat tepi kiri juga melewati
  // daerah dekat pojok, dan itu bukan kedipan.
  const AMBANG = 12
  const dipojok = []
  jejak.bingkai.forEach((titik, i) => {
    for (const [seri, t] of Object.entries(titik)) {
      if (Math.hypot(t.x, t.y) < AMBANG) dipojok.push(`bingkai ${i}, penanda ${seri}, di ${t.x},${t.y}`)
    }
  })
  catat(`Tidak ada penanda melompat ke pojok kiri atas (${label})`,
    dipojok.length === 0,
    `${jejak.bingkai.length} bingkai direkam, ${dipojok.length} kemunculan di pojok${dipojok.length ? ': ' + dipojok.slice(0, 3).join('; ') : ''}`)

  // Selama geser dan zoom, seluruh penanda bergerak bersama menurut transformasi
  // yang sama. Jadi yang menandakan kedipan bukan perpindahan yang besar, melainkan
  // satu penanda yang berpindah jauh berbeda dari yang lain pada bingkai yang sama.
  // Perbandingan mutlak tidak bisa membedakan keduanya: saat zoom keluar, penanda
  // yang jauh dari pusat memang berpindah ratusan piksel dan itu benar.
  const lompat = []
  for (let i = 1; i < jejak.bingkai.length; i++) {
    const a = jejak.bingkai[i - 1], b = jejak.bingkai[i]
    const geser = []
    for (const [seri, t] of Object.entries(b)) {
      const s = a[seri]
      if (s) geser.push({ seri, d: Math.hypot(s.x - t.x, s.y - t.y) })
    }
    if (geser.length < 2) continue
    const urut = [...geser].map(g => g.d).sort((x, y) => x - y)
    const tengah = urut[Math.floor(urut.length / 2)]
    for (const g of geser) {
      if (g.d > tengah * 2 + 60) {
        lompat.push(`bingkai ${i}, penanda ${g.seri}, ${Math.round(g.d)}px sementara yang lain ${Math.round(tengah)}px`)
      }
    }
  }
  const lompatan = lompat.length
  catat(`Tidak ada penanda yang berpindah lain sendiri dari yang lain (${label})`,
    lompatan === 0,
    `${lompatan} penyimpangan di luar dua kali nilai tengah ditambah 60px${lompatan ? ': ' + lompat.slice(0, 3).join('; ') : ''}`)

  if (galat.length) console.log('    galat konsol:', galat.join(' | '))
  await page.screenshot({ path: join(KELUARAN, `zoom-penanda-${label}.png`) })
  await page.close()
  await konteks.close()
}

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
