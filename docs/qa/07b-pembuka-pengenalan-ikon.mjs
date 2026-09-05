// Ulangi langkah 24, 25, dan 29 dengan pengukuran yang benar.
// Percobaan pertama salah pada tiga hal: waktu pembuka diukur dari Node sehingga ikut
// terhambat utas utama, animasi wordmark dicari pada elemen svg padahal ia dipasang
// pada path .pembuka-glif, dan kalimat kartu pengenalan dicocokkan dengan teks yang
// tidak pernah ada di halaman.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { BASE, TANGKAPAN, BERKAS_AKUN, bidik, catat, pantauKonsol } from './lib.mjs'

const simpanan = JSON.parse(readFileSync(BERKAS_AKUN, 'utf8'))
const hasil = []
function nilai(nomor, nama, lolos, ket = '') {
  hasil.push({ nomor, nama, lolos, ket })
  catat(`${lolos ? 'LOLOS' : 'GAGAL'}  [${nomor}] ${nama}  ${ket}`)
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

// --- langkah 24: umur layar pembuka, diukur di dalam halaman ---
async function ukurPembuka(lambat) {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'id-ID' })
  // Pengukur dipasang sebelum skrip halaman mana pun berjalan, dan memakai
  // performance.now() milik halaman itu sendiri, jadi hasilnya tidak ikut terganggu
  // oleh lalu lintas antara Node dan peramban.
  await k.addInitScript(() => {
    window.__jejakPembuka = { muncul: null, padam: null, animasiLapisan: null, animasiGlif: null }
    const lihat = () => {
      const el = document.querySelector('.layar-pembuka')
      const j = window.__jejakPembuka
      if (el && j.muncul === null) {
        j.muncul = performance.now()
        const g = getComputedStyle(el)
        j.animasiLapisan = `${g.animationName} ${g.animationDuration}`
        const glif = el.querySelector('.pembuka-glif')
        if (glif) {
          const gg = getComputedStyle(glif)
          j.animasiGlif = `${gg.animationName} ${gg.animationDuration}`
        }
      }
      if (j.muncul !== null && j.padam === null) {
        if (!el) { j.padam = performance.now() }
        else {
          const g = getComputedStyle(el)
          if (g.visibility === 'hidden' || Number(g.opacity) < 0.02) j.padam = performance.now()
        }
      }
      if (j.padam === null) requestAnimationFrame(lihat)
    }
    requestAnimationFrame(lihat)
  })
  const p = await k.newPage()
  if (lambat) {
    const cdp = await k.newCDPSession(p)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 400,
      downloadThroughput: 50 * 1024 / 8, uploadThroughput: 20 * 1024 / 8,
    })
  }
  await p.goto(BASE, { waitUntil: 'commit' })
  await p.waitForFunction(() => window.__jejakPembuka?.padam !== null, null, { timeout: 60000 }).catch(() => {})
  const jejak = await p.evaluate(() => window.__jejakPembuka)
  await p.screenshot({ path: path.join(TANGKAPAN, `pembuka-${lambat ? 'lambat' : 'normal'}.png`) })
  await k.close()
  return jejak
}

const normal = await ukurPembuka(false)
const lambat = await ukurPembuka(true)
const umur = j => (j.padam !== null && j.muncul !== null) ? Math.round(j.padam - j.muncul) : null
catat(`pembuka normal: muncul ${Math.round(normal.muncul)} ms, padam ${Math.round(normal.padam)} ms, umur ${umur(normal)} ms, animasi lapisan "${normal.animasiLapisan}", animasi wordmark "${normal.animasiGlif}"`)
catat(`pembuka lambat: muncul ${Math.round(lambat.muncul)} ms, padam ${Math.round(lambat.padam)} ms, umur ${umur(lambat)} ms, animasi lapisan "${lambat.animasiLapisan}"`)
nilai(24, 'Layar pembuka beranimasi dan umurnya tidak pernah melebihi sekitar dua detik',
  umur(normal) !== null && umur(normal) <= 2200 && umur(lambat) !== null && umur(lambat) <= 2200
  && /melebur/.test(normal.animasiGlif || ''),
  `umur normal ${umur(normal)} ms, umur koneksi lambat ${umur(lambat)} ms, wordmark "${normal.animasiGlif}"`)

// --- langkah 25: kartu pengenalan ---
{
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'id-ID' })
  const p = await k.newPage()
  pantauKonsol(p, 'pengenalan')
  await p.goto(BASE, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(9000)
  const pertama = await p.evaluate(() => {
    const s = document.querySelector('section[aria-labelledby="judul-pengenalan"]')
    return { ada: !!s, judul: s?.querySelector('h2')?.textContent?.trim() || null }
  })
  await bidik(p, 'pengenalan-pertama')
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find(e => e.getAttribute('aria-label') === 'Tutup pengenalan')
    if (b) b.click()
  })
  await p.waitForTimeout(1200)
  const simpananLokal = await p.evaluate(() => Object.fromEntries(Object.entries(localStorage)))
  const setelahTutup = await p.evaluate(() => !!document.querySelector('section[aria-labelledby="judul-pengenalan"]'))
  await p.reload({ waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(9000)
  const kedua = await p.evaluate(() => !!document.querySelector('section[aria-labelledby="judul-pengenalan"]'))
  await bidik(p, 'pengenalan-setelah-muat-ulang')
  nilai(25, 'Kartu pengenalan muncul sekali lewat penyimpanan lokal dan tidak kembali',
    pertama.ada && !setelahTutup && !kedua && simpananLokal['landai:pengenalan-ditutup'] === '1',
    `muat pertama "${pertama.judul}", setelah ditutup ${setelahTutup ? 'masih ada' : 'hilang'}, localStorage ${JSON.stringify(simpananLokal)}, muat kedua ${kedua ? 'muncul lagi' : 'tidak muncul'}`)
  await k.close()
}

// --- langkah 29: ketebalan garis ikon, dipisahkan menurut perannya ---
{
  const k = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'id-ID' })
  const p = await k.newPage()
  pantauKonsol(p, 'ikon')
  const kumpul = async (jalur, tunggu) => {
    await p.goto(BASE + jalur, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(tunggu)
    return p.evaluate(() => [...document.querySelectorAll('svg')].map((s) => {
      const bergaris = s.getAttribute('stroke-width')
        || [...s.querySelectorAll('[stroke-width]')].map(e => e.getAttribute('stroke-width'))[0]
        || null
      const tombol = s.closest('button, a')
      return {
        tebal: bergaris,
        peran: tombol
          ? `kendali: ${(tombol.getAttribute('aria-label') || tombol.textContent.replace(/\s+/g, ' ').trim()).slice(0, 30)}`
          : `isi: ${(s.parentElement?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)}`,
      }
    }))
  }
  const petaIkon = await kumpul('/', 9000)
  const detailIkon = await kumpul(`/lokasi/${simpanan.idLokasi}`, 4000)
  const semua = [...petaIkon, ...detailIkon].filter(i => i.tebal)
  const isi = semua.filter(i => i.peran.startsWith('isi'))
  const kendali = semua.filter(i => i.peran.startsWith('kendali'))
  const tebalIsi = [...new Set(isi.map(i => i.tebal))]
  const tebalKendali = [...new Set(kendali.map(i => i.tebal))]
  writeFileSync(path.join(TANGKAPAN, 'ikon-ketebalan.json'), JSON.stringify({ petaIkon, detailIkon }, null, 2))
  catat('ikon isi: ' + JSON.stringify(isi))
  catat('ikon kendali: ' + JSON.stringify(kendali))
  nilai(29, 'Ikon fasilitas dan kebutuhan memakai ketebalan garis yang seragam',
    tebalIsi.length <= 1,
    `ikon isi ${JSON.stringify(tebalIsi)} dari ${isi.length} ikon, ikon kendali ${JSON.stringify(tebalKendali)} dari ${kendali.length} ikon`)
  await k.close()
}

writeFileSync(path.join(TANGKAPAN, 'hasil-07b.json'), JSON.stringify({ hasil, normal, lambat }, null, 2))
await browser.close()
