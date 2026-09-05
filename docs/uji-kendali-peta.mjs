// Menjaga tata letak kendali di sudut kanan bawah peta.
//
// Ketiganya membentuk satu kolom: tombol lokasi saya, grup perbesar, lalu atribusi.
// Sebelum diperbaiki, terukur sama di 375, 390, 768, dan 1440: tombol lokasi saya
// berjarak 16px dari tepi sedangkan grup perbesar 10px, dan celah antar keduanya
// MINUS 14px, artinya keduanya saling menindih, bukan sekadar berdempetan.
//
// Berkas ini juga yang menjaga nilai --dasar-kendali-peta di main.css. Nilai itu
// ditentukan MapLibre sendiri, yaitu tinggi atribusi ringkas ditambah margin bawahnya,
// jadi ia bisa berubah kalau MapLibre berganti versi. Kalau berubah, uji ini gagal
// lebih dulu sebelum kelihatan di layar orang.

import { chromium } from 'playwright'
import { join } from 'node:path'

const BASIS = 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')

/** Celah yang dianggap wajar antar kendali, dalam piksel. */
const CELAH_MIN = 8
const CELAH_MAKS = 20

/** Jarak minimum tiap kendali ke tepi peta. */
const TEPI_MIN = 12

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const [label, w, h] of [
  ['375', 375, 667],
  ['390', 390, 844],
  ['768', 768, 1024],
  ['desktop', 1440, 900],
]) {
  const konteks = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    isMobile: w < 768,
    hasTouch: w < 768,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  })
  const page = await konteks.newPage()

  await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({
    content: '#nuxt-devtools-anchor,#nuxt-devtools-container{display:none!important}',
  }).catch(() => {})
  await page.waitForSelector('.maplibregl-canvas')
  await page.waitForTimeout(9000)

  const u = await page.evaluate(() => {
    const kotak = (s) => {
      const e = document.querySelector(s)
      if (!e || e.offsetParent === null) return null
      const r = e.getBoundingClientRect()
      return {
        kiri: Math.round(r.left), kanan: Math.round(r.right),
        atas: Math.round(r.top), bawah: Math.round(r.bottom),
        lebar: Math.round(r.width), tinggi: Math.round(r.height),
      }
    }
    const peta = document.querySelector('.maplibregl-map').getBoundingClientRect()
    return {
      petaKanan: Math.round(peta.right),
      petaBawah: Math.round(peta.bottom),
      gps: kotak('button[aria-label*="lokasi saya" i]'),
      grup: kotak('.maplibregl-ctrl-group'),
      atribusi: kotak('.maplibregl-ctrl-attrib'),
    }
  })

  const { gps, grup, atribusi } = u

  catat(`Ketiga kendali sudut kanan bawah hadir (${label})`,
    !!gps && !!grup && !!atribusi)

  if (!gps || !grup) {
    await page.close(); await konteks.close(); continue
  }

  const tepiGps = u.petaKanan - gps.kanan
  const tepiGrup = u.petaKanan - grup.kanan
  catat(`Tombol lokasi dan grup perbesar segaris di tepi kanan (${label})`,
    tepiGps === tepiGrup && tepiGps >= TEPI_MIN,
    `keduanya ${tepiGps === tepiGrup ? tepiGps + 'px' : `${tepiGps}px berbanding ${tepiGrup}px`}`)

  const celah = grup.atas - gps.bawah
  catat(`Tombol lokasi tidak menindih grup perbesar (${label})`,
    celah >= CELAH_MIN && celah <= CELAH_MAKS,
    `celah ${celah}px, batas wajar ${CELAH_MIN} sampai ${CELAH_MAKS}px`)

  if (atribusi) {
    const celahAtribusi = atribusi.atas - grup.bawah
    catat(`Grup perbesar tidak menindih atribusi peta (${label})`,
      celahAtribusi >= 0, `celah ${celahAtribusi}px`)
  }

  catat(`Tidak ada kendali yang menempel tepi bawah peta (${label})`,
    u.petaBawah - (atribusi ? atribusi.bawah : grup.bawah) >= 0
    && u.petaBawah - grup.bawah >= TEPI_MIN,
    `grup perbesar ${u.petaBawah - grup.bawah}px dari tepi bawah`)

  catat(`Sasaran sentuh kendali tetap minimal 44px (${label})`,
    gps.tinggi >= 44 && gps.lebar >= 44 && grup.lebar >= 44 && grup.tinggi >= 88,
    `lokasi ${gps.lebar}x${gps.tinggi}, grup ${grup.lebar}x${grup.tinggi}`)

  await page.screenshot({ path: join(KELUARAN, `kendali-peta-${label}.png`) })
  await page.close()
  await konteks.close()
}

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
