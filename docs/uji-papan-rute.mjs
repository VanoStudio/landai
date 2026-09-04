// Pemeriksaan putaran ini: papan kontributor, basemap baru, dan tombol rute.
// Tidak ada logika penyimpanan yang berubah, jadi yang diperiksa tampilannya saja.

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

const bersihkan = page => page.addStyleTag({
  content: '#nuxt-devtools-anchor,#nuxt-devtools-container,.nuxt-devtools-anchor{display:none!important}',
}).catch(() => {})

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const [label, vp] of [
  ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
]) {
  const konteks = await browser.newContext({ ...vp, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })

  // ---------- papan kontributor ----------
  {
    const page = await konteks.newPage()
    const galat = []
    page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 130)) })

    await page.goto(`${BASIS}/papan-kontributor`, { waitUntil: 'domcontentloaded' })
    await bersihkan(page)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(1800)

    const papan = await page.evaluate(() => {
      const baris = [...document.querySelectorAll('ol > li')]
      const bilah = [...document.querySelectorAll('[role=progressbar]')]
      return {
        baris: baris.length,
        bilah: bilah.length,
        nilai: bilah.map(b => b.getAttribute('aria-valuenow')),
        lebarTerisi: bilah.map(b => b.firstElementChild
          ? Math.round(b.firstElementChild.getBoundingClientRect().width / b.getBoundingClientRect().width * 100)
          : null),
        warnaTerisi: bilah[0]?.firstElementChild ? getComputedStyle(bilah[0].firstElementChild).backgroundColor : null,
        limpah: document.documentElement.scrollWidth > innerWidth,
        adaHadiah: /hadiah|klaim|tukar|voucher|poin/i.test(document.body.innerText),
        bukanHadiah: document.body.innerText.includes('bukan program hadiah'),
      }
    })

    catat(`Papan menampilkan baris kontributor (${label})`, papan.baris > 0,
      `${papan.baris} baris, ${papan.bilah} bilah kemajuan`)
    catat(`Bilah kemajuan sesuai nilai aria (${label})`,
      papan.bilah > 0 && papan.nilai.every((v, i) => Math.abs(Number(v) - papan.lebarTerisi[i]) <= 2),
      `aria ${papan.nilai.join(',')} berbanding lebar ${papan.lebarTerisi.join(',')} persen`)
    catat(`Bilah memakai hijau merek, bukan warna baru (${label})`,
      papan.warnaTerisi === 'oklch(0.4 0.0813 168.556)' || /15, 110, 86/.test(papan.warnaTerisi || ''),
      papan.warnaTerisi ?? '-')
    catat(`Tidak ada janji hadiah, dinyatakan tegas (${label})`,
      papan.bukanHadiah, papan.adaHadiah ? 'kata hadiah muncul, dicek konteksnya' : 'nihil')
    catat(`Papan tidak melimpah mendatar (${label})`, !papan.limpah)

    await page.screenshot({ path: join(KELUARAN, `papan-kontributor-${label}.png`), fullPage: label === 'mobile' })
    if (galat.length) console.log('    galat konsol:', galat.join(' | '))
    await page.close()
  }

  // ---------- tombol rute di halaman detail ----------
  {
    const page = await konteks.newPage()
    await page.goto(`${BASIS}/lokasi/${ID_TANPA_FOTO}`, { waitUntil: 'domcontentloaded' })
    await bersihkan(page)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(1500)

    const rute = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a')].find(e => e.textContent.includes('Buka rute'))
      if (!a) return null
      return {
        href: a.getAttribute('href'),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
        sekunder: a.classList.contains('tombol-sekunder'),
        tinggi: Math.round(a.getBoundingClientRect().height),
      }
    })
    catat(`Tombol rute ada di halaman detail (${label})`,
      !!rute && rute.href.startsWith('https://www.google.com/maps/dir/?api=1&destination=')
      && rute.target === '_blank' && (rute.rel || '').includes('noopener') && rute.sekunder,
      rute ? `${rute.href.slice(-24)}, gaya sekunder, tinggi ${rute.tinggi}px` : 'tidak ada')
    await page.screenshot({ path: join(KELUARAN, `rute-detail-${label}.png`) })
    await page.close()
  }

  // ---------- tombol rute di kartu ringkas ----------
  {
    const page = await konteks.newPage()
    await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
    await bersihkan(page)
    await page.waitForSelector('.maplibregl-canvas')
    await page.waitForTimeout(11000)

    // Penanda bisa tersembunyi di kelompok, jadi kelompoknya dibuka dulu.
    for (let i = 0; i < 3; i++) {
      const ada = await page.evaluate(() => document.querySelectorAll('.penanda-skor.maplibregl-marker').length > 0)
      const kluster = await page.evaluate(() => {
        const k = document.querySelector('.penanda-kluster.maplibregl-marker')
        if (!k) return false
        k.click(); return true
      })
      if (ada && !kluster) break
      if (!kluster) break
      await page.waitForTimeout(2400)
    }
    await page.evaluate(() => document.querySelector('.penanda-skor.maplibregl-marker')?.click())
    await page.waitForTimeout(1600)
    await bersihkan(page)

    const kartu = await page.evaluate(() => {
      const art = document.querySelector('article')
      if (!art) return null
      const a = [...art.querySelectorAll('a')].find(e => e.textContent.includes('Buka rute'))
      const detail = [...art.querySelectorAll('a')].find(e => e.textContent.includes('Lihat detail'))
      if (!a || !detail) return null
      return {
        sekunder: a.classList.contains('tombol-sekunder'),
        detailUtama: detail.classList.contains('tombol-utama'),
        sebarisan: Math.abs(a.getBoundingClientRect().top - detail.getBoundingClientRect().top) < 4,
        limpah: art.scrollWidth > art.clientWidth + 2,
      }
    })
    catat(`Tombol rute berdampingan di kartu, gaya sekunder (${label})`,
      !!kartu && kartu.sekunder && kartu.detailUtama && !kartu.limpah,
      kartu ? `sebaris dengan lihat detail: ${kartu.sebarisan}, kartu melimpah: ${kartu.limpah}` : 'kartu tidak ada')
    await page.screenshot({ path: join(KELUARAN, `rute-kartu-${label}.png`) })
    await page.close()
  }

  await konteks.close()
}

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
