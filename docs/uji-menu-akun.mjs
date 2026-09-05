// Menu akun di header peta.
//
// Yang dijaga berkas ini bukan bentuknya, melainkan janjinya: pengguna yang sudah masuk
// bisa menjangkau halaman akun dan papan kontributor DARI PETA, di lebar layar mana pun.
// Sebelum menu ini ada, terukur di 414px, kedua halaman itu tidak punya jalan sama
// sekali dari peta, dan hanya bisa dicapai lewat ikon tentang lalu menggulir.
//
// Diperiksa di 375, 390, dan lebar desktop, karena justru layar sempit yang dulu
// kehilangan jalannya.

import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const BASIS = process.env.BASIS_UJI || 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')

const BERKAS_ENV = [process.env.BERKAS_ENV, '.env', '../.env', '../../.env']
  .filter(Boolean).map(x => resolve(x)).find(existsSync)

if (!BERKAS_ENV) {
  console.error('Berkas .env tidak ketemu. Jalankan dari akar repo, atau isi BERKAS_ENV.')
  process.exit(1)
}

const env = Object.fromEntries(readFileSync(BERKAS_ENV, 'utf8')
  .split(String.fromCharCode(10)).map(b => b.trim()).filter(b => b.includes('='))
  .map((b) => {
    const i = b.indexOf('=')
    return [b.slice(0, i).trim(), b.slice(i + 1).trim()]
  }))

const EMAIL = process.env.AKUN_UJI_EMAIL || env.AKUN_UJI_EMAIL
const SANDI = process.env.AKUN_UJI_SANDI || env.AKUN_UJI_SANDI

const PEMICU = 'button.menu-akun-pemicu'
const PANEL = '[role=menu][aria-label="Menu akun"]'

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const bersihkan = page => page.addStyleTag({
  content: '#nuxt-devtools-anchor,#nuxt-devtools-container{display:none!important}',
}).catch(() => {})

// ---------- tanpa akun, menu tidak boleh ada ----------
{
  const konteks = await browser.newContext({ viewport: { width: 375, height: 667 } })
  const page = await konteks.newPage()
  await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const tamu = await page.evaluate(s => ({
    adaMenu: !!document.querySelector(s),
    adaMasuk: [...document.querySelectorAll('header a')].some(a => a.textContent.trim() === 'Masuk'),
  }), PEMICU)
  catat('Pengunjung tanpa akun tidak melihat menu akun, hanya tombol masuk',
    !tamu.adaMenu && tamu.adaMasuk)
  await page.close(); await konteks.close()
}

for (const [label, w, h] of [['375', 375, 667], ['390', 390, 844], ['desktop', 1280, 900]]) {
  const konteks = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    isMobile: w < 768,
    hasTouch: w < 768,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
  })
  const page = await konteks.newPage()

  await page.goto(`${BASIS}/masuk`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.fill('#email', EMAIL)
  await page.fill('#password', SANDI)
  await page.click('button[type=submit]')
  await page.waitForURL(u => !u.pathname.startsWith('/masuk'), { timeout: 25000 })
  await page.waitForSelector('.maplibregl-canvas')
  await page.waitForTimeout(6000)
  await bersihkan(page)

  // ---------- tombol ada di setiap lebar ----------
  const tombol = await page.evaluate((s) => {
    const b = document.querySelector(s)
    if (!b || b.offsetParent === null) return null
    const r = b.getBoundingClientRect()
    return {
      lebar: Math.round(r.width), tinggi: Math.round(r.height),
      label: b.getAttribute('aria-label') || '',
      terbuka: b.getAttribute('aria-expanded'),
      inisial: b.textContent.trim(),
    }
  }, PEMICU)

  catat(`Menu akun terlihat di header peta (${label})`, !!tombol,
    tombol ? `inisial "${tombol.inisial}", ${tombol.lebar}x${tombol.tinggi}` : 'tidak ada')
  catat(`Sasaran sentuh tombol menu minimal 44px (${label})`,
    !!tombol && tombol.lebar >= 44 && tombol.tinggi >= 44)
  catat(`Label tombol menyebut sedang masuk sebagai siapa (${label})`,
    !!tombol && /Menu akun, masuk sebagai \S/.test(tombol.label), tombol?.label)
  catat(`Keadaan terbuka diumumkan lewat aria-expanded (${label})`,
    tombol?.terbuka === 'false')

  // ---------- membuka menu ----------
  await page.click(PEMICU)
  await page.waitForTimeout(500)

  const isi = await page.evaluate(([p, w, h]) => {
    const el = document.querySelector(p)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const butir = [...el.querySelectorAll('[role=menuitem]')].map(b => ({
      teks: b.textContent.trim().replace(/\s+/g, ' '),
      href: b.getAttribute('href') || '',
      tinggi: Math.round(b.getBoundingClientRect().height),
    }))
    return {
      teks: el.innerText.replace(/\s+/g, ' '),
      butir,
      // Panel dipasang fixed justru supaya tidak terpotong wadah peta yang
      // memakai overflow-hidden. Diperiksa benar-benar utuh di dalam layar.
      utuhDiLayar: r.left >= 0 && r.right <= w + 1 && r.top >= 0 && r.bottom <= h + 1,
      kotak: `${Math.round(r.left)},${Math.round(r.top)} sampai ${Math.round(r.right)},${Math.round(r.bottom)}`,
    }
  }, [PANEL, w, h])

  catat(`Menu terbuka dan tidak terpotong wadah peta (${label})`,
    !!isi && isi.utuhDiLayar, isi ? isi.kotak : 'panel tidak muncul')
  catat(`Menu memuat ketiga aksi akun (${label})`,
    !!isi && isi.butir.length === 3
    && isi.butir.some(b => /Ubah nama tampilan/.test(b.teks) && b.href === '/akun')
    && isi.butir.some(b => /Kontribusi saya/.test(b.teks) && b.href === '/papan-kontributor')
    && isi.butir.some(b => /Keluar/.test(b.teks)),
    (isi?.butir ?? []).map(b => b.teks).join(' | '))
  catat(`Setiap butir menu setinggi minimal 44px (${label})`,
    !!isi && isi.butir.every(b => b.tinggi >= 44),
    (isi?.butir ?? []).map(b => b.tinggi).join('/'))
  catat(`Menu menyebutkan nama dan email yang sedang masuk (${label})`,
    !!isi && isi.teks.includes('@'), (isi?.teks ?? '').slice(0, 60))

  const limpah = await page.evaluate(() => ({
    vw: innerWidth, scroll: document.documentElement.scrollWidth,
  }))
  catat(`Membuka menu tidak membuat halaman melimpah mendatar (${label})`,
    limpah.scroll <= limpah.vw + 1, `${limpah.scroll} berbanding ${limpah.vw}`)

  await page.screenshot({ path: join(KELUARAN, `menu-akun-${label}.png`) })

  // ---------- Escape menutup dan mengembalikan fokus ----------
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const sesudahEsc = await page.evaluate(([p, s]) => ({
    tertutup: !document.querySelector(p),
    fokusKembali: document.activeElement === document.querySelector(s),
  }), [PANEL, PEMICU])
  catat(`Escape menutup menu dan mengembalikan fokus ke tombolnya (${label})`,
    sesudahEsc.tertutup && sesudahEsc.fokusKembali,
    `tertutup ${sesudahEsc.tertutup}, fokus kembali ${sesudahEsc.fokusKembali}`)

  // ---------- klik di luar menutup ----------
  await page.click(PEMICU)
  await page.waitForTimeout(400)
  await page.mouse.click(Math.round(w / 2), Math.round(h * 0.75))
  await page.waitForTimeout(400)
  const sesudahKlikLuar = await page.evaluate(p => !document.querySelector(p), PANEL)
  catat(`Menekan di luar menu ikut menutupnya (${label})`, sesudahKlikLuar)

  // ---------- jalan ke papan kontributor, dan baris sendiri ditandai ----------
  await page.click(PEMICU)
  await page.waitForTimeout(400)
  await page.evaluate((p) => {
    const a = [...document.querySelectorAll(`${p} [role=menuitem]`)]
      .find(e => /Kontribusi saya/.test(e.textContent))
    a && a.click()
  }, PANEL)
  await page.waitForURL(u => u.pathname === '/papan-kontributor', { timeout: 15000 })
  await page.waitForTimeout(2500)

  const papan = await page.evaluate(() => ({
    adaBarisSendiri: [...document.querySelectorAll('ol > li')]
      .some(li => /Anda/.test(li.textContent)),
    adaBilah: document.querySelectorAll('[role=progressbar]').length,
  }))
  catat(`Papan kontributor dijangkau dari menu, baris sendiri ditandai (${label})`,
    papan.adaBarisSendiri && papan.adaBilah > 0,
    `${papan.adaBilah} bilah kemajuan`)
  if (label === 'desktop') {
    await page.screenshot({ path: join(KELUARAN, 'menu-akun-papan-ditandai.png') })
  }

  // ---------- jalan ke halaman akun ----------
  await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.maplibregl-canvas')
  await page.waitForTimeout(5000)
  await page.click(PEMICU)
  await page.waitForTimeout(400)
  await page.evaluate((p) => {
    const a = [...document.querySelectorAll(`${p} [role=menuitem]`)]
      .find(e => /Ubah nama tampilan/.test(e.textContent))
    a && a.click()
  }, PANEL)
  await page.waitForURL(u => u.pathname === '/akun', { timeout: 15000 })
  await page.waitForTimeout(2000)
  const diAkun = await page.evaluate(() => !!document.querySelector('#nama-tampilan'))
  catat(`Halaman akun dijangkau dari menu (${label})`, diAkun)

  // ---------- keluar lewat menu ----------
  await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.maplibregl-canvas')
  await page.waitForTimeout(5000)
  await page.click(PEMICU)
  await page.waitForTimeout(400)
  await page.evaluate((p) => {
    const b = [...document.querySelectorAll(`${p} [role=menuitem]`)]
      .find(e => /Keluar/.test(e.textContent))
    b && b.click()
  }, PANEL)
  await page.waitForTimeout(3000)
  const sesudahKeluar = await page.evaluate(s => ({
    menuHilang: !document.querySelector(s),
    adaMasuk: [...document.querySelectorAll('header a')].some(a => a.textContent.trim() === 'Masuk'),
  }), PEMICU)
  catat(`Keluar lewat menu mengembalikan ke mode lihat (${label})`,
    sesudahKeluar.menuHilang && sesudahKeluar.adaMasuk)

  await page.close()
  await konteks.close()
}

await browser.close()
const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
