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

// ---------- desktop: panel daftar dipanggil, bukan kolom tetap ----------
//
// Pemeriksaan di blok ini dulu menuntut panel daftar selalu bersanding dengan peta
// di desktop, dan menuntut pemindah tampilan disembunyikan di sana. Keduanya sudah
// tidak berlaku sejak panel diubah jadi panel yang dipanggil lalu ditutup lagi:
// kolom tetap memangkas lebar peta selamanya, padahal peta yang dilihat orang.
// Yang diuji sekarang perilaku yang sekarang benar, yaitu peta selebar penuh secara
// bawaan, panel dibuka lewat pemindah tampilan, dan lebar kanvas peta tidak ikut
// berubah saat panel dibuka.
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

  const ukur = () => page.evaluate(() => {
    const sisi = document.querySelector('aside')
    const kanvas = document.querySelector('.maplibregl-canvas')
    const tab = document.querySelector('[role=tablist]')
    return {
      panelTampak: sisi ? getComputedStyle(sisi).display !== 'none' : false,
      lebarPanel: sisi ? Math.round(sisi.getBoundingClientRect().width) : 0,
      lebarPeta: kanvas ? Math.round(kanvas.getBoundingClientRect().width) : 0,
      butir: document.querySelectorAll('aside li').length,
      tabTampak: !!tab && getComputedStyle(tab).display !== 'none',
      labelTab: [...document.querySelectorAll('[role=tab]')].map(b => b.textContent.trim()),
    }
  })

  const tutup = await ukur()
  catat('Peta selebar penuh dan panel daftar tertutup secara bawaan di desktop',
    !tutup.panelTampak && tutup.lebarPeta > 900,
    `peta ${tutup.lebarPeta}px, panel ${tutup.lebarPanel}px`)
  catat('Pemindah tampilan tersedia di desktop, bukan disembunyikan',
    tutup.tabTampak, tutup.labelTab.join(' | '))
  catat('Label pemindah menyebut Daftar Lokasi, bukan Daftar sendirian',
    tutup.labelTab.some(l => /^Daftar Lokasi$/.test(l)), tutup.labelTab.join(' | '))

  await page.evaluate(() => {
    ;[...document.querySelectorAll('[role=tab]')]
      .find(b => /daftar/i.test(b.textContent)).click()
  })
  await page.waitForTimeout(900)

  const buka = await ukur()
  catat('Panel daftar terbuka lewat pemindah tampilan di desktop',
    buka.panelTampak && buka.lebarPanel > 300 && buka.butir > 0,
    `panel ${buka.lebarPanel}px, ${buka.butir} butir`)
  catat('Lebar kanvas peta tidak berubah saat panel dibuka',
    buka.lebarPeta === tutup.lebarPeta,
    `${tutup.lebarPeta}px lalu ${buka.lebarPeta}px`)

  // menekan butir memindahkan fokus peta dan membuka kartunya
  const efek = await page.evaluate(async () => {
    const ambil = () => document.querySelector('article')?.querySelector('h2')?.textContent?.trim() ?? null
    const sebelum = ambil()
    const nama = document.querySelector('aside li button span.truncate')?.textContent?.trim()
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
    panelTampak: (() => { const a = document.querySelector('aside'); return !!a && getComputedStyle(a).display !== 'none' })(),
    tab: [...document.querySelectorAll('[role=tab]')].map(b => `${b.textContent.trim()}:${b.getAttribute('aria-selected')}`),
  }))
  catat('Ponsel mulai di tampilan peta', awal.petaTampak && !awal.panelTampak, awal.tab.join(' '))

  await page.evaluate(() => {
    // Labelnya kini "Daftar Lokasi", bukan lagi nilai keadaannya sendiri, karena
    // "Daftar" sendirian tertukar arti dengan mendaftar akun. Dicocokkan longgar
    // supaya pengujian ini menguji perilakunya, bukan ejaan labelnya.
    ;[...document.querySelectorAll('[role=tab]')]
      .find(b => /daftar/i.test(b.textContent)).click()
  })
  await page.waitForTimeout(900)
  const sesudah = await page.evaluate(() => ({
    panelTampak: (() => { const a = document.querySelector('aside'); return !!a && getComputedStyle(a).display !== 'none' })(),
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
      panelTampak: (() => { const a = document.querySelector('aside'); return !!a && getComputedStyle(a).display !== 'none' })(),
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

  // Warnanya dibaca dari `.penanda-bulat`, elemen anak yang memikul seluruh gaya.
  // Elemen penanda luarnya sengaja tanpa latar sama sekali, karena transform-nya
  // milik MapLibre dan tidak boleh dibebani gaya apa pun.
  const warna = await page.evaluate(() => {
    const k = document.querySelector('.penanda-kluster.maplibregl-marker .penanda-bulat')
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
