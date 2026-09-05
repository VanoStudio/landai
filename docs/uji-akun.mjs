// Halaman ubah nama tampilan. Diuji lewat peramban sungguhan dengan akun uji nyata.
//
// Nama ini bukan urusan kosmetik: ia tertulis pada "Ditambahkan ... " di halaman detail
// dan pada papan kontributor, jadi dibaca siapa pun yang membuka peta. Karena itu yang
// diperiksa bukan cuma kolomnya berubah, tetapi perubahannya benar-benar muncul di
// kedua tempat itu.

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

const URL_ = env.SUPABASE_URL
const EMAIL = process.env.AKUN_UJI_EMAIL || env.AKUN_UJI_EMAIL
const SANDI = process.env.AKUN_UJI_SANDI || env.AKUN_UJI_SANDI
const dasar = { apikey: env.SUPABASE_KEY, 'Content-Type': 'application/json' }

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

const j = await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: dasar, body: JSON.stringify({ email: EMAIL, password: SANDI }),
})).json()

if (!j.access_token) {
  console.error('Gagal masuk dengan akun uji.')
  process.exit(1)
}

const uid = JSON.parse(atob(j.access_token.split('.')[1])).sub
const auth = { ...dasar, Authorization: `Bearer ${j.access_token}`, Prefer: 'return=representation' }

const bacaNama = async () => (await (await fetch(
  `${URL_}/rest/v1/profiles?select=nama&id=eq.${uid}`, { headers: auth })).json())[0]?.nama

const NAMA_ASLI = await bacaNama()
const NAMA_BARU = `Uji Nama ${Date.now().toString().slice(-5)}`

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

// Lokasi uji supaya perubahan nama bisa dilihat pada halaman detail dan papan.
const dibuat = await (await fetch(`${URL_}/rest/v1/locations`, {
  method: 'POST', headers: auth,
  body: JSON.stringify({
    nama: 'UJI halaman akun', kategori: 'lainnya',
    lat: -6.2733, lng: 106.7733, created_by: uid,
  }),
})).json()
const ID = Array.isArray(dibuat) ? dibuat[0]?.id : null

try {
  const konteks = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'id-ID' })
  const page = await konteks.newPage()
  const bersihkan = () => page.addStyleTag({
    content: '#nuxt-devtools-anchor,#nuxt-devtools-container{display:none!important}',
  }).catch(() => {})

  // ---------- penjaga rute ----------
  const tanpaAkun = await browser.newContext()
  const pTamu = await tanpaAkun.newPage()
  const balasan = await pTamu.goto(`${BASIS}/akun`, { waitUntil: 'domcontentloaded' })
  await pTamu.waitForTimeout(1500)
  catat('Halaman akun dijaga, pengunjung tanpa akun dialihkan ke masuk',
    pTamu.url().includes('/masuk'), `mendarat di ${pTamu.url().replace(BASIS, '')}`)
  await pTamu.close(); await tanpaAkun.close()

  // ---------- masuk ----------
  await page.goto(`${BASIS}/masuk`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.fill('#email', EMAIL)
  await page.fill('#password', SANDI)
  await page.click('button[type=submit]')
  await page.waitForURL(u => !u.pathname.startsWith('/masuk'), { timeout: 25000 })
  await page.waitForTimeout(1500)

  // ---------- tautan menuju halaman akun ----------
  // Jalan ke halaman akun sekarang lewat menu akun, bukan ikon yang berdiri sendiri.
  const lewatMenu = await page.evaluate(async () => {
    const pemicu = document.querySelector('button.menu-akun-pemicu')
    if (!pemicu) return { adaPemicu: false }
    pemicu.click()
    await new Promise(r => setTimeout(r, 400))
    const a = [...document.querySelectorAll('[role=menu] [role=menuitem]')]
      .find(e => /Ubah nama tampilan/.test(e.textContent))
    return { adaPemicu: true, adaTautan: !!a, href: a?.getAttribute('href') ?? '' }
  })
  catat('Halaman akun dijangkau lewat menu akun di header peta',
    lewatMenu.adaPemicu && lewatMenu.adaTautan && lewatMenu.href === '/akun',
    lewatMenu.href || 'tidak ada')

  await page.goto(`${BASIS}/tentang`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const tautanTentang = await page.evaluate(() =>
    [...document.querySelectorAll('a')].some(a => /Ubah nama tampilan/.test(a.textContent)))
  catat('Halaman tentang menawarkan jalan ke halaman akun', tautanTentang)

  // ---------- isi halaman akun ----------
  await page.goto(`${BASIS}/akun`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await bersihkan()

  const isi = await page.evaluate(() => {
    const n = document.querySelector('#nama-tampilan')
    const s = document.querySelector('#surel')
    const tombol = [...document.querySelectorAll('button[type=submit]')][0]
    return {
      namaTerisi: n ? n.value : null,
      surelTerisi: s ? s.value : null,
      surelTerkunci: s ? (s.readOnly || s.disabled) : null,
      simpanMatiSaatBelumBerubah: tombol ? tombol.disabled : null,
    }
  })

  catat('Nama tampilan terisi dari profil yang tersimpan',
    isi.namaTerisi === NAMA_ASLI, `terbaca "${isi.namaTerisi}"`)
  catat('Email ditampilkan tetapi terkunci', !!isi.surelTerisi && isi.surelTerkunci === true,
    isi.surelTerisi)
  catat('Tombol simpan mati selama nama belum diubah',
    isi.simpanMatiSaatBelumBerubah === true)
  await page.screenshot({ path: join(KELUARAN, 'akun-halaman.png') })

  // ---------- ubah nama ----------
  await page.fill('#nama-tampilan', NAMA_BARU)
  await page.waitForTimeout(400)
  const simpanHidup = await page.evaluate(() =>
    !document.querySelector('button[type=submit]').disabled)
  catat('Tombol simpan hidup setelah nama diubah', simpanHidup)

  await page.click('button[type=submit]')
  await page.waitForTimeout(2500)

  const tersimpan = await bacaNama()
  catat('Nama baru tersimpan di basis data', tersimpan === NAMA_BARU,
    `"${NAMA_ASLI}" menjadi "${tersimpan}"`)

  const adaNotifikasi = await page.evaluate(() =>
    /Nama tampilan tersimpan/.test(document.body.innerText))
  catat('Notifikasi keberhasilan muncul', adaNotifikasi)
  await page.screenshot({ path: join(KELUARAN, 'akun-tersimpan.png') })

  // ---------- muat ulang, nama harus bertahan ----------
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const sesudahMuatUlang = await page.evaluate(() =>
    document.querySelector('#nama-tampilan')?.value)
  catat('Nama bertahan setelah halaman dimuat ulang',
    sesudahMuatUlang === NAMA_BARU, `terbaca "${sesudahMuatUlang}"`)

  // ---------- nama baru benar-benar muncul di tempat yang dibaca orang ----------
  if (ID) {
    await page.goto(`${BASIS}/lokasi/${ID}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2400)
    const diDetail = await page.evaluate(() => document.body.innerText)
    catat('Nama baru muncul pada halaman detail lokasi',
      new RegExp(`Ditambahkan ${NAMA_BARU}`).test(diDetail),
      (diDetail.match(/Ditambahkan [^.]{0,45}/) || [''])[0])
  }

  await page.goto(`${BASIS}/papan-kontributor`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  const diPapan = await page.evaluate(() => document.body.innerText)
  catat('Nama baru muncul pada papan kontributor', diPapan.includes(NAMA_BARU))
  catat('Papan kontributor menawarkan jalan ke halaman akun',
    /Ubah nama tampilan/.test(diPapan))

  // ---------- nama terlalu pendek ditolak ----------
  await page.goto(`${BASIS}/akun`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.fill('#nama-tampilan', 'A')
  await page.waitForTimeout(400)
  const pendekDitolak = await page.evaluate(() =>
    document.querySelector('button[type=submit]').disabled)
  catat('Nama satu huruf tidak bisa disimpan', pendekDitolak === true)

  await page.close()
  await konteks.close()
}
finally {
  await browser.close()

  // Dikembalikan persis seperti semula, dan lokasi uji dihapus.
  if (NAMA_ASLI) {
    await fetch(`${URL_}/rest/v1/profiles?id=eq.${uid}`, {
      method: 'PATCH', headers: auth, body: JSON.stringify({ nama: NAMA_ASLI }),
    })
  }
  if (ID) await fetch(`${URL_}/rest/v1/locations?id=eq.${ID}`, { method: 'DELETE', headers: auth })

  const kembali = await bacaNama()
  catat('Nama dan lokasi uji dikembalikan seperti semula', kembali === NAMA_ASLI,
    `nama sekarang "${kembali}"`)
}

const gagal = langkah.filter(l => !l.lolos)
console.log(`\n${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
if (gagal.length) process.exitCode = 1
