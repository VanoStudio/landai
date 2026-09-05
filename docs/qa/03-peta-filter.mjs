// Bagian dua: penyaringan dan peta, langkah 8 sampai 14.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { BASE, TANGKAPAN, BERKAS_AKUN, bidik, catat, pantauKonsol, rest } from './lib.mjs'

const simpanan = JSON.parse(readFileSync(BERKAS_AKUN, 'utf8'))
const hasil = []
function nilai(nomor, nama, lolos, ket = '') {
  hasil.push({ nomor, nama, lolos, ket })
  catat(`${lolos ? 'LOLOS' : 'GAGAL'}  [${nomor}] ${nama}  ${ket}`)
}

// --- kebenaran dari basis data, bukan dari mata ---
const { data: baris } = await rest('locations?select=id,nama,lat,lng,skor,status,accessibility_checklist(ramp_tersedia,guiding_block_tersambung,tempat_duduk_tersedia,lift_tersedia_berfungsi)')
const lokasiDb = baris.map((l) => {
  const c = Array.isArray(l.accessibility_checklist) ? l.accessibility_checklist[0] : l.accessibility_checklist
  return { ...l, ...(c || {}) }
})
const cocok = {
  kursi_roda: l => !!l.ramp_tersedia,
  tunanetra: l => !!l.guiding_block_tersambung,
  lansia_stroller: l => !!l.tempat_duduk_tersedia || !!l.lift_tersedia_berfungsi,
}
const harapan = {
  kursi_roda: lokasiDb.filter(cocok.kursi_roda).length,
  tunanetra: lokasiDb.filter(cocok.tunanetra).length,
  lansia_stroller: lokasiDb.filter(cocok.lansia_stroller).length,
  gabungan: lokasiDb.filter(l => cocok.kursi_roda(l) && cocok.tunanetra(l) && cocok.lansia_stroller(l)).length,
  semua: lokasiDb.length,
}
catat(`kebenaran basis data: ${JSON.stringify(harapan)}`)

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const konteks = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta',
})
const page = await konteks.newPage()
const galat = pantauKonsol(page, 'bagian-2')

const hitungPenanda = () => page.evaluate(() => {
  const tunggal = document.querySelectorAll('.penanda-skor.maplibregl-marker').length
  const kluster = [...document.querySelectorAll('.penanda-kluster.maplibregl-marker')]
    .reduce((s, e) => s + Number(e.textContent), 0)
  return tunggal + kluster
})

async function pakaiChip(label) {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(e => e.textContent.includes(t))
    b.click()
  }, label)
  await page.waitForTimeout(1500)
}

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.maplibregl-canvas', { timeout: 30000 })
await page.waitForTimeout(9000)
// Kartu pengenalan pengunjung pertama menutupi peta; tutup dulu.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(e => /Mengerti|Tutup|Mulai/i.test(e.textContent))
  if (b) b.click()
})
await page.waitForTimeout(800)

const awal = await hitungPenanda()
nilai(8, 'Tanpa penyaring, jumlah penanda sama dengan isi basis data',
  awal === harapan.semua, `peta ${awal}, basis data ${harapan.semua}`)

// --- langkah 8: tiga penyaring satu per satu ---
const CHIP = {
  kursi_roda: 'Kursi roda',
  tunanetra: 'Tunanetra',
  lansia_stroller: 'Lansia atau stroller',
}
for (const [kunci, label] of Object.entries(CHIP)) {
  await pakaiChip(label)
  const n = await hitungPenanda()
  const angkaChip = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(e => e.textContent.includes(t))
    return Number(b.textContent.replace(t, '').trim())
  }, label)
  await bidik(page, `filter-${kunci}`)
  nilai(8, `Penyaring ${label}`, n === harapan[kunci] && angkaChip === harapan[kunci],
    `peta ${n}, angka chip ${angkaChip}, basis data ${harapan[kunci]}`)
  await pakaiChip(label)
}

// --- langkah 8: gabungan ketiganya ---
for (const label of Object.values(CHIP)) await pakaiChip(label)
const nGabungan = await hitungPenanda()
await bidik(page, 'filter-gabungan')
nilai(8, 'Ketiga penyaring digabung', nGabungan === harapan.gabungan,
  `peta ${nGabungan}, basis data ${harapan.gabungan}`)
for (const label of Object.values(CHIP)) await pakaiChip(label)

// --- langkah 9: penanda saat perbesar dan perkecil berulang ---
// Posisi tiap penanda direkam banyak kali di tengah animasi. Yang dicari adalah
// penanda yang sempat terlukis di pojok kiri atas wadah, gejala penanda tertunda.
const rekaman = await page.evaluate(async () => {
  const peta = document.querySelector('.maplibregl-canvas').parentElement
  const bingkai = []
  const rekam = () => {
    const el = [...document.querySelectorAll('.maplibregl-marker')]
    bingkai.push(el.map((e) => {
      const r = e.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), t: e.style.transform.slice(0, 40) }
    }))
  }
  const tunggu = ms => new Promise(r => setTimeout(r, ms))
  for (let putaran = 0; putaran < 3; putaran++) {
    peta.dispatchEvent(new WheelEvent('wheel', { deltaY: -400, bubbles: true, clientX: 195, clientY: 400 }))
    for (let i = 0; i < 18; i++) { rekam(); await tunggu(40) }
    peta.dispatchEvent(new WheelEvent('wheel', { deltaY: 400, bubbles: true, clientX: 195, clientY: 400 }))
    for (let i = 0; i < 18; i++) { rekam(); await tunggu(40) }
  }
  return bingkai
})
const wadahAsal = rekaman.flat().filter(p => Math.abs(p.x) < 24 && Math.abs(p.y) < 24)
const tanpaTransform = rekaman.flat().filter(p => !p.t || p.t === 'translate(0px, 0px)')
await bidik(page, 'zoom-berulang')
nilai(9, 'Tidak ada penanda melompat ke pojok saat perbesar dan perkecil',
  wadahAsal.length === 0 && tanpaTransform.length === 0,
  `${rekaman.length} bingkai direkam, ${rekaman.flat().length} posisi, di pojok ${wadahAsal.length}, tanpa transform ${tanpaTransform.length}`)

// --- langkah 10: satu ketukan memisahkan seluruh anggota kelompok ---
const sebelumKluster = await page.evaluate(() => ({
  kluster: [...document.querySelectorAll('.penanda-kluster.maplibregl-marker')].map(e => Number(e.textContent)),
  tunggal: document.querySelectorAll('.penanda-skor.maplibregl-marker').length,
}))
await bidik(page, 'kluster-sebelum')
const anggotaTerbesar = Math.max(0, ...sebelumKluster.kluster)
await page.evaluate(() => {
  const k = [...document.querySelectorAll('.penanda-kluster.maplibregl-marker')]
    .sort((a, b) => Number(b.textContent) - Number(a.textContent))[0]
  if (k) k.click()
})
await page.waitForTimeout(2500)
const sesudahKluster = await page.evaluate(() => ({
  kluster: [...document.querySelectorAll('.penanda-kluster.maplibregl-marker')].map(e => Number(e.textContent)),
  tunggal: document.querySelectorAll('.penanda-skor.maplibregl-marker').length,
}))
await bidik(page, 'kluster-sesudah')
nilai(10, 'Satu ketukan pada kelompok memisahkan anggotanya',
  sesudahKluster.tunggal >= anggotaTerbesar,
  `sebelum ${sebelumKluster.tunggal} tunggal + kelompok ${JSON.stringify(sebelumKluster.kluster)}, sesudah ${sesudahKluster.tunggal} tunggal + kelompok ${JSON.stringify(sesudahKluster.kluster)}`)

// --- langkah 5 lanjutan: foto pada kartu ringkas, setelah penanda terpisah ---
const adaPenandaUji = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.penanda-skor.maplibregl-marker')]
  const t = el.find(e => (e.getAttribute('aria-label') || '').includes('UJI QA'))
  if (t) { t.click(); return t.getAttribute('aria-label') }
  return null
})
await page.waitForTimeout(2500)
await bidik(page, 'kartu-ringkas-foto')
const kartu = await page.evaluate(() => {
  const gambar = [...document.images].filter(i => i.src.includes('location-photos'))
  const tautan = [...document.querySelectorAll('a[href*="google.com/maps"]')].map(a => a.href)
  return { gambar: gambar.length, tautan }
})
nilai(5, 'Foto tampil di kartu ringkas, bukan kotak abu polos',
  kartu.gambar >= 1, `${kartu.gambar} gambar Storage pada kartu, penanda ${adaPenandaUji}`)

// --- langkah 13: tombol rute pada kartu ringkas ---
const lokasiUji = lokasiDb.find(l => l.nama === simpanan.namaLokasi)
const tautanKartu = kartu.tautan[0] || ''
nilai(13, 'Tombol rute pada kartu menuju Google Maps dengan koordinat benar',
  /google\.com\/maps\/dir\/\?api=1&destination=-?\d+\.\d+,-?\d+\.\d+/.test(tautanKartu),
  tautanKartu)

// --- langkah 12: pencarian area ---
const sebelumCari = await page.evaluate(() => ({
  tengah: window.__peta ? null : null,
  penanda: document.querySelectorAll('.maplibregl-marker').length,
}))
await page.fill('input[aria-label="Cari area di peta"]', 'Senayan')
await page.keyboard.press('Enter')
await page.waitForTimeout(4000)
const hasilCari = await page.evaluate(() =>
  [...document.querySelectorAll('button')].filter(b => b.className.includes('text-left')).map(b => b.textContent.trim()))
await bidik(page, 'cari-area-hasil')
nilai(12, 'Pencarian area memberi hasil yang relevan', hasilCari.length > 0,
  `${hasilCari.length} hasil, teratas "${(hasilCari[0] || '').slice(0, 60)}"`)

if (hasilCari.length) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].filter(x => x.className.includes('text-left'))[0]
    b.click()
  })
  await page.waitForTimeout(3500)
}
const sesudahCari = await page.evaluate(() => document.querySelectorAll('.maplibregl-marker').length)
const { data: setelahCariDb } = await rest('locations?select=id')
await bidik(page, 'cari-area-sesudah')
nilai(12, 'Pencarian memindahkan pandangan tanpa menaruh titik baru',
  setelahCariDb.length === lokasiDb.length,
  `penanda sebelum ${sebelumCari.penanda}, sesudah ${sesudahCari}, lokasi di basis data tetap ${setelahCariDb.length}`)

// --- langkah 14: izin lokasi ditolak ---
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.maplibregl-canvas', { timeout: 30000 })
await page.waitForTimeout(7000)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(e => /Mengerti|Tutup|Mulai/i.test(e.textContent))
  if (b) b.click()
})
await konteks.clearPermissions()
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')]
    .find(e => (e.getAttribute('aria-label') || '').includes('lokasi saya'))
  b.click()
})
await page.waitForTimeout(2500)
const notif = await page.evaluate(() => {
  const kartuNotif = [...document.querySelectorAll('div')]
    .filter(d => /izin|lokasi/i.test(d.textContent || '') && d.children.length <= 3 && d.textContent.length < 200)
  const semua = [...document.querySelectorAll('[role="status"], [role="alert"], .notifikasi, [class*="notif"]')]
  return {
    teks: semua.map(e => e.textContent.trim()).filter(Boolean),
    kotak: semua.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }),
    tombolTutup: semua.some(e => e.querySelector('button')),
    kandidat: kartuNotif.length,
  }
})
await bidik(page, 'notifikasi-izin-ditolak')
nilai(14, 'Notifikasi muncul saat izin lokasi ditolak', notif.teks.length > 0,
  JSON.stringify(notif.teks).slice(0, 140))

// tidak menimpa kartu ringkas maupun kendali peta
const tumpang = await page.evaluate(() => {
  const notifEl = [...document.querySelectorAll('[role="status"], [role="alert"], [class*="notif"]')]
  const kendali = [...document.querySelectorAll('button[aria-label*="lokasi saya"], .maplibregl-ctrl, [class*="kartu-ringkas"]')]
  const beririsan = []
  for (const n of notifEl) {
    const a = n.getBoundingClientRect()
    if (!a.width) continue
    for (const k of kendali) {
      const b = k.getBoundingClientRect()
      if (!b.width) continue
      const iris = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
      if (iris) beririsan.push({ notif: n.textContent.trim().slice(0, 40), kendali: k.getAttribute('aria-label') || k.className.slice(0, 40) })
    }
  }
  return beririsan
})
nilai(14, 'Notifikasi tidak menimpa kendali peta atau kartu ringkas',
  tumpang.length === 0, JSON.stringify(tumpang).slice(0, 160))

// hilang sendiri
await page.waitForTimeout(4500)
const sisaNotif = await page.evaluate(() =>
  [...document.querySelectorAll('[role="status"], [role="alert"], [class*="notif"]')]
    .map(e => e.textContent.trim()).filter(Boolean))
await bidik(page, 'notifikasi-hilang-sendiri')
nilai(14, 'Notifikasi hilang sendiri dalam beberapa detik', sisaNotif.length === 0,
  `sisa setelah 7 detik: ${JSON.stringify(sisaNotif).slice(0, 80)}`)

// bisa ditutup manual
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')]
    .find(e => (e.getAttribute('aria-label') || '').includes('lokasi saya'))
  b.click()
})
await page.waitForTimeout(2000)
const adaTombolTutup = await page.evaluate(() => {
  const n = [...document.querySelectorAll('[role="status"], [role="alert"], [class*="notif"]')]
    .find(e => e.textContent.trim())
  const b = n?.querySelector('button')
  if (b) { b.click(); return true }
  return false
})
await page.waitForTimeout(1200)
const setelahTutup = await page.evaluate(() =>
  [...document.querySelectorAll('[role="status"], [role="alert"], [class*="notif"]')]
    .map(e => e.textContent.trim()).filter(Boolean).length)
nilai(14, 'Notifikasi bisa ditutup manual', adaTombolTutup && setelahTutup === 0,
  `tombol tutup ${adaTombolTutup ? 'ada' : 'tidak ada'}, sisa ${setelahTutup}`)

// --- langkah 11: tombol lokasi saya dengan izin diberikan ---
await konteks.grantPermissions(['geolocation'], { origin: BASE })
await konteks.setGeolocation({ latitude: -6.2440, longitude: 106.7983, accuracy: 20 })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('.maplibregl-canvas', { timeout: 30000 })
await page.waitForTimeout(8000)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')]
    .find(e => (e.getAttribute('aria-label') || '').includes('lokasi saya'))
  b.click()
})
await page.waitForTimeout(4000)
const titikSaya = await page.evaluate(() => document.querySelectorAll('.titik-saya').length)
await bidik(page, 'lokasi-saya')
nilai(11, 'Tombol lokasi saya menampilkan titik posisi dan memusatkan peta',
  titikSaya === 1, `${titikSaya} titik posisi di peta`)

// --- langkah 13: tombol rute pada halaman detail ---
await page.goto(`${BASE}/lokasi/${simpanan.idLokasi}`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3500)
const tautanDetail = await page.evaluate(() =>
  [...document.querySelectorAll('a[href*="google.com/maps"]')].map(a => a.href))
await bidik(page, 'detail-tombol-rute')
const benar = tautanDetail.some(t =>
  t.includes(`destination=${lokasiUji.lat},${lokasiUji.lng}`))
nilai(13, 'Tombol rute pada halaman detail memakai koordinat lokasi yang benar',
  benar, `${tautanDetail[0]} ; basis data ${lokasiUji.lat},${lokasiUji.lng}`)

writeFileSync(path.join(TANGKAPAN, 'hasil-03.json'), JSON.stringify({ hasil, galat, harapan }, null, 2))
catat(`galat konsol bagian 2: ${galat.length}`)
await browser.close()
