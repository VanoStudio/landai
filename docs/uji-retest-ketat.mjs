// Retest ketat atas pelonggaran hak sunting dan deteksi duplikat.
//
// Berbeda dari berkas uji lain di folder ini, hampir seluruh langkah dijalankan lewat
// peramban sungguhan dengan akun yang benar-benar didaftarkan lewat formulir aplikasi,
// bukan lewat antarmuka pemrograman. Yang lewat API hanya dua: pembuktian nilai kolom
// di basis data, dan langkah 4 yang memang harus menembak layanan secara langsung.
//
// Tujuh langkah, masing-masing meninggalkan tangkapan layar sebagai bukti.
//
// Kredensial akun induk dibaca dari lingkungan atau .env. Tiga akun uji baru dibuat
// sebagai turunan beralamat + supaya jelas asalnya dan gampang dibersihkan.

import { chromium } from 'playwright'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const BASIS = process.env.BASIS_UJI || 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar', 'retest')
mkdirSync(KELUARAN, { recursive: true })

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

const URL_ = env.SUPABASE_URL
const KUNCI = env.SUPABASE_KEY
const EMAIL_INDUK = process.env.AKUN_UJI_EMAIL || env.AKUN_UJI_EMAIL
const SANDI = process.env.AKUN_UJI_SANDI || env.AKUN_UJI_SANDI

if (!URL_ || !KUNCI || !EMAIL_INDUK || !SANDI) {
  console.error('SUPABASE_URL, SUPABASE_KEY, AKUN_UJI_EMAIL, dan AKUN_UJI_SANDI wajib ada.')
  process.exit(1)
}

const [lokal, domain] = EMAIL_INDUK.split('@')
const AKUN = {
  A: { email: `${lokal}+retesta@${domain}`, nama: 'Retest A' },
  B: { email: `${lokal}+retestb@${domain}`, nama: 'Retest B' },
  C: { email: `${lokal}+retestc@${domain}`, nama: 'Retest C' },
}

const NAMA_LOKASI = 'UJI RETEST Taman Kota Ketat'
const NAMA_MIRIP = 'Taman Kota Ketat'
const NAMA_BEDA = 'Bengkel Motor Sumber Rezeki'

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

// ---------------------------------------------------------------------------
// Alat bantu API. Dipakai hanya untuk membuktikan isi basis data dan untuk langkah 4.
// ---------------------------------------------------------------------------
const dasar = { apikey: KUNCI, 'Content-Type': 'application/json' }

async function token(email, sandi) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: dasar, body: JSON.stringify({ email, password: sandi }),
  })
  return (await r.json()).access_token ?? null
}

function sesi(tok) {
  const h = { ...dasar, Authorization: `Bearer ${tok}`, Prefer: 'return=representation' }
  return {
    uid: JSON.parse(atob(tok.split('.')[1])).sub,
    async kirim(metode, jalur, badan) {
      const r = await fetch(`${URL_}/rest/v1/${jalur}`, {
        method: metode, headers: h, body: badan === undefined ? undefined : JSON.stringify(badan),
      })
      const teks = await r.text()
      let kode = '-'
      try { kode = JSON.parse(teks).code ?? '-' } catch {}
      let baris = null
      try { baris = JSON.parse(teks) } catch {}
      return {
        status: r.status, kode, teks,
        baris: Array.isArray(baris) ? baris : null,
        tembus: r.status < 300 && Array.isArray(baris) && baris.length > 0,
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Alat bantu peramban.
// ---------------------------------------------------------------------------
const bersihkan = page => page.addStyleTag({
  content: '#nuxt-devtools-anchor,#nuxt-devtools-container{display:none!important}',
}).catch(() => {})

const potret = (page, nama) => page.screenshot({ path: join(KELUARAN, `${nama}.png`), fullPage: false })

const klikTeks = (page, teks, tag = 'button') => page.evaluate(([t, g]) => {
  const el = [...document.querySelectorAll(g)].find(e => e.textContent.trim().includes(t))
  if (!el) return false
  el.click()
  return true
}, [teks, tag])

async function daftarkan(page, akun) {
  await page.goto(`${BASIS}/daftar`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.fill('#nama', akun.nama)
  await page.fill('#email', akun.email)
  await page.fill('#password', SANDI)
  await page.click('button[type=submit]')
  await page.waitForTimeout(3500)

  // Kalau alamatnya sudah pernah dipakai, formulir daftar akan menolak. Jatuh ke masuk.
  if (page.url().includes('/daftar')) {
    await page.goto(`${BASIS}/masuk`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await page.fill('#email', akun.email)
    await page.fill('#password', SANDI)
    await page.click('button[type=submit]')
  }

  await page.waitForURL(u => !u.pathname.startsWith('/daftar') && !u.pathname.startsWith('/masuk'),
    { timeout: 30000 })
  await page.waitForTimeout(1200)
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const buatKonteks = () => browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
  locale: 'id-ID',
  timezoneId: 'Asia/Jakarta',
})

let ID_LOKASI = null
let uidA = null
let uidB = null

try {
  // =========================================================================
  // 1. Akun A mendaftar lewat peramban, lalu menambahkan satu lokasi lengkap.
  // =========================================================================
  console.log('\n1. Akun A mendaftar dan menambahkan lokasi')
  const kA = await buatKonteks()
  const pA = await kA.newPage()

  await daftarkan(pA, AKUN.A)
  catat('Akun A terdaftar lewat formulir aplikasi', !pA.url().includes('/daftar'),
    `mendarat di ${pA.url().replace(BASIS, '') || '/'}`)

  await pA.goto(`${BASIS}/tambah-lokasi`, { waitUntil: 'domcontentloaded' })
  await pA.waitForSelector('.maplibregl-canvas')
  await pA.waitForTimeout(6000)
  await bersihkan(pA)

  // Titik dibiarkan di posisi awal formulir. Itu disengaja: langkah 6 nanti menambah
  // lokasi lain dari titik awal yang sama, jadi jaraknya nol meter dan syarat kedekatan
  // pasti terpenuhi tanpa perlu menggeser pin lewat peta.
  await klikTeks(pA, 'Lanjut')
  await pA.waitForTimeout(1200)

  await pA.fill('#nama-tempat', NAMA_LOKASI)
  await pA.waitForTimeout(400)
  await klikTeks(pA, 'Lanjut')
  await pA.waitForTimeout(900)

  // Daftar periksa: tiga item pertama dinyalakan.
  await pA.evaluate(() => {
    const kotak = [...document.querySelectorAll('input[type=checkbox]')]
    kotak.slice(0, 3).forEach((k) => { if (!k.checked) k.click() })
  })
  await pA.waitForTimeout(500)
  await potret(pA, '1-akun-a-daftar-periksa')
  await klikTeks(pA, 'Lanjut')
  await pA.waitForTimeout(900)

  await pA.fill('#catatan', 'Baris pengujian otomatis retest ketat.')
  await klikTeks(pA, 'Simpan lokasi')
  await pA.waitForURL(u => u.pathname.startsWith('/lokasi/'), { timeout: 30000 })
  await pA.waitForTimeout(2500)
  await bersihkan(pA)

  ID_LOKASI = pA.url().split('/lokasi/')[1]
  await potret(pA, '1-akun-a-detail-lokasi')

  const tokA = await token(AKUN.A.email, SANDI)
  const A = sesi(tokA)
  uidA = A.uid

  const barisAwal = await A.kirim('GET', `locations?select=id,nama,created_by,skor,status,updated_by&id=eq.${ID_LOKASI}`)
  const lokasiAwal = barisAwal.baris?.[0]
  catat('Lokasi tersimpan dengan created_by akun A',
    lokasiAwal?.created_by === A.uid,
    `created_by ${String(lokasiAwal?.created_by).slice(0, 8)} berbanding A ${A.uid.slice(0, 8)}, skor ${lokasiAwal?.skor}`)
  catat('Lokasi baru belum punya jejak pembaruan',
    lokasiAwal?.updated_by === null,
    `updated_by ${lokasiAwal?.updated_by}`)

  // =========================================================================
  // 2. Akun B membuka lokasi milik akun A.
  // =========================================================================
  console.log('\n2. Akun B membuka lokasi milik akun A')
  const kB = await buatKonteks()
  const pB = await kB.newPage()
  await daftarkan(pB, AKUN.B)

  await pB.goto(`${BASIS}/lokasi/${ID_LOKASI}`, { waitUntil: 'domcontentloaded' })
  await pB.waitForTimeout(2600)
  await bersihkan(pB)

  const tombolB = await pB.evaluate(() => {
    const a = [...document.querySelectorAll('a')]
      .find(e => /Perbarui kondisi|Edit lokasi/.test(e.textContent.trim()))
    return a ? { label: a.textContent.trim(), href: a.getAttribute('href') } : null
  })
  catat('Akun B melihat tombol perbarui kondisi, bukan edit lokasi',
    tombolB?.label === 'Perbarui kondisi' && (tombolB?.href || '').includes(`ubah=${ID_LOKASI}`),
    `terbaca "${tombolB?.label}"`)
  await potret(pB, '2-akun-b-detail-lokasi')

  await pB.goto(`${BASIS}/tambah-lokasi?ubah=${ID_LOKASI}`, { waitUntil: 'domcontentloaded' })
  await pB.waitForTimeout(2800)
  await bersihkan(pB)

  const formB = await pB.evaluate(() => {
    const teks = document.body.innerText
    return {
      hitungan: (teks.match(/Langkah \d+ dari \d+/) || [''])[0],
      ruasBilah: document.querySelectorAll('header ol li').length,
      judulMembantu: /Membantu memperbarui data lokasi ini/.test(teks),
      judulPemilik: /Mengubah lokasi Anda/.test(teks),
      adaPetaTitik: !!document.querySelector('.maplibregl-canvas'),
      adaNamaTempat: !!document.querySelector('#nama-tempat'),
      adaPilihanKategori: !!document.querySelector('input[type=radio]'),
      judulLangkah: (document.querySelector('header h1') || {}).innerText || '',
    }
  })

  catat('Judul formulir berbunyi membantu memperbarui, bukan mengubah lokasi Anda',
    formB.judulMembantu && !formB.judulPemilik)
  catat('Langkah titik lokasi tidak ditampilkan untuk akun B',
    !formB.adaPetaTitik, `judul langkah pertama "${formB.judulLangkah}"`)
  catat('Langkah identitas tempat tidak ditampilkan untuk akun B',
    !formB.adaNamaTempat && !formB.adaPilihanKategori)
  catat('Hanya dua langkah yang tersedia untuk akun B',
    formB.hitungan === 'Langkah 1 dari 2' && formB.ruasBilah === 2,
    `${formB.hitungan}, ${formB.ruasBilah} ruas bilah kemajuan`)

  // Dibuktikan juga kedua langkah itu tidak bisa dicapai lewat tombol kembali.
  const bisaMundur = await klikTeks(pB, 'Kembali')
  await pB.waitForTimeout(600)
  const sesudahMundur = await pB.evaluate(() => ({
    adaPeta: !!document.querySelector('.maplibregl-canvas'),
    adaNama: !!document.querySelector('#nama-tempat'),
    hitungan: (document.body.innerText.match(/Langkah \d+ dari \d+/) || [''])[0],
  }))
  catat('Tombol kembali tidak membuka langkah titik maupun identitas',
    !sesudahMundur.adaPeta && !sesudahMundur.adaNama,
    `tombol kembali ${bisaMundur ? 'ada' : 'tidak ada'}, ${sesudahMundur.hitungan}`)
  await potret(pB, '2-akun-b-formulir-dua-langkah')

  // =========================================================================
  // 3. Akun B mengubah daftar periksa dan menyimpan.
  // =========================================================================
  console.log('\n3. Akun B memperbarui daftar periksa')
  const sebelumUbah = await A.kirim('GET',
    `locations?select=skor,status,created_by,updated_by&id=eq.${ID_LOKASI}`)

  await pB.evaluate(() => {
    const kotak = [...document.querySelectorAll('input[type=checkbox]')]
    const mati = kotak.find(k => !k.checked)
    if (mati) mati.click()
  })
  await pB.waitForTimeout(500)
  await klikTeks(pB, 'Lanjut')
  await pB.waitForTimeout(900)
  await klikTeks(pB, 'Simpan perubahan')
  await pB.waitForURL(u => u.pathname.startsWith('/lokasi/'), { timeout: 30000 })
  await pB.waitForTimeout(2800)
  await bersihkan(pB)

  const sesudahUbah = await A.kirim('GET',
    `locations?select=skor,status,created_by,updated_by&id=eq.${ID_LOKASI}`)
  const s0 = sebelumUbah.baris?.[0]
  const s1 = sesudahUbah.baris?.[0]

  const tokB = await token(AKUN.B.email, SANDI)
  const B = sesi(tokB)
  uidB = B.uid

  catat('Perubahan daftar periksa oleh akun B tersimpan',
    s1?.skor !== s0?.skor, `skor ${s0?.skor} menjadi ${s1?.skor}`)
  catat('Status lokasi menjadi belum terverifikasi',
    s1?.status === 'belum_terverifikasi', `status ${s1?.status}`)
  catat('Jejak updated_by mencatat akun B',
    s1?.updated_by === B.uid,
    `updated_by ${String(s1?.updated_by).slice(0, 8)} berbanding B ${B.uid.slice(0, 8)}`)
  catat('Kolom created_by tetap akun A, tidak ikut berubah',
    s1?.created_by === A.uid && s1?.created_by === s0?.created_by)

  const teksDetail = await pB.evaluate(() => document.body.innerText)
  catat('Halaman detail menampilkan ditambahkan akun A',
    new RegExp(`Ditambahkan ${AKUN.A.nama}`).test(teksDetail),
    (teksDetail.match(/Ditambahkan [^.]{0,40}/) || [''])[0])
  catat('Halaman detail menampilkan terakhir diperbarui akun B beserta tanggalnya',
    new RegExp(`Terakhir diperbarui ${AKUN.B.nama} pada \\d`).test(teksDetail),
    (teksDetail.match(/Terakhir diperbarui [^.]{0,50}/) || [''])[0])
  await potret(pB, '3-detail-sesudah-diperbarui-akun-b')

  // =========================================================================
  // 4. Akun B menembak layanan langsung. Ini satu-satunya langkah lewat API.
  // =========================================================================
  console.log('\n4. Akun B menembak layanan langsung dengan tokennya sendiri')
  const sebelumTembak = (await A.kirim('GET',
    `locations?select=nama,kategori,lat,lng,skor,status&id=eq.${ID_LOKASI}`)).baris?.[0]

  const coba = async (label, badan) => {
    const r = await B.kirim('PATCH', `locations?id=eq.${ID_LOKASI}`, badan)
    catat(label, !r.tembus,
      `HTTP ${r.status}, kode ${r.kode}, ${r.baris?.length ?? 0} baris berubah`)
    return r
  }

  await coba('Akun B ditolak mengubah nama lokasi akun A', { nama: 'DIBAJAK OLEH B' })
  await coba('Akun B ditolak mengubah kategori lokasi akun A', { kategori: 'mal' })
  await coba('Akun B ditolak mengubah koordinat lokasi akun A', { lat: -6.1, lng: 106.9 })

  // Kolom yang hak tulisnya dicabut memberi 42501 yang eksplisit, karena penolakannya
  // terjadi pada hak akses kolom, bukan pada penyaringan baris.
  const skorB = await coba('Akun B ditolak menulis skor, dengan kode 42501', { skor: 100 })
  const statusB = await coba('Akun B ditolak menulis status, dengan kode 42501', { status: 'terverifikasi' })
  catat('Penolakan kolom skor dan status benar-benar berkode 42501',
    skorB.kode === '42501' && statusB.kode === '42501',
    `skor ${skorB.kode}, status ${statusB.kode}`)

  const sesudahTembak = (await A.kirim('GET',
    `locations?select=nama,kategori,lat,lng,skor,status&id=eq.${ID_LOKASI}`)).baris?.[0]
  catat('Nama, kategori, koordinat, skor, dan status benar-benar tidak berubah',
    JSON.stringify(sebelumTembak) === JSON.stringify(sesudahTembak),
    `${sesudahTembak?.nama}, ${sesudahTembak?.kategori}, ${sesudahTembak?.lat}`)

  // =========================================================================
  // 5. Ambang tiga konfirmasi, lewat peramban, tiga akun berbeda.
  // =========================================================================
  console.log('\n5. Ambang tiga konfirmasi dengan tiga akun berbeda')
  const kC = await buatKonteks()
  const pC = await kC.newPage()
  await daftarkan(pC, AKUN.C)

  const bacaStatus = async () => (await A.kirim('GET',
    `locations?select=status&id=eq.${ID_LOKASI}`)).baris?.[0]?.status

  const konfirmasi = async (page, label) => {
    await page.goto(`${BASIS}/lokasi/${ID_LOKASI}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2400)
    await bersihkan(page)
    await klikTeks(page, 'Masih akurat')
    await page.waitForTimeout(2000)
    return `${label}:${await bacaStatus()}`
  }

  const urutan = []
  urutan.push(await konfirmasi(pA, 'A'))
  urutan.push(await konfirmasi(pB, 'B'))
  urutan.push(await konfirmasi(pC, 'C'))

  catat('Status naik ke terverifikasi tepat pada konfirmasi ketiga',
    urutan[0].endsWith('belum_terverifikasi')
    && urutan[1].endsWith('belum_terverifikasi')
    && urutan[2].endsWith('terverifikasi'),
    urutan.join('  '))
  await potret(pC, '5-terverifikasi-setelah-tiga-konfirmasi')

  // Satu konfirmasi ditarik lewat peramban: akun C berpindah ke "Sudah berubah".
  await klikTeks(pC, 'Sudah berubah')
  await pC.waitForTimeout(2200)
  const statusTurun = await bacaStatus()
  catat('Status turun lagi begitu satu konfirmasi ditarik',
    statusTurun === 'belum_terverifikasi', `status ${statusTurun}`)
  await potret(pC, '5-turun-setelah-konfirmasi-ditarik')

  // =========================================================================
  // 6. Deteksi kemungkinan duplikat.
  // =========================================================================
  console.log('\n6. Deteksi kemungkinan duplikat')
  const keLangkahDua = async (page) => {
    await page.goto(`${BASIS}/tambah-lokasi`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.maplibregl-canvas')
    await page.waitForTimeout(5000)
    await bersihkan(page)
    await klikTeks(page, 'Lanjut')
    await page.waitForTimeout(1400)
  }

  await keLangkahDua(pC)
  await pC.fill('#nama-tempat', NAMA_MIRIP)
  await pC.waitForTimeout(900)

  const peringatan = await pC.evaluate(() => {
    const sec = [...document.querySelectorAll('section')]
      .find(e => /Mungkin tempat ini sudah ada di peta/.test(e.textContent))
    if (!sec) return null
    return {
      teks: sec.innerText.replace(/\s+/g, ' '),
      href: sec.querySelector('a')?.getAttribute('href') ?? '',
      adaPilihanLanjut: [...sec.querySelectorAll('button')]
        .some(b => /Ini tempat lain, lanjutkan/.test(b.textContent)),
      lanjutTetapAktif: (() => {
        const b = [...document.querySelectorAll('footer button')].find(x => /Lanjut/.test(x.textContent))
        return !!b && !b.disabled
      })(),
    }
  })

  catat('Nama mirip dan titik dalam radius memunculkan peringatan',
    !!peringatan && peringatan.teks.includes(NAMA_LOKASI),
    peringatan ? peringatan.teks.slice(0, 90) : 'peringatan tidak muncul')
  catat('Peringatan menawarkan pilihan memperbarui lokasi yang sudah ada',
    !!peringatan && peringatan.href.includes(`ubah=${ID_LOKASI}`),
    peringatan ? peringatan.href : '-')
  catat('Peringatan tidak memblokir, alur tambah lokasi tetap bisa dilanjutkan',
    !!peringatan && peringatan.adaPilihanLanjut && peringatan.lanjutTetapAktif)
  await potret(pC, '6-peringatan-duplikat-muncul')

  // Titik yang sama, nama yang sama sekali berbeda.
  await pC.fill('#nama-tempat', NAMA_BEDA)
  await pC.waitForTimeout(900)
  const tanpaPeringatan = await pC.evaluate(() =>
    !/Mungkin tempat ini sudah ada di peta/.test(document.body.innerText))
  catat('Titik berdekatan tapi nama jauh berbeda TIDAK memunculkan peringatan',
    tanpaPeringatan)
  await potret(pC, '6-tanpa-peringatan-nama-berbeda')

  // =========================================================================
  // 7. Pembersihan.
  // =========================================================================
  console.log('\n7. Pembersihan data uji')
  const daftarSebelum = await A.kirim('GET', 'locations?select=id,nama,created_by')
  const milikUji = (daftarSebelum.baris ?? []).filter(l => [uidA, uidB].includes(l.created_by))
  console.log(`  sebelum: ${daftarSebelum.baris?.length} lokasi di basis data, ${milikUji.length} milik akun retest`)
  for (const l of milikUji) console.log(`    ${l.id.slice(0, 8)}  ${l.nama}`)

  for (const s of [A, B]) {
    const punya = await s.kirim('GET', `locations?select=id&created_by=eq.${s.uid}`)
    for (const l of punya.baris ?? []) {
      await s.kirim('DELETE', `locations?id=eq.${l.id}`)
    }
  }

  const daftarSesudah = await A.kirim('GET', 'locations?select=id,nama,created_by')
  const sisaUji = (daftarSesudah.baris ?? []).filter(l => [uidA, uidB].includes(l.created_by))
  console.log(`  sesudah: ${daftarSesudah.baris?.length} lokasi di basis data, ${sisaUji.length} milik akun retest`)

  catat('Seluruh lokasi milik akun retest terhapus',
    sisaUji.length === 0, `${milikUji.length} sebelum, ${sisaUji.length} sesudah`)

  const sisaBernama = await A.kirim('GET', 'locations?select=id,nama&nama=like.UJI*')
  catat('Tidak ada lokasi bernama UJI yang tertinggal',
    (sisaBernama.baris?.length ?? 0) === 0,
    (sisaBernama.baris ?? []).map(x => x.nama).join(', ') || 'nihil')

  await pA.goto(BASIS, { waitUntil: 'domcontentloaded' })
  await pA.waitForSelector('.maplibregl-canvas')
  await pA.waitForTimeout(8000)
  await bersihkan(pA)
  await potret(pA, '7-peta-sesudah-pembersihan')

  console.log('\n  Baris akun di auth.users TIDAK bisa dihapus dari sini: itu perlu hak')
  console.log('  service role yang tidak ada di .env. Tiga akun berikut perlu dihapus')
  console.log('  lewat dasbor Authentication, atau lewat SQL Editor:')
  for (const a of Object.values(AKUN)) console.log(`    ${a.email}`)

  await kA.close(); await kB.close(); await kC.close()
}
finally {
  await browser.close()
}

const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
console.log(`Tangkapan layar bukti: ${KELUARAN}`)
if (gagal.length) process.exitCode = 1
