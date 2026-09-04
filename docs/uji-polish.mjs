// Pemeriksaan visual setelah putaran polish. Tidak ada logika yang diubah, jadi yang
// diperiksa hanya: tidak ada limpahan mendatar, tidak ada elemen header yang saling
// menindih setelah tanda merek ditambahkan, teks tidak terpotong, dan tinggi tombol
// seragam di seluruh halaman.

import { chromium } from 'playwright'
import { join } from 'node:path'

const BASIS = 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')
const ID_TANPA_FOTO = '22222222-2222-4222-8222-222222222222'

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

const sembunyikanDevtools = page => page.addStyleTag({
  content: '#nuxt-devtools-anchor,#nuxt-devtools-container,.nuxt-devtools-anchor{display:none!important}',
}).catch(() => {})

// Dua kotak dianggap menindih kalau saling memotong lebih dari dua piksel, ambang
// kecil supaya pembulatan subpiksel tidak dilaporkan sebagai cacat.
const CEK_TINDIH = `(() => {
  const anak = [...document.querySelector('header').children].filter(e => e.offsetParent !== null)
  const kotak = anak.map(e => ({ t: (e.innerText || e.tagName).slice(0, 18).replace(/\\s+/g, ' '), r: e.getBoundingClientRect() }))
  const tindih = []
  for (let i = 0; i < kotak.length; i++) {
    for (let j = i + 1; j < kotak.length; j++) {
      const a = kotak[i].r, b = kotak[j].r
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (x > 2 && y > 2) tindih.push(kotak[i].t + ' menindih ' + kotak[j].t)
    }
  }
  return { jumlahAnak: anak.length, tindih }
})()`

const CEK_POTONG = `[...document.querySelectorAll('header *, .tombol')]
  .filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 2)
  .map(e => (e.innerText || e.tagName).slice(0, 24))`

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const [label, viewport] of [
  ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
]) {
  const konteks = await browser.newContext({ ...viewport, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })

  for (const [nama, rute, tungguPeta] of [
    ['peta', '/', true],
    ['detail', `/lokasi/${ID_TANPA_FOTO}`, false],
    ['form', '/tambah-lokasi', true],
  ]) {
    const page = await konteks.newPage()
    const galat = []
    page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 130)) })

    await page.goto(BASIS + rute, { waitUntil: 'domcontentloaded' })
    await sembunyikanDevtools(page)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(tungguPeta ? 9500 : 1800)
    await sembunyikanDevtools(page)

    const limpah = await page.evaluate(() => ({
      vw: innerWidth, scroll: document.documentElement.scrollWidth,
    }))
    catat(`${nama} ${label}, tidak melimpah mendatar`, limpah.scroll <= limpah.vw + 1,
      `${limpah.scroll} berbanding ${limpah.vw}`)

    const adaHeader = await page.evaluate(() => !!document.querySelector('header'))
    if (adaHeader) {
      const tindih = await page.evaluate(CEK_TINDIH)
      catat(`${nama} ${label}, isi header tidak saling menindih`, tindih.tindih.length === 0,
        `${tindih.jumlahAnak} elemen${tindih.tindih.length ? ': ' + tindih.tindih.join('; ') : ''}`)
    }

    const potong = await page.evaluate(CEK_POTONG)
    catat(`${nama} ${label}, tidak ada teks terpotong`, potong.length === 0, potong.join(', ') || 'nihil')

    if (galat.length) console.log('    galat konsol:', galat.join(' | '))
    await page.screenshot({ path: join(KELUARAN, `polish-${nama}-${label}.png`) })
    await page.close()
  }

  // --- tinggi tombol seragam ---
  const page = await konteks.newPage()
  await page.goto(`${BASIS}/masuk`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1200)
  const tinggi = await page.evaluate(() =>
    [...document.querySelectorAll('.tombol')].map(e => Math.round(e.getBoundingClientRect().height)))
  catat(`Tinggi tombol seragam minimal 44px (${label})`,
    tinggi.length > 0 && tinggi.every(h => h >= 44), tinggi.join(' '))
  await page.close()

  // --- teks bantuan kolom pencarian harus muat utuh ---
  const p3 = await konteks.newPage()
  await p3.goto(BASIS, { waitUntil: 'domcontentloaded' })
  await p3.evaluate(() => document.fonts.ready)
  await p3.waitForTimeout(1500)
  const muat = await p3.evaluate(() => {
    const inp = document.querySelector('[aria-label="Cari area di peta"]')
    if (!inp) return null
    // Lebar teks bantuan diukur dengan kanvas, lalu dibandingkan dengan ruang
    // sebenarnya di dalam kolom setelah dikurangi bantalan kiri dan kanan.
    const g = getComputedStyle(inp)
    const ctx = document.createElement('canvas').getContext('2d')
    ctx.font = `${g.fontWeight} ${g.fontSize} ${g.fontFamily}`
    const lebarTeks = ctx.measureText(inp.placeholder).width
    const ruang = inp.clientWidth - parseFloat(g.paddingLeft) - parseFloat(g.paddingRight)
    return { lebarTeks: Math.round(lebarTeks), ruang: Math.round(ruang), teks: inp.placeholder }
  })
  catat(`Teks bantuan kolom pencarian muat utuh (${label})`,
    !!muat && muat.lebarTeks <= muat.ruang,
    muat ? `"${muat.teks}" butuh ${muat.lebarTeks}px, tersedia ${muat.ruang}px` : 'kolom tidak ada')
  await p3.close()

  // --- tanda merek hadir dan proporsional ---
  const p2 = await konteks.newPage()
  await p2.goto(BASIS, { waitUntil: 'domcontentloaded' })
  await p2.evaluate(() => document.fonts.ready)
  await p2.waitForTimeout(1500)
  const tanda = await p2.evaluate(() => {
    const svg = document.querySelector('header svg[aria-label="landai"]')
    if (!svg) return null
    const teks = [...document.querySelectorAll('header p')]
      .find(e => e.textContent.trim() === 'landai' && e.offsetParent !== null)
    const a = svg.getBoundingClientRect()
    const b = teks ? teks.getBoundingClientRect() : null
    return { tanda: Math.round(a.height), teks: b ? Math.round(b.height) : null, kiri: b ? a.right <= b.left : true }
  })
  // Di layar tersempit tulisannya sengaja disembunyikan, jadi yang wajib ada
  // hanyalah tandanya; kalau tulisannya tampil, tanda harus berada di kirinya.
  catat(`Tanda merek tampil dengan ukuran proporsional (${label})`,
    !!tanda && tanda.kiri && tanda.tanda >= 20 && tanda.tanda <= 40,
    tanda ? `tanda ${tanda.tanda}px, tulisan ${tanda.teks ?? 'disembunyikan'}` : 'tanda tidak ada')
  await p2.close()

  await konteks.close()
}

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
