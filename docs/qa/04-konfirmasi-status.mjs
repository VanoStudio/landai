// Bagian tiga: konfirmasi dan status, langkah 15 sampai 19.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { BASE, TANGKAPAN, BERKAS_AKUN, bidik, catat, pantauKonsol, rest, masukApi, ANON } from './lib.mjs'

const simpanan = JSON.parse(readFileSync(BERKAS_AKUN, 'utf8'))
const ID = simpanan.idLokasi
const hasil = []
function nilai(nomor, nama, lolos, ket = '') {
  hasil.push({ nomor, nama, lolos, ket })
  catat(`${lolos ? 'LOLOS' : 'GAGAL'}  [${nomor}] ${nama}  ${ket}`)
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

async function sesi(akun) {
  const k = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta',
  })
  const p = await k.newPage()
  pantauKonsol(p, 'bagian-3')
  await p.goto(`${BASE}/masuk`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  await p.fill('#email', akun.email)
  await p.fill('#password', akun.sandi)
  await p.evaluate(() => document.querySelector('form').requestSubmit())
  await p.waitForTimeout(6000)
  return { k, p }
}

async function statusDb(id = ID) {
  const { data } = await rest(`locations?id=eq.${id}&select=nama,skor,status`)
  const { data: c } = await rest(`confirmations?location_id=eq.${id}&select=user_id,is_accurate`)
  return { ...data[0], akurat: c.filter(x => x.is_accurate).length, berubah: c.filter(x => !x.is_accurate).length }
}

async function tekanKonfirmasi(p, teks) {
  await p.goto(`${BASE}/lokasi/${ID}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3500)
  await p.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === t)
    if (!b) throw new Error('tombol tidak ketemu: ' + t)
    b.click()
  }, teks)
  await p.waitForTimeout(3500)
}

// --- langkah 15: tiga akun berbeda menyatakan masih akurat ---
const urutan = ['beta', 'gama', 'delta']
const jejakStatus = [await statusDb()]
catat(`keadaan awal: ${JSON.stringify(jejakStatus[0])}`)

for (let i = 0; i < urutan.length; i++) {
  const { k, p } = await sesi(simpanan.akun[urutan[i]])
  await tekanKonfirmasi(p, 'Masih akurat')
  const s = await statusDb()
  jejakStatus.push(s)
  catat(`setelah konfirmasi ${i + 1} (${urutan[i]}): ${JSON.stringify(s)}`)
  if (i === 1) await bidik(p, 'status-dua-konfirmasi')
  if (i === 2) await bidik(p, 'status-tiga-konfirmasi', { penuh: true })
  await k.close()
}
nilai(15, 'Status berubah menjadi terverifikasi tepat pada konfirmasi ketiga',
  jejakStatus[1].status === 'belum_terverifikasi'
  && jejakStatus[2].status === 'belum_terverifikasi'
  && jejakStatus[3].status === 'terverifikasi',
  jejakStatus.map((s, i) => `${i}:${s.status}(${s.akurat}A/${s.berubah}B)`).join(' '))

// --- langkah 16: tiga akun menyatakan sudah berubah ---
const jejakTurun = [await statusDb()]
for (let i = 0; i < urutan.length; i++) {
  const { k, p } = await sesi(simpanan.akun[urutan[i]])
  await tekanKonfirmasi(p, 'Sudah berubah')
  const s = await statusDb()
  jejakTurun.push(s)
  catat(`setelah laporan berubah ${i + 1} (${urutan[i]}): ${JSON.stringify(s)}`)
  if (i === 2) {
    await p.goto(`${BASE}/lokasi/${ID}`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(3000)
    await bidik(p, 'status-turun-ajakan-perbarui', { penuh: true })
    const ajakan = await p.evaluate(() =>
      [...document.querySelectorAll('p')].map(e => e.textContent.trim())
        .find(t => /Mungkin sudah berubah/.test(t)))
    nilai(16, 'Penanda ajakan memperbarui data muncul', !!ajakan, (ajakan || '').slice(0, 90))
  }
  await k.close()
}
nilai(16, 'Status turun kembali menjadi belum terverifikasi',
  jejakTurun.at(-1).status === 'belum_terverifikasi',
  jejakTurun.map((s, i) => `${i}:${s.status}(${s.akurat}A/${s.berubah}B)`).join(' '))

// --- naikkan lagi supaya langkah 17 berangkat dari keadaan terverifikasi ---
for (const kunci of urutan) {
  const { k, p } = await sesi(simpanan.akun[kunci])
  await tekanKonfirmasi(p, 'Masih akurat')
  await k.close()
}
const sebelumSunting = await statusDb()
catat(`sebelum sunting: ${JSON.stringify(sebelumSunting)}`)

// --- langkah 17: pemilik menyunting daftar periksa ---
{
  const { k, p } = await sesi(simpanan.akun.utama)
  await p.goto(`${BASE}/lokasi/${ID}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3000)
  const adaTombolSunting = await p.evaluate(() =>
    [...document.querySelectorAll('a')].some(a => a.textContent.trim() === 'Edit lokasi'))
  nilai(17, 'Tombol Edit lokasi tampil untuk pemiliknya', adaTombolSunting)

  await p.goto(`${BASE}/tambah-lokasi?ubah=${ID}`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.maplibregl-canvas', { timeout: 40000 })
  await p.waitForTimeout(8000)
  await bidik(p, 'sunting-langkah-1')
  const klik = async (t) => {
    await p.evaluate((teks) => {
      const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === teks)
      b.click()
    }, t)
    await p.waitForTimeout(800)
  }
  await klik('Lanjut')
  await klik('Lanjut')
  await p.waitForTimeout(800)
  const sebelumCentang = await p.evaluate(() =>
    [...document.querySelectorAll('input[type=checkbox]')].map(i => i.checked))
  const skorSebelum = await p.evaluate(() => document.querySelector('.text-5xl')?.textContent.trim())
  // Ubah satu isian: yang belum dicentang, dicentang.
  const indeksUbah = sebelumCentang.findIndex(v => !v)
  const kotak = await p.$$('input[type=checkbox]')
  await kotak[indeksUbah].click()
  await p.waitForTimeout(600)
  const skorSesudah = await p.evaluate(() => document.querySelector('.text-5xl')?.textContent.trim())
  await bidik(p, 'sunting-checklist')
  await klik('Lanjut')
  await p.waitForTimeout(600)
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find(e => /Simpan/.test(e.textContent))
    b.click()
  })
  await p.waitForURL(/\/lokasi\//, { timeout: 60000 })
  await p.waitForTimeout(4000)
  await bidik(p, 'sunting-hasil', { penuh: true })
  const sesudahSunting = await statusDb()
  const skorHarap = String(Math.round((sebelumCentang.filter(Boolean).length + 1) / 8 * 100))
  nilai(17, 'Menyunting daftar periksa mengembalikan status ke belum terverifikasi',
    sebelumSunting.status === 'terverifikasi' && sesudahSunting.status === 'belum_terverifikasi',
    `sebelum ${sebelumSunting.status} (${sebelumSunting.akurat}A), sesudah ${sesudahSunting.status} (${sesudahSunting.akurat}A/${sesudahSunting.berubah}B)`)
  nilai(17, 'Skor terhitung ulang dengan benar setelah sunting',
    String(sesudahSunting.skor) === skorHarap && skorSesudah !== skorSebelum,
    `centang ${sebelumCentang.filter(Boolean).length} menjadi ${sebelumCentang.filter(Boolean).length + 1}, pratinjau ${skorSebelum} menjadi ${skorSesudah}, basis data ${sesudahSunting.skor}, harapan ${skorHarap}`)
  await k.close()
}

// --- langkah 18: akun lain mencoba membuka halaman sunting ---
{
  const { k, p } = await sesi(simpanan.akun.beta)
  await p.goto(`${BASE}/lokasi/${ID}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3000)
  const adaTombol = await p.evaluate(() =>
    [...document.querySelectorAll('a')].some(a => a.textContent.trim() === 'Edit lokasi'))
  nilai(18, 'Tombol Edit lokasi tidak tampil untuk yang bukan pemilik', !adaTombol)

  await p.goto(`${BASE}/tambah-lokasi?ubah=${ID}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(4000)
  await bidik(p, 'sunting-ditolak-bukan-pemilik')
  const isi = await p.evaluate(() => ({
    teks: document.body.innerText.slice(0, 300),
    adaForm: !!document.querySelector('#nama-tempat') || !!document.querySelector('input[type=checkbox]'),
  }))
  nilai(18, 'Akses langsung ke rute sunting milik orang lain ditolak',
    !isi.adaForm && /403|Hanya kontributor/i.test(isi.teks),
    isi.teks.replace(/\s+/g, ' ').slice(0, 110))
  await k.close()
}

// --- langkah 19: permintaan langsung ke layanan memakai token bukan pemilik ---
const sesiBeta = await masukApi(simpanan.akun.beta.email, simpanan.akun.beta.sandi)
const tokenBeta = sesiBeta.data.access_token
const sebelumApi = await statusDb()
const { data: checklistSebelum } = await rest(`accessibility_checklist?location_id=eq.${ID}&select=*`)

const patchChecklist = await rest(`accessibility_checklist?location_id=eq.${ID}`, {
  method: 'PATCH', token: tokenBeta,
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ ramp_tersedia: false, toilet_difabel: false }),
})
const { data: checklistSesudah } = await rest(`accessibility_checklist?location_id=eq.${ID}&select=*`)
const berubah = JSON.stringify(checklistSebelum) !== JSON.stringify(checklistSesudah)
nilai(19, 'Pembaruan daftar periksa lokasi orang lain lewat API ditolak RLS',
  !berubah && (patchChecklist.status === 403 || (Array.isArray(patchChecklist.data) && patchChecklist.data.length === 0)),
  `HTTP ${patchChecklist.status}, ${Array.isArray(patchChecklist.data) ? patchChecklist.data.length : '?'} baris dikembalikan, isi checklist ${berubah ? 'BERUBAH' : 'tidak berubah'}`)

const patchSkor = await rest(`locations?id=eq.${ID}`, {
  method: 'PATCH', token: tokenBeta,
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ skor: 100, status: 'terverifikasi' }),
})
const sesudahApi = await statusDb()
nilai(19, 'Kolom skor dan status tidak bisa ditulis dari klien',
  sesudahApi.skor === sebelumApi.skor && sesudahApi.status === sebelumApi.status,
  `HTTP ${patchSkor.status}, ${JSON.stringify(patchSkor.data).slice(0, 90)}, skor tetap ${sesudahApi.skor}, status tetap ${sesudahApi.status}`)

const patchNama = await rest(`locations?id=eq.${ID}`, {
  method: 'PATCH', token: tokenBeta,
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ nama: 'DIBAJAK OLEH AKUN LAIN' }),
})
const { data: namaSesudah } = await rest(`locations?id=eq.${ID}&select=nama`)
nilai(19, 'Nama lokasi orang lain tidak bisa diubah lewat API',
  namaSesudah[0].nama === simpanan.namaLokasi,
  `HTTP ${patchNama.status}, nama tetap "${namaSesudah[0].nama}"`)

const insertFoto = await rest('location_photos', {
  method: 'POST', token: tokenBeta,
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ location_id: ID, photo_url: 'https://contoh.invalid/uji-qa.jpg' }),
})
nilai(19, 'Foto tidak bisa ditempelkan ke lokasi orang lain',
  insertFoto.status === 403 || insertFoto.status === 401,
  `HTTP ${insertFoto.status} ${JSON.stringify(insertFoto.data).slice(0, 90)}`)

writeFileSync(path.join(TANGKAPAN, 'hasil-04.json'), JSON.stringify({ hasil, jejakStatus, jejakTurun }, null, 2))
await browser.close()
catat('bagian 3 selesai')
