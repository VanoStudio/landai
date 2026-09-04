// Pemeriksaan putaran polish identitas, tata letak header dan peta, serta pengenalan
// pengunjung pertama. Tidak ada logika penyimpanan data yang berubah, jadi yang
// diperiksa tampilannya, keadaan lokal peramban, dan satu hal fungsional: berpindah
// antara tampilan peta dan daftar di dua ukuran layar.

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

// Tanda merek tidak pernah boleh berdiri sendiri. Untuk tiap tanda yang tampil, harus
// ada tulisan "landai" yang juga tampil di dekatnya, dalam kotak yang sama tingginya.
const CEK_KUNCI_MEREK = `(() => {
  const tanda = [...document.querySelectorAll('svg[data-tanda-landai]')].filter(e => e.offsetParent !== null)
  const hasil = tanda.map(t => {
    const induk = t.parentElement
    const tulisan = [...induk.querySelectorAll('span')]
      .find(e => e.textContent.trim() === 'landai' && e.offsetParent !== null)
    if (!tulisan) return { sendirian: true }
    const a = t.getBoundingClientRect(), b = tulisan.getBoundingClientRect()
    return {
      sendirian: false,
      diKiri: a.right <= b.left + 1,
      jarak: Math.round(b.left - a.right),
      ukuranTanda: Math.round(a.height),
    }
  })
  return { jumlah: tanda.length, hasil }
})()`

const CEK_POTONG = `[...document.querySelectorAll('header *, .tombol')]
  .filter(e => e.offsetParent !== null && e.scrollWidth > e.clientWidth + 2)
  .map(e => (e.innerText || e.tagName).slice(0, 24))`

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const [label, vp] of [
  ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
]) {
  const konteks = await browser.newContext({ ...vp, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })

  // ---------- identitas di seluruh halaman ----------
  for (const [nama, rute, tungguPeta] of [
    ['peta', '/', true],
    ['detail', `/lokasi/${ID_TANPA_FOTO}`, false],
    ['form', '/tambah-lokasi', true],
    ['tentang', '/tentang', false],
    ['papan', '/papan-kontributor', false],
    ['masuk', '/masuk', false],
  ]) {
    const page = await konteks.newPage()
    const galat = []
    page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 130)) })

    await page.goto(BASIS + rute, { waitUntil: 'domcontentloaded' })
    await bersihkan(page)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(tungguPeta ? 9500 : 1600)
    await bersihkan(page)

    const merek = await page.evaluate(CEK_KUNCI_MEREK)
    catat(`${nama} ${label}, tanda selalu berdampingan dengan tulisan`,
      merek.jumlah > 0 && merek.hasil.every(h => !h.sendirian && h.diKiri),
      `${merek.jumlah} tanda, jarak ${merek.hasil.map(h => h.jarak).join('/')}px`)

    const limpah = await page.evaluate(() => ({ vw: innerWidth, scroll: document.documentElement.scrollWidth }))
    catat(`${nama} ${label}, tidak melimpah mendatar`, limpah.scroll <= limpah.vw + 1,
      `${limpah.scroll} berbanding ${limpah.vw}`)

    const potong = await page.evaluate(CEK_POTONG)
    catat(`${nama} ${label}, tidak ada teks terpotong`, potong.length === 0, potong.join(', ') || 'nihil')

    if (galat.length) console.log('    galat konsol:', galat.join(' | '))
    await page.screenshot({ path: join(KELUARAN, `id-${nama}-${label}.png`) })
    await page.close()
  }

  // ---------- header peta: tagline, pemisahan penyaring, legenda, pengenalan ----------
  {
    const page = await konteks.newPage()
    await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
    await bersihkan(page)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForSelector('.maplibregl-canvas')
    await page.waitForTimeout(9500)
    await bersihkan(page)

    // Tagline wajib lebih kecil dan lebih pudar daripada nama merek.
    const tagline = await page.evaluate(() => {
      const nama = [...document.querySelectorAll('header span')]
        .find(e => e.textContent.trim() === 'landai' && e.offsetParent !== null)
      const tag = [...document.querySelectorAll('header span')]
        .find(e => e.textContent.trim() === 'Peta aksesibilitas difabel')
      if (!nama) return null
      const bacaUkuran = e => parseFloat(getComputedStyle(e).fontSize)
      // Tailwind 4 mengembalikan warna dalam oklch, jadi tidak bisa dibaca sebagai
      // tiga angka RGB. Dinormalkan lewat kanvas, lalu diukur sebagai rasio kontras
      // terhadap latar putih: "lebih pudar" berarti kontrasnya lebih rendah, bukan
      // sekadar lebih terang.
      // Warna dibaca kembali sebagai piksel, bukan dari string fillStyle: Chromium
      // mengembalikan oklch dan color(srgb ...) apa adanya, dan keduanya tidak bisa
      // diurai sebagai heksadesimal.
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
      const kontras = w => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = w
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b] = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => v / 255)
        const f = c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
        const L = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        return Math.round((1.05 / (L + 0.05)) * 100) / 100
      }
      return {
        namaUkuran: bacaUkuran(nama),
        tampil: !!tag && tag.offsetParent !== null,
        tagUkuran: tag ? bacaUkuran(tag) : null,
        namaTerang: kontras(getComputedStyle(nama).color),
        tagTerang: tag ? kontras(getComputedStyle(tag).color) : null,
        diBawah: tag ? tag.getBoundingClientRect().top >= nama.getBoundingClientRect().bottom - 1 : null,
      }
    })
    // Di layar tersempit tagline sengaja disembunyikan; yang diuji di sana hanya
    // bahwa ia tidak ikut memakan ruang.
    catat(`Tagline lebih kecil dan lebih pudar daripada nama merek (${label})`,
      !!tagline && (!tagline.tampil
        || (tagline.tagUkuran < tagline.namaUkuran && tagline.tagTerang < tagline.namaTerang && tagline.diBawah)),
      tagline
        ? (tagline.tampil
            ? `${tagline.tagUkuran}px berbanding ${tagline.namaUkuran}px, kontras ${tagline.tagTerang} berbanding ${tagline.namaTerang} terhadap putih`
            : 'disembunyikan di layar sempit')
        : 'nama merek tidak ada')

    // Penyaring dan pemindah tampilan wajib berada di baris yang berbeda.
    const pisah = await page.evaluate(() => {
      const tab = document.querySelector('[role=tablist][aria-label="Pindah tampilan"]')
      const chip = document.querySelector('[aria-pressed]')
      if (!tab || !chip) return null
      const header = document.querySelector('header')
      return {
        tabDiHeader: header.contains(tab),
        chipDiHeader: header.contains(chip),
        beda: Math.abs(tab.getBoundingClientRect().top - chip.getBoundingClientRect().top) > 8,
        dekatMasuk: (() => {
          const masuk = [...document.querySelectorAll('header a, header button')]
            .find(e => /Masuk|Keluar/.test(e.textContent))
          if (!masuk) return null
          return Math.round(Math.abs(masuk.getBoundingClientRect().top - tab.getBoundingClientRect().top))
        })(),
      }
    })
    catat(`Pemindah tampilan pindah ke header, terpisah dari chip penyaring (${label})`,
      !!pisah && pisah.tabDiHeader && !pisah.chipDiHeader && pisah.beda,
      pisah ? `sebaris dengan tombol masuk, beda ${pisah.dekatMasuk}px` : 'kontrol tidak ada')

    // Legenda: empat keterangan sejajar satu baris.
    const legenda = await page.evaluate(() => {
      const li = [...document.querySelectorAll('ul li')]
        .filter(e => /Ramah|Sedang|Kurang|Belum verifikasi/.test(e.textContent) && e.offsetParent !== null)
      if (li.length < 4) return { jumlah: li.length }
      const atas = li.map(e => Math.round(e.getBoundingClientRect().top))
      return {
        jumlah: li.length,
        satuBaris: new Set(atas).size === 1,
        teks: li.map(e => e.textContent.trim()),
      }
    })
    catat(`Legenda memuat empat keterangan (${label})`, legenda.jumlah === 4,
      (legenda.teks || []).join(' | '))
    if (label === 'desktop') {
      catat('Keempat keterangan legenda sejajar satu baris (desktop)', legenda.satuBaris === true)
    }

    // Kartu pengenalan: tampil, tidak menutupi peta, dan tidak menghalangi ketukan.
    const kenal = await page.evaluate(() => {
      const kartu = [...document.querySelectorAll('section')]
        .find(e => /Baru pertama ke sini/.test(e.textContent))
      if (!kartu) return null
      const k = kartu.getBoundingClientRect()
      const wadah = kartu.parentElement
      const luasLayar = innerWidth * innerHeight
      // Titik di luar kartu, di tengah peta, harus mengenai kanvas peta, bukan wadah.
      const tengah = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight * 0.72))
      return {
        modal: k.width >= innerWidth - 4 && k.height >= innerHeight - 4,
        porsi: Math.round(k.width * k.height / luasLayar * 100),
        wadahTembus: getComputedStyle(wadah).pointerEvents === 'none',
        adaTutup: !!kartu.querySelector('button[aria-label="Tutup pengenalan"]'),
        kalimat: (kartu.querySelector('p')?.textContent || '').trim().split(/\.\s+/).filter(Boolean).length,
        petaTerjangkau: !!tengah && !kartu.contains(tengah),
      }
    })
    catat(`Kartu pengenalan tampil di sudut, bukan modal layar penuh (${label})`,
      !!kenal && !kenal.modal && kenal.porsi < 25 && kenal.adaTutup && kenal.wadahTembus && kenal.petaTerjangkau,
      kenal ? `${kenal.porsi}% luas layar, ${kenal.kalimat} kalimat, peta di belakang tetap terjangkau` : 'kartu tidak ada')

    await page.screenshot({ path: join(KELUARAN, `id-header-${label}.png`) })

    // Ditutup sekali, lalu muat ulang: tidak boleh muncul lagi.
    await page.click('button[aria-label="Tutup pengenalan"]')
    await page.waitForTimeout(300)
    const sesudahTutup = await page.evaluate(() =>
      ![...document.querySelectorAll('section')].some(e => /Baru pertama ke sini/.test(e.textContent)))
    const kunci = await page.evaluate(() => localStorage.getItem('landai:pengenalan-ditutup'))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    const sesudahMuatUlang = await page.evaluate(() =>
      ![...document.querySelectorAll('section')].some(e => /Baru pertama ke sini/.test(e.textContent)))
    catat(`Pengenalan tidak muncul lagi setelah ditutup (${label})`,
      sesudahTutup && kunci === '1' && sesudahMuatUlang,
      `kunci penyimpanan lokal ${kunci}`)

    await page.close()
  }

  // ---------- berpindah tampilan peta dan daftar ----------
  {
    const page = await konteks.newPage()
    const galat = []
    page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 130)) })

    await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
    await bersihkan(page)
    await page.waitForSelector('.maplibregl-canvas')
    await page.waitForTimeout(9500)
    await bersihkan(page)

    const ukur = () => page.evaluate(() => {
      const k = document.querySelector('.maplibregl-canvas')
      const panel = document.querySelector('aside[aria-label="Daftar lokasi"]')
      return {
        petaLebar: k ? Math.round(k.getBoundingClientRect().width) : null,
        panelAda: !!panel,
        panelLebar: panel ? Math.round(panel.getBoundingClientRect().width) : null,
      }
    })

    const awal = await ukur()
    catat(`Peta tampil penuh dan panel daftar tertutup secara bawaan (${label})`,
      !awal.panelAda && awal.petaLebar >= vp.viewport.width - 2,
      `lebar peta ${awal.petaLebar} dari ${vp.viewport.width}px`)

    await page.click('[role=tablist][aria-label="Pindah tampilan"] button:nth-child(2)')
    await page.waitForTimeout(700)
    const dibuka = await ukur()
    catat(`Panel daftar terbuka lewat pemindah tampilan (${label})`,
      dibuka.panelAda && dibuka.panelLebar > 200,
      `lebar panel ${dibuka.panelLebar}px`)
    catat(`Lebar kanvas peta tidak berubah saat panel dibuka (${label})`,
      dibuka.petaLebar === awal.petaLebar,
      `${awal.petaLebar} lalu ${dibuka.petaLebar}`)

    const isiPanel = await page.evaluate(() => {
      const panel = document.querySelector('aside[aria-label="Daftar lokasi"]')
      return {
        butir: panel ? panel.querySelectorAll('li').length : 0,
        adaTutup: !!panel?.querySelector('button[aria-label="Tutup daftar lokasi"]'),
      }
    })
    catat(`Panel memuat butir lokasi dan tombol tutup (${label})`,
      isiPanel.adaTutup && isiPanel.butir > 0, `${isiPanel.butir} butir`)

    await page.screenshot({ path: join(KELUARAN, `id-panel-${label}.png`) })

    await page.click('button[aria-label="Tutup daftar lokasi"]')
    await page.waitForTimeout(700)
    const ditutup = await ukur()
    catat(`Panel bisa ditutup kembali dan peta utuh (${label})`,
      !ditutup.panelAda && ditutup.petaLebar === awal.petaLebar,
      `lebar peta ${ditutup.petaLebar}`)

    if (galat.length) console.log('    galat konsol:', galat.join(' | '))
    await page.close()
  }

  // ---------- ikon kebutuhan satu keluarga ----------
  {
    const page = await konteks.newPage()
    await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(2000)
    const ikon = await page.evaluate(() => {
      const svg = [...document.querySelectorAll('[aria-pressed] svg')]
      return {
        jumlah: svg.length,
        tebal: [...new Set(svg.map(e => e.getAttribute('stroke-width')))],
        kotak: [...new Set(svg.map(e => e.getAttribute('viewBox')))],
        tutup: [...new Set(svg.map(e => e.getAttribute('stroke-linecap')))],
        jariKepala: [...new Set(svg.flatMap(e =>
          [...e.querySelectorAll('circle[fill="currentColor"]')].map(c => c.getAttribute('r'))))],
      }
    })
    catat(`Ikon kebutuhan satu set: tebal, kotak, dan ujung garis seragam (${label})`,
      ikon.jumlah === 3 && ikon.tebal.length === 1 && ikon.kotak.length === 1
      && ikon.tutup.length === 1 && ikon.jariKepala.length === 1,
      `tebal ${ikon.tebal.join(',')}, kotak ${ikon.kotak.join(',')}, jari-jari titik ${ikon.jariKepala.join(',')}`)
    await page.close()
  }

  // ---------- keadaan foto kosong ----------
  {
    const page = await konteks.newPage()
    await page.goto(`${BASIS}/lokasi/${ID_TANPA_FOTO}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1800)
    const kosong = await page.evaluate(() => {
      const svgKamera = [...document.querySelectorAll('svg')]
        .filter(e => e.querySelector('circle') && /M3 8.5/.test(e.innerHTML))
      const ramah = /Belum ada foto di sini/.test(document.body.innerText)
      return { ikon: svgKamera.length, ramah }
    })
    catat(`Foto kosong memakai ikon kamera dan teks ramah (${label})`,
      kosong.ikon >= 1 && kosong.ramah, `${kosong.ikon} ikon kamera`)
    await page.close()
  }

  // ---------- hierarki tombol ----------
  {
    const page = await konteks.newPage()
    await page.goto(`${BASIS}/masuk`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(1400)
    const tombol = await page.evaluate(() => {
      const semua = [...document.querySelectorAll('.tombol')].filter(e => e.offsetParent !== null)
      const utama = semua.filter(e => e.classList.contains('tombol-utama'))
      return {
        jumlah: semua.length,
        tinggi: [...new Set(semua.map(e => Math.round(e.getBoundingClientRect().height)))],
        utama: utama.length,
        warnaUtama: [...new Set(utama.map(e => getComputedStyle(e).backgroundColor))],
      }
    })
    catat(`Tinggi tombol seragam minimal 44px (${label})`,
      tombol.jumlah > 0 && tombol.tinggi.every(h => h >= 44), tombol.tinggi.join(' '))
    catat(`Hanya satu aksi utama di layar masuk (${label})`,
      tombol.utama === 1, `${tombol.utama} aksi utama, ${tombol.jumlah} tombol`)
    await page.close()
  }

  await konteks.close()
}

// ---------- aset merek ----------
{
  const konteks = await browser.newContext({ viewport: { width: 800, height: 600 } })
  const page = await konteks.newPage()
  await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
  const kepala = await page.evaluate(() => ({
    ikonSvg: document.querySelector('link[rel="icon"][type="image/svg+xml"]')?.getAttribute('href'),
    ikonPng: document.querySelector('link[rel="icon"][type="image/png"]')?.getAttribute('href'),
    apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
    ogGambar: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    ogJudul: document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
    ogKeterangan: document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
  }))
  catat('Favicon menunjuk ke tanda SVG yang sama',
    kepala.ikonSvg === '/tanda.svg' && kepala.ikonPng === '/favicon-32.png',
    `${kepala.ikonSvg}, ${kepala.ikonPng}, ${kepala.apple}`)
  catat('Pratinjau tautan lengkap dengan judul dan keterangan',
    /\/og\.png$/.test(kepala.ogGambar || '') && (kepala.ogJudul || '').includes('landai')
    && (kepala.ogKeterangan || '').length > 40,
    `${kepala.ogJudul}`)

  for (const [nama, alamat] of [['tanda.svg', '/tanda.svg'], ['og.png', '/og.png'], ['favicon-32.png', '/favicon-32.png']]) {
    const r = await page.request.get(BASIS + alamat)
    catat(`Berkas ${nama} tersaji`, r.status() === 200,
      `${r.status()}, ${(await r.body()).length} bita`)
  }

  // Tanda pada berkas SVG harus sama persis dengan tanda pada komponen.
  const svg = await (await page.request.get(`${BASIS}/tanda.svg`)).text()
  catat('Berkas tanda.svg memakai bentuk anak tangga yang sama',
    svg.includes('M5 25 L5 22.6') && svg.includes('L27 8.4'), 'jalur cocok')

  await page.close()
  await konteks.close()
}

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
