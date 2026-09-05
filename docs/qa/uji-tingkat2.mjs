// Bukti butir 6 dan 7: panel daftar lokasi di dua ukuran layar, dan pengelompokan
// penanda yang membubar sendiri saat peta diperbesar.

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

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

// ---------- desktop: panel bersanding dengan peta ----------
{
  const konteks = await browser.newContext({
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2,
    locale: 'id-ID', timezoneId: 'Asia/Jakarta',
  })
  const page = await konteks.newPage()
  const galat = []
  page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 140)) })

  await page.goto(BASIS, { waitUntil: 'networkidle' })
  await sembunyikanDevtools(page)
  await page.waitForSelector('.maplibregl-canvas')
  await page.waitForTimeout(9500)

  const tata = await page.evaluate(() => {
    const sisi = document.querySelector('aside')
    const kanvas = document.querySelector('.maplibregl-canvas')
    const butir = document.querySelectorAll('aside li').length
    return {
      panelTampak: sisi ? getComputedStyle(sisi).display !== 'none' : false,
      lebarPanel: sisi ? Math.round(sisi.getBoundingClientRect().width) : 0,
      lebarPeta: kanvas ? Math.round(kanvas.getBoundingClientRect().width) : 0,
      butir,
      tabTampak: !!document.querySelector('[role=tablist]')
        && getComputedStyle(document.querySelector('[role=tablist]')).display !== 'none',
    }
  })
  catat('Panel daftar bersanding dengan peta di desktop',
    tata.panelTampak && tata.lebarPanel > 300 && tata.lebarPeta > 900,
    `panel ${tata.lebarPanel}px, peta ${tata.lebarPeta}px, ${tata.butir} butir`)
  catat('Tombol pindah tampilan disembunyikan di desktop', !tata.tabTampak)

  // menekan butir memindahkan fokus peta dan membuka kartunya
  const efek = await page.evaluate(async () => {
    const ambil = () => document.querySelector('article')?.querySelector('h2')?.textContent?.trim() ?? null
    const sebelum = ambil()
    const nama = document.querySelector('aside li button span span')?.textContent?.trim()
    document.querySelector('aside li button').click()
    await new Promise(r => setTimeout(r, 2200))
    return { sebelum, sesudah: ambil(), namaButir: nama }
  })
  catat('Menekan butir daftar membuka kartu lokasi itu',
    !!efek.sesudah && efek.sesudah === efek.namaButir,
    `butir "${efek.namaButir}" membuka kartu "${efek.sesudah}"`)

  await sembunyikanDevtools(page)
  await page.screenshot({ path: join(KELUARAN, 'panel-daftar-desktop.png') })
  if (galat.length) console.log('  galat konsol desktop:', galat.join(' | '))
  await konteks.close()
}

// ---------- ponsel: tampilan bergantian ----------
{
  const konteks = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'id-ID', timezoneId: 'Asia/Jakarta',
  })
  const page = await konteks.newPage()
  const galat = []
  page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 140)) })

  await page.goto(BASIS, { waitUntil: 'networkidle' })
  await sembunyikanDevtools(page)
  await page.waitForSelector('.maplibregl-canvas')
  await page.waitForTimeout(9500)

  const awal = await page.evaluate(() => ({
    petaTampak: getComputedStyle(document.querySelector('.maplibregl-map').closest('div.relative')).display !== 'none',
    panelTampak: getComputedStyle(document.querySelector('aside')).display !== 'none',
    tab: [...document.querySelectorAll('[role=tab]')].map(b => `${b.textContent.trim()}:${b.getAttribute('aria-selected')}`),
  }))
  catat('Ponsel mulai di tampilan peta', awal.petaTampak && !awal.panelTampak, awal.tab.join(' '))

  await page.evaluate(() => {
    [...document.querySelectorAll('[role=tab]')].find(b => b.textContent.trim() === 'daftar').click()
  })
  await page.waitForTimeout(900)
  const sesudah = await page.evaluate(() => ({
    panelTampak: getComputedStyle(document.querySelector('aside')).display !== 'none',
    butir: document.querySelectorAll('aside li').length,
    gulungMendatar: document.documentElement.scrollWidth > innerWidth,
  }))
  catat('Menekan tab daftar memindahkan tampilan',
    sesudah.panelTampak && sesudah.butir > 0 && !sesudah.gulungMendatar,
    `${sesudah.butir} butir, limpahan mendatar ${sesudah.gulungMendatar}`)
  await sembunyikanDevtools(page)
  await page.screenshot({ path: join(KELUARAN, 'panel-daftar-mobile.png') })

  // kembali ke peta lewat butir daftar
  const balik = await page.evaluate(async () => {
    document.querySelector('aside li button').click()
    await new Promise(r => setTimeout(r, 2400))
    return {
      panelTampak: getComputedStyle(document.querySelector('aside')).display !== 'none',
      adaKartu: !!document.querySelector('article'),
    }
  })
  catat('Memilih dari daftar di ponsel kembali ke peta dengan kartu terbuka',
    !balik.panelTampak && balik.adaKartu)

  if (galat.length) console.log('  galat konsol ponsel:', galat.join(' | '))
  await konteks.close()
}

// ---------- pengelompokan penanda ----------
{
  const konteks = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'id-ID', timezoneId: 'Asia/Jakarta',
  })
  const page = await konteks.newPage()
  const galat = []
  page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 140)) })

  await page.goto(BASIS, { waitUntil: 'networkidle' })
  await sembunyikanDevtools(page)
  await page.waitForSelector('.maplibregl-canvas')
  await page.waitForTimeout(9500)

  const hitung = () => page.evaluate(() => ({
    tunggal: document.querySelectorAll('.penanda-skor.maplibregl-marker').length,
    kluster: document.querySelectorAll('.penanda-kluster.maplibregl-marker').length,
    jumlahDiKluster: [...document.querySelectorAll('.penanda-kluster.maplibregl-marker')]
      .reduce((s, e) => s + Number(e.textContent), 0),
  }))

  const awal = await hitung()
  catat('Penanda berdempet dilebur jadi kelompok', awal.kluster > 0,
    `${awal.tunggal} tunggal, ${awal.kluster} kelompok berisi ${awal.jumlahDiKluster} lokasi`)

  const warna = await page.evaluate(() => {
    const k = document.querySelector('.penanda-kluster.maplibregl-marker')
    return k ? getComputedStyle(k).backgroundColor : null
  })
  catat('Kelompok memakai warna netral, bukan warna skor',
    warna !== null && !['rgb(99, 153, 34)', 'rgb(186, 117, 23)', 'rgb(226, 75, 74)'].includes(warna), warna ?? '-')

  await page.screenshot({ path: join(KELUARAN, 'kluster-penanda-mobile.png') })

  // menekan kelompok memperbesar dan memisahkannya
  if (awal.kluster > 0) {
    await page.evaluate(() => document.querySelector('.penanda-kluster.maplibregl-marker').click())
    await page.waitForTimeout(2600)
    const sesudah = await hitung()
    // Yang penting bertambahnya lokasi yang terlihat sendiri-sendiri, bukan
    // hilangnya kelompok dalam satu ketukan.
    catat('Menekan kelompok memperbesar peta dan memisahkan isinya',
      sesudah.tunggal > awal.tunggal && sesudah.jumlahDiKluster < awal.jumlahDiKluster,
      `tunggal ${awal.tunggal} jadi ${sesudah.tunggal}, terkelompok ${awal.jumlahDiKluster} jadi ${sesudah.jumlahDiKluster}`)
    await sembunyikanDevtools(page)
    await page.screenshot({ path: join(KELUARAN, 'kluster-terbuka-mobile.png') })
  }

  // angka skor tetap ada pada penanda tunggal
  const angka = await page.evaluate(() =>
    [...document.querySelectorAll('.penanda-skor.maplibregl-marker')].map(e => e.textContent.trim()))
  catat('Penanda tunggal tetap membawa angka skor',
    angka.length > 0 && angka.every(a => /^\d+$/.test(a)), angka.join(' '))

  if (galat.length) console.log('  galat konsol kluster:', galat.join(' | '))
  await konteks.close()
}

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
