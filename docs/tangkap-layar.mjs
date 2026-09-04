import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const BASIS = 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')
const ID_STASIUN = '11111111-1111-4111-8111-111111111111'

const UKURAN = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
}

// Halaman peta perlu menunggu WebGL selesai melukis tile, bukan sekadar DOM siap.
async function tungguPeta(page) {
  await page.waitForSelector('.maplibregl-canvas', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(9000)
}

// Gelembung Nuxt DevTools mengambang di tengah bawah, menutupi tombol utama form
// sehingga Playwright menolak mengkliknya, dan ikut terekam ke tangkapan layar.
// Disembunyikan di setiap halaman sebelum apa pun dilakukan.
async function sembunyikanDevtools(page) {
  await page.addStyleTag({
    content: `#nuxt-devtools-anchor, #nuxt-devtools-container, .nuxt-devtools-anchor,
              [data-v-inspector-container] { display: none !important; }`,
  }).catch(() => {})
}

// Klik lewat DOM, bukan lewat pemeriksaan actionability Playwright, supaya urutan
// langkah form tidak bergantung pada apa pun yang mengambang di atasnya.
async function klik(page, teks) {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === t)
    if (!b) throw new Error('tombol tidak ketemu: ' + t)
    b.click()
  }, teks)
  await page.waitForTimeout(500)
}

// Penanda yang dicari bisa tersembunyi di dalam kelompok setelah pengelompokan
// dipasang. Kelompok dibuka dulu sampai penanda tunggalnya muncul.
async function bukaKelompok(page, angka) {
  for (let i = 0; i < 4; i++) {
    const ada = await page.evaluate(a =>
      [...document.querySelectorAll('.penanda-skor.maplibregl-marker')].some(e => e.textContent === a), angka)
    if (ada) return
    const adaKluster = await page.evaluate(() => {
      const k = document.querySelector('.penanda-kluster.maplibregl-marker')
      if (!k) return false
      k.click()
      return true
    })
    if (!adaKluster) return
    await page.waitForTimeout(2600)
  }
}

async function tungguFont(page) {
  await page.evaluate(() => document.fonts.ready).catch(() => {})
  await page.waitForTimeout(400)
}

const LAYAR = [
  {
    nama: 'peta',
    url: '/',
    siap: tungguPeta,
  },
  {
    nama: 'peta-kartu',
    url: '/',
    siap: async (page) => {
      await tungguPeta(page)
      await bukaKelompok(page, '50')
      await page.evaluate(() => {
        const m = [...document.querySelectorAll('.penanda-skor.maplibregl-marker')].find(e => e.textContent === '50')
        m?.click()
      })
      await page.waitForTimeout(1400)
    },
  },
  {
    nama: 'peta-filter',
    url: '/',
    siap: async (page) => {
      await tungguPeta(page)
      await page.evaluate(() => {
        const c = [...document.querySelectorAll('[aria-pressed]')]
          .find(b => b.innerText.includes('Tunanetra'))
        c?.click()
      })
      await page.waitForTimeout(1500)
    },
  },
  { nama: 'detail', url: `/lokasi/${ID_STASIUN}`, siap: tungguFont },
  { nama: 'detail-penuh', url: `/lokasi/${ID_STASIUN}`, siap: tungguFont, penuh: true },
  { nama: 'tentang', url: '/tentang', siap: tungguFont },
  { nama: 'tentang-penuh', url: '/tentang', siap: tungguFont, penuh: true },
  { nama: 'daftar', url: '/daftar', siap: tungguFont },
  { nama: 'masuk', url: '/masuk', siap: tungguFont },
  {
    nama: 'form-1-titik',
    url: '/tambah-lokasi',
    siap: async (page) => { await tungguFont(page); await page.waitForTimeout(7000) },
  },
  {
    nama: 'form-2-tempat',
    url: '/tambah-lokasi',
    siap: async (page) => {
      await tungguFont(page)
      await page.waitForTimeout(3000)
      await klik(page, 'Lanjut')
      await page.fill('#nama-tempat', 'Stasiun MRT Blok M')
      await page.waitForTimeout(600)
    },
  },
  {
    nama: 'form-3-checklist',
    url: '/tambah-lokasi',
    siap: async (page) => {
      await tungguFont(page)
      await page.waitForTimeout(3000)
      await klik(page, 'Lanjut')
      await page.fill('#nama-tempat', 'Stasiun MRT Blok M')
      await klik(page, 'Lanjut')
      await page.waitForTimeout(500)
      const kotak = await page.$$('input[type=checkbox]')
      for (const i of [0, 1, 2, 4, 5, 6, 7]) await kotak[i].click()
      await page.waitForTimeout(600)
    },
  },
  {
    nama: 'form-4-foto',
    url: '/tambah-lokasi',
    siap: async (page) => {
      await tungguFont(page)
      await page.waitForTimeout(3000)
      await klik(page, 'Lanjut')
      await page.fill('#nama-tempat', 'Stasiun MRT Blok M')
      await klik(page, 'Lanjut')
      await klik(page, 'Lanjut')
      await page.waitForTimeout(500)
      await page.fill('#catatan', 'Ramp ada tapi cukup curam, sebaiknya ditemani.')
      await page.waitForTimeout(600)
    },
  },
]

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

await mkdir(KELUARAN, { recursive: true })
const hasil = []

for (const [label, viewport] of Object.entries(UKURAN)) {
  const konteks = await browser.newContext({
    ...viewport,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  })
  console.log(`[${label}] viewport ${viewport.viewport.width}x${viewport.viewport.height}`)

  for (const layar of LAYAR) {
    if (layar.penuh && label === 'desktop') continue

    const page = await konteks.newPage()
    const galat = []
    page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 140)) })

    await page.goto(BASIS + layar.url, { waitUntil: 'networkidle', timeout: 60000 })
    await sembunyikanDevtools(page)
    await layar.siap(page)
    await sembunyikanDevtools(page)

    const berkas = join(KELUARAN, `${layar.nama}-${label}.png`)
    await page.screenshot({ path: berkas, fullPage: !!layar.penuh })
    hasil.push({ layar: layar.nama, ukuran: label, berkas, galat })
    console.log(`  ${layar.nama}-${label}${galat.length ? '  ERROR: ' + galat[0] : ''}`)
    await page.close()
  }

  await konteks.close()
}

await browser.close()

const gagal = hasil.filter(h => h.galat.length)
console.log(`\n${hasil.length} tangkapan tersimpan di ${KELUARAN}`)
console.log(gagal.length ? `${gagal.length} halaman punya console error` : 'nol console error di semua halaman')
