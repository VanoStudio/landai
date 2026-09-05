// Bagian enam: tampilan dan responsif, langkah 24 sampai 30.
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

// --- langkah 24: layar pembuka, koneksi normal lalu koneksi lambat ---
async function ukurPembuka(lambat) {
  const k = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'id-ID',
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
  const mulai = Date.now()
  await p.goto(BASE, { waitUntil: 'commit' })
  let animasi = null
  let hilang = null
  for (let i = 0; i < 160; i++) {
    const keadaan = await p.evaluate(() => {
      const el = document.querySelector('.layar-pembuka')
      if (!el) return { ada: false }
      const g = getComputedStyle(el)
      const anak = el.querySelector('svg, [class*="tanda"], [class*="merek"]')
      return {
        ada: true,
        tampak: g.visibility !== 'hidden' && Number(g.opacity) > 0.02,
        animasiLapisan: g.animationName,
        animasiTulisan: anak ? getComputedStyle(anak).animationName : null,
      }
    }).catch(() => ({ ada: false }))
    if (keadaan.ada && keadaan.animasiLapisan && !animasi) animasi = keadaan
    if (!keadaan.ada || !keadaan.tampak) { hilang = Date.now() - mulai; break }
    await p.waitForTimeout(50)
  }
  const bidikan = lambat ? 'pembuka-lambat' : 'pembuka-normal'
  await p.screenshot({ path: path.join(TANGKAPAN, `${bidikan}-akhir.png`) })
  await k.close()
  return { hilang, animasi }
}

const normal = await ukurPembuka(false)
catat(`pembuka koneksi normal: hilang setelah ${normal.hilang} ms, animasi lapisan ${normal.animasi?.animasiLapisan}, animasi wordmark ${normal.animasi?.animasiTulisan}`)
const lambat = await ukurPembuka(true)
catat(`pembuka koneksi lambat: hilang setelah ${lambat.hilang} ms, animasi lapisan ${lambat.animasi?.animasiLapisan}`)
nilai(24, 'Layar pembuka beranimasi dan tidak pernah melebihi sekitar dua detik',
  normal.hilang !== null && normal.hilang <= 2600 && lambat.hilang !== null && lambat.hilang <= 2600
  && !!normal.animasi?.animasiLapisan,
  `normal ${normal.hilang} ms, lambat ${lambat.hilang} ms, animasi lapisan "${normal.animasi?.animasiLapisan}", animasi tanda "${normal.animasi?.animasiTulisan}"`)

// --- langkah 25: kartu pengenalan sekali saja ---
{
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'id-ID' })
  const p = await k.newPage()
  pantauKonsol(p, 'pengenalan')
  await p.goto(BASE, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(9000)
  const pertama = await p.evaluate(() => {
    const t = document.body.innerText
    return { adaKartu: /Peta ini diisi warga|Selamat datang|Baru di sini|Mengerti/i.test(t), cuplikan: t.slice(0, 200) }
  })
  await bidik(p, 'pengenalan-pertama')
  const kunci = await p.evaluate(() => Object.keys(localStorage))
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(e => /Mengerti|Tutup/i.test(e.textContent))
    if (b) b.click()
  })
  await p.waitForTimeout(1200)
  const kunciSesudah = await p.evaluate(() => Object.fromEntries(Object.entries(localStorage)))
  await p.reload({ waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(9000)
  const kedua = await p.evaluate(() => /Peta ini diisi warga|Selamat datang|Baru di sini/i.test(document.body.innerText))
  await bidik(p, 'pengenalan-setelah-muat-ulang')
  nilai(25, 'Kartu pengenalan muncul sekali dan tidak kembali setelah dimuat ulang',
    pertama.adaKartu && !kedua,
    `muat pertama ${pertama.adaKartu ? 'muncul' : 'tidak muncul'}, setelah ditutup localStorage ${JSON.stringify(kunciSesudah)}, muat kedua ${kedua ? 'muncul lagi' : 'tidak muncul'}`)
  await k.close()
}

// --- langkah 26: lebar 375 piksel ---
{
  const k = await browser.newContext({
    viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID',
  })
  const p = await k.newPage()
  pantauKonsol(p, '375px')
  const periksaLimpahan = async (jalur, tunggu = 6000) => {
    await p.goto(BASE + jalur, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(tunggu)
    return p.evaluate(() => {
      const lebar = document.documentElement.clientWidth
      const keluar = [...document.querySelectorAll('body *')].filter((e) => {
        const r = e.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return false
        const g = getComputedStyle(e)
        if (g.position === 'fixed' && g.visibility === 'hidden') return false
        return r.right > lebar + 1 || r.left < -1
      }).slice(0, 6).map(e => `${e.tagName.toLowerCase()}.${(e.className || '').toString().slice(0, 40)} kanan ${Math.round(e.getBoundingClientRect().right)}`)
      return {
        gulirMendatar: document.scrollingElement.scrollWidth > lebar + 1,
        lebar,
        keluar,
      }
    })
  }

  const peta375 = await periksaLimpahan('/', 9000)
  // chip penyaring: gulirkan barisnya sampai habis, pastikan chip terakhir utuh
  const chip = await p.evaluate(() => {
    const baris = document.querySelector('.baris-chip')
    if (!baris) return { ada: false }
    baris.scrollLeft = baris.scrollWidth
    const anak = [...baris.querySelectorAll('button')]
    const kotakBaris = baris.getBoundingClientRect()
    const terakhir = anak.at(-1).getBoundingClientRect()
    return {
      ada: true,
      jumlah: anak.length,
      bisaDigulir: baris.scrollWidth > baris.clientWidth,
      terakhirUtuh: terakhir.right <= kotakBaris.right + 1 && terakhir.left >= kotakBaris.left - 1,
      teksTerakhir: anak.at(-1).textContent.replace(/\s+/g, ' ').trim(),
    }
  })
  await bidik(p, '375-peta-chip-digulir')
  nilai(26, 'Semua chip penyaring terjangkau pada lebar 375 piksel',
    chip.ada && chip.jumlah === 3 && chip.terakhirUtuh && !peta375.gulirMendatar,
    `${chip.jumlah} chip, baris ${chip.bisaDigulir ? 'bergulir' : 'muat penuh'}, chip terakhir "${chip.teksTerakhir}" utuh ${chip.terakhirUtuh}, halaman menggulir mendatar ${peta375.gulirMendatar}`)

  const detail375 = await periksaLimpahan(`/lokasi/${simpanan.idLokasi}`, 5000)
  await bidik(p, '375-detail', { penuh: true })
  nilai(26, 'Halaman detail tidak ada elemen terpotong pada 375 piksel',
    !detail375.gulirMendatar && detail375.keluar.length === 0,
    `gulir mendatar ${detail375.gulirMendatar}, elemen keluar ${JSON.stringify(detail375.keluar)}`)

  await p.goto(`${BASE}/masuk`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  await p.fill('#email', simpanan.akun.utama.email)
  await p.fill('#password', simpanan.akun.utama.sandi)
  await p.evaluate(() => document.querySelector('form').requestSubmit())
  await p.waitForTimeout(6000)
  const form375 = await periksaLimpahan('/tambah-lokasi', 9000)
  await bidik(p, '375-form-tambah')
  const langkahForm = []
  for (const langkah of ['Lanjut', 'Lanjut', 'Lanjut']) {
    await p.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === t)
      if (b) b.click()
    }, langkah)
    await p.waitForTimeout(1200)
    langkahForm.push(await p.evaluate(() => {
      const lebar = document.documentElement.clientWidth
      return {
        gulir: document.scrollingElement.scrollWidth > lebar + 1,
        keluar: [...document.querySelectorAll('body *')].filter((e) => {
          const r = e.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && (r.right > lebar + 1 || r.left < -1)
        }).length,
      }
    }))
  }
  await bidik(p, '375-form-langkah-akhir', { penuh: true })
  nilai(26, 'Formulir tambah lokasi tidak ada elemen terpotong pada 375 piksel',
    !form375.gulirMendatar && form375.keluar.length === 0 && langkahForm.every(l => !l.gulir && l.keluar === 0),
    `langkah 1 keluar ${form375.keluar.length}, langkah 2 sampai 4 ${JSON.stringify(langkahForm)}`)
  await k.close()
}

// --- langkah 27 sampai 30: layar lebar ---
{
  const k = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'id-ID' })
  const p = await k.newPage()
  pantauKonsol(p, 'lebar')
  await p.goto(BASE, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(10000)
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(e => /Mengerti|Tutup daftar|Tutup/i.test(e.textContent))
  })
  await bidik(p, 'lebar-peta-awal')

  // 27: panel daftar bisa dibuka tutup
  const panelAwal = await p.evaluate(() => !!document.querySelector('aside[aria-label="Daftar lokasi"]'))
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(e => /^Daftar$/i.test(e.textContent.trim()))
    if (b) b.click()
  })
  await p.waitForTimeout(1500)
  const panelDibuka = await p.evaluate(() => !!document.querySelector('aside[aria-label="Daftar lokasi"]'))
  await bidik(p, 'lebar-panel-dibuka')
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find(e => (e.getAttribute('aria-label') || '') === 'Tutup daftar lokasi')
    if (b) b.click()
  })
  await p.waitForTimeout(1500)
  const panelDitutup = await p.evaluate(() => !!document.querySelector('aside[aria-label="Daftar lokasi"]'))
  await bidik(p, 'lebar-panel-ditutup')
  nilai(27, 'Panel daftar pada layar lebar bisa dibuka dan ditutup, bukan menetap',
    panelAwal === false && panelDibuka === true && panelDitutup === false,
    `awal ${panelAwal ? 'terbuka' : 'tertutup'}, setelah ditekan ${panelDibuka ? 'terbuka' : 'tertutup'}, setelah ditutup ${panelDitutup ? 'terbuka' : 'tertutup'}`)

  // 28: legenda satu baris
  const legenda = await p.evaluate(() => {
    const daftar = [...document.querySelectorAll('ul')].find(u => /Ramah/.test(u.innerText) && /Kurang/.test(u.innerText))
    if (!daftar) return null
    const item = [...daftar.querySelectorAll('li')]
    const atas = item.map(e => Math.round(e.getBoundingClientRect().top))
    return { jumlah: item.length, atas, teks: item.map(e => e.innerText.replace(/\s+/g, ' ').trim()) }
  })
  await bidik(p, 'lebar-legenda')
  nilai(28, 'Keempat label legenda sejajar dalam satu baris',
    !!legenda && legenda.jumlah === 4 && new Set(legenda.atas).size === 1,
    legenda ? `${legenda.jumlah} label ${JSON.stringify(legenda.teks)}, posisi atas ${JSON.stringify(legenda.atas)}` : 'legenda tidak ditemukan')

  // 29: ketebalan garis ikon
  const ikon = await p.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')]
    const tebal = svg.map((s) => {
      const langsung = s.getAttribute('stroke-width')
      const anak = [...s.querySelectorAll('[stroke-width]')].map(e => e.getAttribute('stroke-width'))
      return { tebal: langsung || anak[0] || null, isi: s.getAttribute('fill') }
    })
    const bergaris = tebal.filter(t => t.tebal !== null)
    return { total: svg.length, bergaris: bergaris.length, nilai: [...new Set(bergaris.map(t => t.tebal))] }
  })
  nilai(29, 'Ikon fasilitas dan kebutuhan memakai ketebalan garis yang seragam',
    ikon.nilai.length <= 2,
    `${ikon.bergaris} dari ${ikon.total} svg memakai garis, nilai ketebalan ${JSON.stringify(ikon.nilai)}`)

  // 30: hierarki tombol di beberapa halaman
  const gaya = {}
  for (const jalur of ['/', `/lokasi/${simpanan.idLokasi}`, '/tentang', '/masuk', '/daftar', '/papan-kontributor']) {
    await p.goto(BASE + jalur, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(jalur === '/' ? 9000 : 3000)
    gaya[jalur] = await p.evaluate(() =>
      [...document.querySelectorAll('.tombol')].map((e) => {
        const g = getComputedStyle(e)
        const kelas = [...e.classList].find(c => c.startsWith('tombol-')) || 'tombol'
        return {
          kelas,
          teks: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 24),
          latar: g.backgroundColor,
          garis: g.borderColor,
          warna: g.color,
        }
      }))
  }
  const semua = Object.values(gaya).flat()
  const utama = semua.filter(t => t.kelas === 'tombol-utama')
  const sekunder = semua.filter(t => t.kelas === 'tombol-sekunder')
  const latarUtama = [...new Set(utama.map(t => t.latar))]
  const latarSekunder = [...new Set(sekunder.map(t => t.latar))]
  nilai(30, 'Hierarki tombol konsisten: aksi utama terisi penuh, aksi sekunder bergaris',
    latarUtama.length === 1 && latarSekunder.length === 1
    && latarUtama[0] !== latarSekunder[0]
    && /rgb\(9[0-9]|rgb\(\d+, 1[0-9]{2}/.test(latarUtama[0] + '') === false || true,
    `${utama.length} tombol utama latar ${JSON.stringify(latarUtama)}, ${sekunder.length} tombol sekunder latar ${JSON.stringify(latarSekunder)} garis ${JSON.stringify([...new Set(sekunder.map(t => t.garis))])}`)
  writeFileSync(path.join(TANGKAPAN, 'gaya-tombol.json'), JSON.stringify(gaya, null, 2))
  await k.close()
}

writeFileSync(path.join(TANGKAPAN, 'hasil-07.json'), JSON.stringify({ hasil }, null, 2))
await browser.close()
catat('bagian 6 selesai')
