// Audit responsif empat lebar: 320 (layar tersempit yang masih dipakai), 375 (iPhone SE),
// 390 (iPhone 14), dan desktop.
// Yang diperiksa: tidak ada limpahan mendatar, tidak ada elemen header yang saling
// menindih, tidak ada teks terpotong, seluruh chip penyaring bisa dijangkau, dan
// sasaran sentuh tidak turun di bawah 44 piksel.

import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const BERKAS_ENV = ['.env', '../.env'].map(x => resolve(x)).find(existsSync)
const env = Object.fromEntries(readFileSync(BERKAS_ENV, 'utf8')
  .split(String.fromCharCode(10)).map(b => b.trim()).filter(b => b.includes('='))
  .map((b) => { const i = b.indexOf('='); return [b.slice(0, i).trim(), b.slice(i + 1).trim()] }))
process.env.SUPABASE_URL_UJI = env.SUPABASE_URL
process.env.SUPABASE_KEY_UJI = env.SUPABASE_KEY

const BASIS = 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')
// Id lokasi diambil dari basis data, bukan ditulis mati. Id yang ditulis mati
// menunjuk data contoh, dan begitu data itu dihapus, yang terukur justru halaman
// galat bawaan Nuxt, bukan halaman detail.
const ID_UJI = (await (await fetch(
  `${process.env.SUPABASE_URL_UJI}/rest/v1/locations?select=id&limit=1`,
  { headers: { apikey: process.env.SUPABASE_KEY_UJI } })).json())[0]?.id

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

const bersihkan = page => page.addStyleTag({
  content: '#nuxt-devtools-anchor,#nuxt-devtools-container,.nuxt-devtools-anchor{display:none!important}',
}).catch(() => {})

// Dua kotak dianggap menindih kalau saling memotong lebih dari dua piksel.
const CEK_TINDIH = `(() => {
  const h = document.querySelector('header')
  if (!h) return { jumlahAnak: 0, tindih: [] }
  const anak = [...h.children].filter(e => e.offsetParent !== null)
  const kotak = anak.map(e => ({ t: (e.innerText || e.tagName).slice(0, 18).replace(/\\s+/g, ' '), r: e.getBoundingClientRect() }))
  const tindih = []
  for (let i = 0; i < kotak.length; i++) {
    for (let j = i + 1; j < kotak.length; j++) {
      const a = kotak[i].r, b = kotak[j].r
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2
        && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) {
        tindih.push(kotak[i].t + ' menindih ' + kotak[j].t)
      }
    }
  }
  return { jumlahAnak: anak.length, tindih }
})()`

// Elemen yang isinya lebih lebar daripada kotaknya sendiri, tidak termasuk wadah
// yang memang sengaja bisa digulir mendatar.
const CEK_POTONG = `[...document.querySelectorAll('body *')]
  .filter(e => e.offsetParent !== null
    && e.scrollWidth > e.clientWidth + 2
    && !['auto', 'scroll'].includes(getComputedStyle(e).overflowX)
    && !e.closest('.sr-only')
    && !e.classList.contains('sr-only')
    && e.children.length === 0)
  .map(e => (e.innerText || e.tagName).slice(0, 30))
  .slice(0, 6)`

// Sasaran sentuh di bawah ambang. Hanya elemen yang benar-benar bisa diketuk.
// Dikecualikan: atribusi peta, yang wajib ada dan konvensinya memang kecil, serta
// tautan yang berada di dalam kalimat, yang dikecualikan aturan ukuran sasaran.
const CEK_SENTUH = `[...document.querySelectorAll('button, a[href], input, select, [role=tab]')]
  .filter(e => e.offsetParent !== null
    && !e.closest('.maplibregl-ctrl-attrib')
    && !(e.tagName === 'A' && e.parentElement && ['P', 'SPAN', 'LI'].includes(e.parentElement.tagName)))
  .map(e => ({ t: (e.innerText || e.getAttribute('aria-label') || e.tagName).slice(0, 24).replace(/\\s+/g, ' '),
               w: Math.round(e.getBoundingClientRect().width),
               h: Math.round(e.getBoundingClientRect().height) }))
  .filter(e => e.h < 44 || e.w < 24)`

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const [label, vp] of [
  ['320', { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['375', { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
]) {
  const konteks = await browser.newContext({ ...vp, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })

  for (const [nama, rute, tungguPeta] of [
    ['peta', '/', true],
    ['detail', `/lokasi/${ID_UJI}`, false],
    ['form', '/tambah-lokasi', true],
    ['papan', '/papan-kontributor', false],
  ]) {
    const page = await konteks.newPage()
    const galat = []
    page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 130)) })

    await page.goto(BASIS + rute, { waitUntil: 'domcontentloaded' })
    await bersihkan(page)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(tungguPeta ? 9500 : 1800)
    await bersihkan(page)

    const limpah = await page.evaluate(() => ({ vw: innerWidth, scroll: document.documentElement.scrollWidth }))
    catat(`${nama} ${label}, tidak melimpah mendatar`, limpah.scroll <= limpah.vw + 1,
      `${limpah.scroll} berbanding ${limpah.vw}`)

    const tindih = await page.evaluate(CEK_TINDIH)
    if (tindih.jumlahAnak > 0) {
      catat(`${nama} ${label}, isi header tidak saling menindih`, tindih.tindih.length === 0,
        `${tindih.jumlahAnak} elemen${tindih.tindih.length ? ': ' + tindih.tindih.join('; ') : ''}`)
    }

    const potong = await page.evaluate(CEK_POTONG)
    catat(`${nama} ${label}, tidak ada teks terpotong`, potong.length === 0, potong.join(', ') || 'nihil')

    const sentuh = await page.evaluate(CEK_SENTUH)
    catat(`${nama} ${label}, sasaran sentuh minimal 44px`, sentuh.length === 0,
      sentuh.map(e => `${e.t} ${e.w}x${e.h}`).join(', ') || 'nihil')

    if (galat.length) console.log('    galat konsol:', galat.join(' | '))
    await page.screenshot({ path: join(KELUARAN, `resp-${nama}-${label}.png`) })
    await page.close()
  }

  // ---------- chip penyaring bisa dijangkau seluruhnya ----------
  {
    const page = await konteks.newPage()
    await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
    await bersihkan(page)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(3000)

    const awal = await page.evaluate(() => {
      const baris = document.querySelector('.baris-chip')
      const chip = [...document.querySelectorAll('[aria-pressed]')]
      const kotak = baris.getBoundingClientRect()
      return {
        bergulir: baris.scrollWidth > baris.clientWidth + 2,
        jumlahChip: chip.length,
        // Chip dianggap terjangkau kalau seluruh badannya masuk ke dalam kotak
        // baris setelah baris itu digulir sampai ujung.
        terlihatSekarang: chip.filter(c => {
          const r = c.getBoundingClientRect()
          return r.left >= kotak.left - 1 && r.right <= kotak.right + 1
        }).length,
        kabut: !!document.querySelector('.kabut-gulir'),
      }
    })

    // Digulir sampai ujung kanan, lalu dihitung ulang.
    await page.evaluate(() => {
      const b = document.querySelector('.baris-chip')
      b.scrollLeft = b.scrollWidth
      b.dispatchEvent(new Event('scroll'))
    })
    await page.waitForTimeout(500)

    const akhir = await page.evaluate(() => {
      const baris = document.querySelector('.baris-chip')
      const kotak = baris.getBoundingClientRect()
      const chip = [...document.querySelectorAll('[aria-pressed]')]
      return {
        terlihatDiUjung: chip.filter(c => {
          const r = c.getBoundingClientRect()
          return r.left >= kotak.left - 1 && r.right <= kotak.right + 1
        }).length,
        kabutMasihAda: (() => {
          const k = document.querySelector('.kabut-gulir')
          return !!k && k.offsetParent !== null
        })(),
      }
    })

    const semuaTerjangkau = awal.terlihatSekarang === awal.jumlahChip
      || akhir.terlihatDiUjung + awal.terlihatSekarang >= awal.jumlahChip
    catat(`Seluruh chip penyaring bisa dijangkau (${label})`, semuaTerjangkau,
      `${awal.jumlahChip} chip, ${awal.terlihatSekarang} terlihat di awal, ${akhir.terlihatDiUjung} di ujung, bergulir ${awal.bergulir}`)

    if (awal.bergulir) {
      catat(`Kabut kelanjutan tampil saat masih ada isi, padam di ujung (${label})`,
        awal.kabut && !akhir.kabutMasihAda,
        `di awal ${awal.kabut}, di ujung ${akhir.kabutMasihAda}`)
    }

    await page.screenshot({ path: join(KELUARAN, `resp-chip-${label}.png`) })
    await page.close()
  }

  await konteks.close()
}

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
