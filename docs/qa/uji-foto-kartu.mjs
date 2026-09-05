// Bukti butir 1: foto sungguhan tampil di kartu ringkas peta dan di halaman detail.
// Lokasi yang dipakai adalah Taman Literasi Martha Christina Tiahahu, satu-satunya
// yang punya foto hasil unggahan pengujian sebelumnya.

import { chromium } from 'playwright'
import { join } from 'node:path'

const BASIS = 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')
const ID_TAMAN = process.env.ID_LOKASI_FOTO

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

for (const [label, viewport] of [
  ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
]) {
  const konteks = await browser.newContext({ ...viewport, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })

  // --- kartu ringkas di peta ---
  const peta = await konteks.newPage()
  const galat = []
  peta.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 120)) })

  await peta.goto(BASIS, { waitUntil: 'networkidle' })
  await sembunyikanDevtools(peta)
  await peta.waitForSelector('.maplibregl-canvas')
  await peta.waitForTimeout(9000)
  await bukaKelompok(peta, '63')
  await peta.evaluate(() => {
    [...document.querySelectorAll('.penanda-skor.maplibregl-marker')].find(e => e.textContent === '63')?.click()
  })
  await peta.waitForTimeout(2500)
  await sembunyikanDevtools(peta)

  const fotoKartu = await peta.evaluate(() => {
    const img = document.querySelector('article img')
    if (!img) return null
    return {
      src: img.currentSrc || img.src,
      lebarAsli: img.naturalWidth,
      tinggiAsli: img.naturalHeight,
      tampil: img.getBoundingClientRect().width,
      alt: img.alt,
    }
  })

  const kartuOk = !!fotoKartu && fotoKartu.lebarAsli > 0 && fotoKartu.src.includes('location-photos')
  catat(`Kartu ringkas menampilkan foto sungguhan (${label})`, kartuOk,
    fotoKartu ? `${fotoKartu.lebarAsli}x${fotoKartu.tinggiAsli} piksel asli, tampil ${Math.round(fotoKartu.tampil)}px` : 'tidak ada gambar')
  await peta.screenshot({ path: join(KELUARAN, `foto-kartu-${label}.png`) })
  await peta.close()

  // --- halaman detail ---
  const detail = await konteks.newPage()
  detail.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 120)) })
  await detail.goto(`${BASIS}/lokasi/${ID_TAMAN}`, { waitUntil: 'networkidle' })
  await sembunyikanDevtools(detail)
  await detail.waitForTimeout(2500)

  const fotoDetail = await detail.evaluate(() =>
    [...document.images]
      .filter(i => i.src.includes('location-photos'))
      .map(i => ({ w: i.naturalWidth, h: i.naturalHeight, alt: i.alt })))

  catat(`Halaman detail menampilkan foto sungguhan (${label})`,
    fotoDetail.length > 0 && fotoDetail.every(f => f.w > 0),
    fotoDetail.length ? `${fotoDetail.length} foto, ${fotoDetail[0].w}x${fotoDetail[0].h} piksel asli` : 'tidak ada foto')

  await detail.screenshot({ path: join(KELUARAN, `foto-detail-${label}.png`) })
  await detail.close()

  if (galat.length) console.log('  galat konsol:', galat.join(' | '))
  await konteks.close()
}

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
