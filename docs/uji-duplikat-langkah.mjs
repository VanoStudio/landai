// Pemeriksaan lapisan aplikasi untuk dua hal:
//
//   1. Gerbang langkah pada formulir. Bukan pemilik hanya melihat daftar periksa dan
//      bukti foto; pemilik tetap melihat keempat langkah. Judulnya pun berbeda.
//   2. Peringatan lokasi kemungkinan duplikat: muncul kalau titiknya dalam empat puluh
//      meter DAN namanya mirip, tidak pernah memblokir, dan dua pilihannya bekerja.
//
// Kredensial dibaca dari lingkungan atau .env, tidak pernah ditulis di berkas ini.

import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const BASIS = 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')

// Titik awal formulir tambah lokasi. Lokasi uji ditaruh persis di sini supaya jaraknya
// nol meter dan syarat kedekatan pasti terpenuhi tanpa perlu menggeser pin lewat peta.
const TITIK_AWAL = { lat: -6.2440, lng: 106.7983 }

const BERKAS_ENV = [process.env.BERKAS_ENV, '.env', '../.env', '../../.env']
  .filter(Boolean).map(x => resolve(x)).find(existsSync)

if (!BERKAS_ENV) {
  console.error('Berkas .env tidak ketemu. Jalankan dari akar repo, atau isi BERKAS_ENV.')
  process.exit(1)
}

const env = Object.fromEntries(readFileSync(BERKAS_ENV, 'utf8')
  .split(/\r?\n/).filter(b => b.includes('=')).map((b) => {
    const i = b.indexOf('=')
    return [b.slice(0, i).trim(), b.slice(i + 1).trim()]
  }))

const URL_ = env.SUPABASE_URL
const EMAIL = process.env.AKUN_UJI_EMAIL || env.AKUN_UJI_EMAIL
const SANDI = process.env.AKUN_UJI_SANDI || env.AKUN_UJI_SANDI
const dasar = { apikey: env.SUPABASE_KEY, 'Content-Type': 'application/json' }

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

async function masuk(email, sandi) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: dasar, body: JSON.stringify({ email, password: sandi }),
  })
  return (await r.json()).access_token ?? null
}

function sesi(token) {
  const h = { ...dasar, Authorization: `Bearer ${token}`, Prefer: 'return=representation' }
  return {
    uid: JSON.parse(atob(token.split('.')[1])).sub,
    async kirim(metode, jalur, badan) {
      const r = await fetch(`${URL_}/rest/v1/${jalur}`, {
        method: metode, headers: h, body: badan === undefined ? undefined : JSON.stringify(badan),
      })
      const t = await r.text()
      let baris = null
      try { baris = JSON.parse(t) } catch {}
      return { status: r.status, teks: t, baris: Array.isArray(baris) ? baris : null }
    },
  }
}

const [lokal, domain] = EMAIL.split('@')
const tokenA = await masuk(EMAIL, SANDI)
const tokenB = await masuk(`${lokal}+ujib@${domain}`, SANDI)

if (!tokenA || !tokenB) {
  console.error('Akun A dan B harus tersedia. Jalankan docs/uji-tulis-bersama.mjs lebih dulu.')
  process.exit(1)
}

const A = sesi(tokenA)
const B = sesi(tokenB)

// ---------- data uji ----------
const buatLokasi = async (s, nama, titik) => {
  const r = await s.kirim('POST', 'locations', {
    nama, kategori: 'lainnya', lat: titik.lat, lng: titik.lng, created_by: s.uid,
  })
  const id = r.baris?.[0]?.id
  if (id) {
    await s.kirim('POST', 'accessibility_checklist', {
      location_id: id,
      ramp_tersedia: true, lebar_pintu_cukup: false, toilet_difabel: false,
      parkir_difabel: false, lift_tersedia_berfungsi: false,
      guiding_block_tersambung: false, tempat_duduk_tersedia: false,
      permukaan_jalan_rata: false,
      catatan: 'Baris pengujian otomatis.',
    })
  }
  return id
}

const ID_KEMBAR = await buatLokasi(A, 'UJI Plaza Blok M', TITIK_AWAL)
const ID_MILIK_B = await buatLokasi(B, 'UJI lokasi milik B', { lat: -6.2712, lng: 106.7712 })
const ID_MILIK_A = await buatLokasi(A, 'UJI lokasi milik A', { lat: -6.2713, lng: 106.7713 })

if (!ID_KEMBAR || !ID_MILIK_B || !ID_MILIK_A) {
  console.error('Gagal menyiapkan lokasi uji.')
  process.exit(1)
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const konteks = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await konteks.newPage()
const galat = []
page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 130)) })

const bersihkan = () => page.addStyleTag({
  content: '#nuxt-devtools-anchor,#nuxt-devtools-container{display:none!important}',
}).catch(() => {})

const klikTeks = (teks, tag = 'button') => page.evaluate(([t, g]) => {
  const el = [...document.querySelectorAll(g)].find(e => e.textContent.trim().includes(t))
  if (!el) return false
  el.click()
  return true
}, [teks, tag])

try {
  // ---------- masuk sebagai A ----------
  await page.goto(`${BASIS}/masuk`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.fill('#email', EMAIL)
  await page.fill('#password', SANDI)
  await page.click('button[type=submit]')
  await page.waitForURL(u => !u.pathname.startsWith('/masuk'), { timeout: 25000 })
  await page.waitForTimeout(1200)
  catat('Masuk sebagai akun A', true)

  // ---------- 1. gerbang langkah: bukan pemilik ----------
  console.log('\nGerbang langkah pada formulir')
  await page.goto(`${BASIS}/tambah-lokasi?ubah=${ID_MILIK_B}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await bersihkan()

  const bukanPemilik = await page.evaluate(() => {
    const teks = document.body.innerText
    return {
      status: document.title,
      hitungan: (teks.match(/Langkah \d+ dari \d+/) || [''])[0],
      ruasBilah: document.querySelectorAll('header ol li').length,
      judulMembantu: /Membantu memperbarui data lokasi ini/.test(teks),
      judulPemilik: /Mengubah lokasi kamu/.test(teks),
      // Langkah pertama yang tampil harus daftar periksa, bukan titik atau identitas.
      adaPetaTitik: !!document.querySelector('.maplibregl-canvas'),
      adaNamaTempat: !!document.querySelector('#nama-tempat'),
      judulLangkah: (document.querySelector('header h1') || {}).innerText || '',
    }
  })

  catat('Bukan pemilik hanya melihat dua langkah',
    bukanPemilik.hitungan === 'Langkah 1 dari 2' && bukanPemilik.ruasBilah === 2,
    `${bukanPemilik.hitungan}, ${bukanPemilik.ruasBilah} ruas bilah kemajuan`)
  catat('Langkah titik dan identitas tempat tidak ditampilkan',
    !bukanPemilik.adaPetaTitik && !bukanPemilik.adaNamaTempat,
    `judul langkah "${bukanPemilik.judulLangkah}"`)
  catat('Judulnya berbunyi membantu memperbarui, bukan mengubah lokasi kamu',
    bukanPemilik.judulMembantu && !bukanPemilik.judulPemilik)
  await page.screenshot({ path: join(KELUARAN, 'langkah-bukan-pemilik.png') })

  // ---------- 2. gerbang langkah: pemilik ----------
  await page.goto(`${BASIS}/tambah-lokasi?ubah=${ID_MILIK_A}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await bersihkan()

  const pemilik = await page.evaluate(() => {
    const teks = document.body.innerText
    return {
      hitungan: (teks.match(/Langkah \d+ dari \d+/) || [''])[0],
      ruasBilah: document.querySelectorAll('header ol li').length,
      judulPemilik: /Mengubah lokasi kamu/.test(teks),
      judulMembantu: /Membantu memperbarui data lokasi ini/.test(teks),
    }
  })
  catat('Pemilik tetap melihat keempat langkah',
    pemilik.hitungan === 'Langkah 1 dari 4' && pemilik.ruasBilah === 4,
    `${pemilik.hitungan}, ${pemilik.ruasBilah} ruas`)
  catat('Judul untuk pemilik berbunyi mengubah lokasi kamu',
    pemilik.judulPemilik && !pemilik.judulMembantu)
  await page.screenshot({ path: join(KELUARAN, 'langkah-pemilik.png') })

  // ---------- 3. peringatan duplikat muncul ----------
  console.log('\nPeringatan lokasi kemungkinan duplikat')
  const keLangkahDua = async () => {
    await page.goto(`${BASIS}/tambah-lokasi`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.maplibregl-canvas')
    await page.waitForTimeout(4200)
    await bersihkan()
    await klikTeks('Lanjut')
    await page.waitForTimeout(1400)
  }

  await keLangkahDua()
  const sebelumKetik = await page.evaluate(() =>
    /Mungkin tempat ini sudah ada di peta/.test(document.body.innerText))
  catat('Belum ada peringatan sebelum nama diketik', sebelumKetik === false)

  await page.fill('#nama-tempat', 'Blok M Plaza')
  await page.waitForTimeout(700)

  const peringatan = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('section')]
      .find(e => /Mungkin tempat ini sudah ada di peta/.test(e.textContent))
    if (!sec) return null
    return {
      teks: sec.innerText.replace(/\s+/g, ' '),
      menyebutNama: /UJI Plaza Blok M/.test(sec.innerText),
      menyebutJarak: /\d+ meter/.test(sec.innerText),
      adaDuaPilihan: !!sec.querySelector('a') && !!sec.querySelector('button'),
      hrefUbah: sec.querySelector('a')?.getAttribute('href') ?? '',
      // Tidak memblokir: tombol lanjut di kaki halaman tetap bisa ditekan.
      lanjutAktif: (() => {
        const b = [...document.querySelectorAll('footer button')].find(x => /Lanjut/.test(x.textContent))
        return !!b && !b.disabled
      })(),
    }
  })

  catat('Peringatan muncul saat titik dekat dan nama mirip', !!peringatan,
    peringatan ? peringatan.teks.slice(0, 80) : 'tidak muncul')
  catat('Peringatan menyebut nama lokasi yang mungkin sama dan jaraknya',
    !!peringatan && peringatan.menyebutNama && peringatan.menyebutJarak)
  catat('Peringatan tidak memblokir alur tambah lokasi',
    !!peringatan && peringatan.lanjutAktif)
  catat('Peringatan menawarkan dua pilihan, perbarui atau lanjutkan',
    !!peringatan && peringatan.adaDuaPilihan && peringatan.hrefUbah.includes(`ubah=${ID_KEMBAR}`),
    peringatan ? peringatan.hrefUbah : '-')
  await page.screenshot({ path: join(KELUARAN, 'peringatan-duplikat.png') })

  // ---------- 4. nama yang jelas berbeda tidak memicu peringatan ----------
  await page.fill('#nama-tempat', 'Warung Kopi Sebelah Jauh')
  await page.waitForTimeout(700)
  const namaBeda = await page.evaluate(() =>
    /Mungkin tempat ini sudah ada di peta/.test(document.body.innerText))
  catat('Nama yang jelas berbeda tidak memicu peringatan', namaBeda === false)

  // ---------- 5. pilihan tetap lanjutkan ----------
  await page.fill('#nama-tempat', 'Blok M Plaza')
  await page.waitForTimeout(700)
  await klikTeks('Ini tempat lain, lanjutkan')
  await page.waitForTimeout(600)
  const sesudahAbaikan = await page.evaluate(() => ({
    peringatanHilang: !/Mungkin tempat ini sudah ada di peta/.test(document.body.innerText),
    masihDiLangkahDua: !!document.querySelector('#nama-tempat'),
  }))
  catat('Pilihan tetap lanjutkan menutup peringatan tanpa keluar dari alur',
    sesudahAbaikan.peringatanHilang && sesudahAbaikan.masihDiLangkahDua)

  // ---------- 6. pilihan perbarui yang sudah ada ----------
  await keLangkahDua()
  await page.fill('#nama-tempat', 'Blok M Plaza')
  await page.waitForTimeout(700)
  await klikTeks('Perbarui yang sudah ada', 'a')
  await page.waitForTimeout(2800)
  const sesudahPindah = await page.evaluate(() => ({
    alamat: location.pathname + location.search,
    teks: document.body.innerText.slice(0, 300),
    hitungan: (document.body.innerText.match(/Langkah \d+ dari \d+/) || [''])[0],
  }))
  catat('Pilihan perbarui membawa ke formulir pembaruan lokasi itu',
    sesudahPindah.alamat.includes(`ubah=${ID_KEMBAR}`)
    && /Mengubah lokasi kamu/.test(sesudahPindah.teks),
    `${sesudahPindah.alamat}, ${sesudahPindah.hitungan}`)

  if (galat.length) console.log('    galat konsol:', galat.join(' | '))
}
finally {
  await page.close()
  await konteks.close()
  await browser.close()

  console.log('\nPembersihan')
  await A.kirim('DELETE', `locations?id=eq.${ID_KEMBAR}`)
  await A.kirim('DELETE', `locations?id=eq.${ID_MILIK_A}`)
  await B.kirim('DELETE', `locations?id=eq.${ID_MILIK_B}`)
  const sisa = await A.kirim('GET', 'locations?select=id,nama&nama=like.UJI*')
  catat('Tidak ada lokasi uji yang tertinggal', (sisa.baris?.length ?? 0) === 0,
    (sisa.baris ?? []).map(x => x.nama).join(', ') || 'nihil')
}

const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
