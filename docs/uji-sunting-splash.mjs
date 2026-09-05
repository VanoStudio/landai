// Pemeriksaan tiga penambahan: menyunting lokasi sendiri, penanda lokasi yang
// dilaporkan sudah berubah, dan lapisan pembuka.
//
// Kredensial akun uji dibaca dari lingkungan, tidak pernah ditulis di berkas ini:
//   AKUN_UJI_EMAIL, AKUN_UJI_SANDI

import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const BASIS = 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')
const LOKASI_ORANG_LAIN = '22222222-2222-4222-8222-222222222222'

// Berkas .env dicari lewat lingkungan dulu, lalu dari direktori kerja dan induknya.
// Jangan menulis jalur mutlak milik satu mesin ke dalam berkas yang ikut di-commit.
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

const EMAIL = process.env.AKUN_UJI_EMAIL || env.AKUN_UJI_EMAIL
const SANDI = process.env.AKUN_UJI_SANDI || env.AKUN_UJI_SANDI
const URL_SUPABASE = env.SUPABASE_URL
const KUNCI = env.SUPABASE_KEY

if (!EMAIL || !SANDI) {
  console.error('AKUN_UJI_EMAIL dan AKUN_UJI_SANDI harus tersedia.')
  process.exit(1)
}

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

const bersihkan = page => page.addStyleTag({
  content: '#nuxt-devtools-anchor,#nuxt-devtools-container{display:none!important}',
}).catch(() => {})

// ---------- sesi langsung ke Supabase, untuk menyiapkan dan membersihkan data ----------
const h = { apikey: KUNCI, 'Content-Type': 'application/json' }
const sesi = await (await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: h, body: JSON.stringify({ email: EMAIL, password: SANDI }),
})).json()
const uid = JSON.parse(atob(sesi.access_token.split('.')[1])).sub
const auth = { ...h, Authorization: `Bearer ${sesi.access_token}`, Prefer: 'return=representation' }

// Lokasi uji dibuat sendiri di sini, bukan mengandalkan sisa data putaran sebelumnya,
// lalu dihapus lagi di akhir. Berkas uji yang bergantung pada data yang kebetulan ada
// akan diam-diam berhenti menguji apa pun begitu data itu dibersihkan.
const dibuat = await (await fetch(`${URL_SUPABASE}/rest/v1/locations`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    nama: 'UJI sunting dan splash', kategori: 'lainnya',
    lat: -6.2655, lng: 106.7755, created_by: uid,
  }),
})).json()

const milikSendiri = Array.isArray(dibuat) ? dibuat[0] : null
if (!milikSendiri) {
  console.error('Gagal membuat lokasi uji:', JSON.stringify(dibuat).slice(0, 200))
  process.exit(1)
}

await fetch(`${URL_SUPABASE}/rest/v1/accessibility_checklist`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    location_id: milikSendiri.id,
    ramp_tersedia: true, lebar_pintu_cukup: false, toilet_difabel: false,
    parkir_difabel: false, lift_tersedia_berfungsi: false,
    guiding_block_tersambung: false, tempat_duduk_tersedia: false,
    permukaan_jalan_rata: false, catatan: 'Baris pengujian otomatis.',
  }),
})

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

// ---------- 1. lapisan pembuka ----------
{
  const konteks = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await konteks.newPage()

  // Permintaan data ditahan supaya lapisan ini diuji pada keadaan terburuk: data
  // tidak pernah datang. Batas waktunya harus tetap berlaku.
  await page.route('**/rest/v1/locations*', async (r) => {
    await new Promise(res => setTimeout(res, 30000))
    await r.abort()
  })

  const mulai = Date.now()
  const balasanAwal = await page.goto(BASIS, { waitUntil: 'commit' })
  const htmlAwal = await balasanAwal.text()
  catat('Lapisan pembuka sudah ada di HTML pertama, bukan setelah hidrasi',
    htmlAwal.includes('layar-pembuka') && htmlAwal.includes('pembuka-glif'),
    'dirender server')

  const awal = await page.evaluate(async () => {
    const cari = () => document.querySelector('.layar-pembuka')
    for (let i = 0; i < 60 && !cari(); i++) await new Promise(r => setTimeout(r, 50))
    const el = cari()
    if (!el) return null
    const g = getComputedStyle(el)
    const glif = document.querySelector('.pembuka-glif')
    return {
      latar: g.backgroundColor,
      gradien: g.backgroundImage,
      terlihat: g.visibility === 'visible' && Number(g.opacity) > 0.5,
      adaTulisan: /landai/.test(el.textContent || ''),
      dAwal: glif ? getComputedStyle(glif).d : null,
    }
  })

  catat('Lapisan pembuka tampil sebelum data siap', !!awal && awal.terlihat,
    awal ? `latar ${awal.latar}` : 'tidak ada')
  catat('Latar warna solid tanpa gradien', !!awal && awal.gradien === 'none', awal?.gradien ?? '-')
  catat('Wordmark tampil lengkap dengan tulisannya', !!awal && awal.adaTulisan)

  // Jalur diambil beberapa kali sepanjang animasi. Yang membuktikan peleburan bukan
  // dua sampel yang kebetulan berbeda, melainkan jalur yang terus berubah lalu
  // berhenti pada bentuk akhir.
  const sampel = [awal?.dAwal]
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(280)
    sampel.push(await page.evaluate(() => {
      const g = document.querySelector('.pembuka-glif')
      return g ? getComputedStyle(g).d : null
    }))
  }
  const beda = new Set(sampel.filter(Boolean)).size
  catat('Bentuk anak tangga benar-benar melebur, bukan diam',
    beda >= 3, `${beda} bentuk berbeda dari ${sampel.length} sampel sepanjang animasi`)

  // Ditunggu sampai lewat ambang, lalu diperiksa lapisannya sudah tidak menutupi apa pun.
  await page.waitForTimeout(2000)
  const akhir = await page.evaluate(() => {
    const el = document.querySelector('.layar-pembuka')
    if (!el) return { hilang: true }
    const g = getComputedStyle(el)
    const tengah = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
    return {
      hilang: false,
      visibility: g.visibility,
      opacity: Number(g.opacity),
      menutupi: !!tengah && el.contains(tengah),
    }
  })
  const lama = Date.now() - mulai
  catat('Lapisan pembuka padam walau data tidak pernah datang',
    akhir.hilang || (akhir.visibility === 'hidden' || akhir.opacity < 0.02),
    `diperiksa pada detik ke-${(lama / 1000).toFixed(1)}, visibility ${akhir.visibility ?? '-'}`)
  catat('Lapisan pembuka tidak lagi menghalangi ketukan',
    akhir.hilang || akhir.menutupi === false)

  await page.unroute('**/rest/v1/locations*')
  await page.close()
  await konteks.close()
}

// ---------- 2. masuk, lalu sunting lokasi ----------
{
  const konteks = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await konteks.newPage()

  await page.goto(`${BASIS}/masuk`, { waitUntil: 'domcontentloaded' })
  // Menunggu hidrasi selesai. Menekan kirim sebelum Vue memasang penangannya membuat
  // formulir terkirim sebagai permintaan biasa, dan halaman hanya memuat ulang dirinya.
  await page.waitForTimeout(2500)
  await page.fill('#email', EMAIL)
  await page.fill('#password', SANDI)
  await page.click('button[type=submit]')
  await page.waitForURL(url => !url.pathname.startsWith('/masuk'), { timeout: 25000 })
  await page.waitForTimeout(1500)
  catat('Masuk dengan akun uji berhasil', true, page.url().replace(BASIS, '') || '/')

  // a. Tombol edit muncul di lokasi sendiri.
  await page.goto(`${BASIS}/lokasi/${milikSendiri.id}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const tombolSendiri = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find(e => e.textContent.trim() === 'Edit lokasi')
    return a ? { href: a.getAttribute('href'), sekunder: a.classList.contains('tombol-sekunder') } : null
  })
  catat('Tombol edit tampil pada lokasi milik sendiri',
    !!tombolSendiri && tombolSendiri.href.includes(`ubah=${milikSendiri.id}`) && tombolSendiri.sekunder,
    tombolSendiri ? tombolSendiri.href : 'tidak ada')

  // b. Pada lokasi orang lain, tombolnya berubah menjadi ajakan memperbarui kondisi.
  //    Ini perubahan yang DISENGAJA pada schema-patch-5.sql: memperbarui kondisi
  //    fasilitas dibuka untuk siapa pun yang sudah masuk, sedangkan nama, kategori,
  //    dan koordinat tetap milik kontributor yang menambahkannya.
  await page.goto(`${BASIS}/lokasi/${LOKASI_ORANG_LAIN}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const tombolOrangLain = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')]
      .find(e => /Perbarui kondisi|Edit lokasi/.test(e.textContent.trim()))
    return a ? a.textContent.trim() : null
  })
  catat('Pada lokasi orang lain tombolnya berbunyi perbarui kondisi',
    tombolOrangLain === 'Perbarui kondisi', `terbaca "${tombolOrangLain}"`)

  // c. Formulir edit terisi data yang ada.
  await page.goto(`${BASIS}/tambah-lokasi?ubah=${milikSendiri.id}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await bersihkan(page)
  const isiForm = await page.evaluate(() => {
    const teks = document.body.innerText
    return {
      berjudulEdit: /Mengubah lokasi kamu/.test(teks),
      menyebutTurunStatus: /kembali menjadi belum\s+terverifikasi/i.test(teks),
    }
  })
  // Nama tempat ada di langkah kedua, jadi majukan dulu.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Lanjut')
    b && b.click()
  })
  await page.waitForTimeout(900)
  const namaTerisi = await page.inputValue('#nama-tempat').catch(() => '')

  catat('Formulir edit memakai halaman yang sama dan terisi data yang ada',
    isiForm.berjudulEdit && namaTerisi === milikSendiri.nama,
    `nama terbaca "${namaTerisi}"`)
  catat('Formulir edit menyatakan statusnya akan turun', isiForm.menyebutTurunStatus)

  // Maju sampai langkah terakhir: label tombol simpannya harus berbunyi menyimpan
  // perubahan, bukan menyimpan lokasi baru.
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Lanjut')
      b && b.click()
    })
    await page.waitForTimeout(700)
  }
  const labelSimpan = await page.evaluate(() => {
    const b = [...document.querySelectorAll('footer button')].pop()
    return b ? b.textContent.trim() : null
  })
  catat('Tombol simpan berbunyi menyimpan perubahan', labelSimpan === 'Simpan perubahan',
    `terbaca "${labelSimpan}"`)

  await page.screenshot({ path: join(KELUARAN, 'sunting-form.png') })

  // d. Rute pembaruan lokasi orang lain terbuka, tetapi hanya untuk dua langkah
  //    terakhir. Nama dan titiknya tidak pernah disodorkan.
  await page.goto(`${BASIS}/tambah-lokasi?ubah=${LOKASI_ORANG_LAIN}`,
    { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const terbatas = await page.evaluate(() => ({
    teks: document.body.innerText,
    adaNamaTempat: !!document.querySelector('#nama-tempat'),
    hitungan: (document.body.innerText.match(/Langkah \d+ dari \d+/) || [''])[0],
  }))
  catat('Rute pembaruan lokasi orang lain terbuka, tapi hanya dua langkah',
    terbatas.hitungan === 'Langkah 1 dari 2'
    && !terbatas.adaNamaTempat
    && /Membantu memperbarui data lokasi ini/.test(terbatas.teks),
    terbatas.hitungan)

  await page.screenshot({ path: join(KELUARAN, 'sunting-ditolak.png') })
  await page.close()
  await konteks.close()
}

// ---------- 3. penanda lokasi yang dilaporkan sudah berubah ----------
{
  // Keadaan konfirmasi sebelumnya dicatat supaya bisa dikembalikan persis.
  const sebelum = await (await fetch(
    `${URL_SUPABASE}/rest/v1/confirmations?select=id,is_accurate&location_id=eq.${LOKASI_ORANG_LAIN}&user_id=eq.${uid}`,
    { headers: auth })).json()

  await fetch(`${URL_SUPABASE}/rest/v1/confirmations`, {
    method: 'POST',
    headers: { ...auth, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ location_id: LOKASI_ORANG_LAIN, user_id: uid, is_accurate: false }),
  })

  const konteks = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await konteks.newPage()

  await page.goto(`${BASIS}/lokasi/${LOKASI_ORANG_LAIN}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const detail = await page.evaluate(() => {
    const t = document.body.innerText
    return {
      adaPenanda: /Mungkin sudah berubah/.test(t),
      mengajak: /membantu|perlu diperbarui|sangat membantu/i.test(t),
      menuduh: /salah|palsu|bohong|keliru/i.test(t),
    }
  })
  catat('Halaman detail menampilkan penanda perlu diperbarui', detail.adaPenanda)
  catat('Kalimatnya mengajak memperbarui, bukan menuduh datanya salah',
    detail.mengajak && !detail.menuduh)
  await page.screenshot({ path: join(KELUARAN, 'perlu-diperbarui-detail.png') })

  // Kartu ringkas di peta.
  await page.goto(BASIS, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.maplibregl-canvas')
  await page.waitForTimeout(11000)
  // Penanda yang dicari bisa tersembunyi di dalam kelompok. Kelompok dibuka berulang
  // sampai penandanya muncul, bukan sekadar beberapa kali lalu menyerah.
  let dibuka = false
  for (let i = 0; i < 6; i++) {
    dibuka = await page.evaluate(() => {
      const p = [...document.querySelectorAll('.penanda-skor.maplibregl-marker')]
        .find(e => e.textContent.trim() === '50')
      if (!p) return false
      p.click(); return true
    })
    if (dibuka) break
    const kluster = await page.evaluate(() => {
      const k = document.querySelector('.penanda-kluster.maplibregl-marker')
      if (!k) return false
      k.click(); return true
    })
    if (!kluster) break
    await page.waitForTimeout(2600)
  }
  await page.waitForTimeout(1600)
  const kartu = await page.evaluate(() => {
    const a = document.querySelector('article')
    return a ? /sudah berubah/i.test(a.innerText) : null
  })
  catat('Kartu ringkas menampilkan penanda yang sama', dibuka && kartu === true,
    dibuka ? '' : 'penanda skor 50 tidak ketemu')
  await page.screenshot({ path: join(KELUARAN, 'perlu-diperbarui-kartu.png') })

  await page.close()
  await konteks.close()

  // Kembalikan persis seperti semula.
  await fetch(`${URL_SUPABASE}/rest/v1/confirmations?location_id=eq.${LOKASI_ORANG_LAIN}&user_id=eq.${uid}`,
    { method: 'DELETE', headers: auth })
  if (sebelum.length) {
    await fetch(`${URL_SUPABASE}/rest/v1/confirmations`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ location_id: LOKASI_ORANG_LAIN, user_id: uid, is_accurate: sebelum[0].is_accurate }),
    })
  }
  const sesudah = await (await fetch(
    `${URL_SUPABASE}/rest/v1/confirmations?select=id&location_id=eq.${LOKASI_ORANG_LAIN}&user_id=eq.${uid}`,
    { headers: auth })).json()
  catat('Data konfirmasi uji dikembalikan seperti semula',
    sesudah.length === sebelum.length, `${sebelum.length} sebelum, ${sesudah.length} sesudah`)
}

await browser.close()

await fetch(`${URL_SUPABASE}/rest/v1/locations?id=eq.${milikSendiri.id}`, { method: 'DELETE', headers: auth })
const sisaLokasi = await (await fetch(
  `${URL_SUPABASE}/rest/v1/locations?select=id&nama=like.UJI*`, { headers: auth })).json()
catat('Lokasi uji dibersihkan', (sisaLokasi.length ?? 0) === 0, `${sisaLokasi.length ?? 0} tersisa`)

const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
