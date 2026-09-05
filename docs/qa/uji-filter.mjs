// Menguji tiap penyaring kebutuhan secara terpisah, lalu satu kombinasi.
// Yang diperiksa bukan cuma tampilan: jumlah penanda di peta dibandingkan dengan
// jumlah lokasi yang benar-benar memenuhi syarat menurut isi basis data.

import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const BASIS = 'http://localhost:3000'
const KELUARAN = join(process.cwd(), 'gambar')

// Jumlah yang diharapkan DIHITUNG dari basis data, tidak ditulis mati.
//
// Sebelumnya keempat angkanya konstanta, dan begitu satu lokasi sungguhan masuk ke
// basis data, tiga dari delapan kasus gagal padahal aplikasinya benar. Pengujian
// yang menuntut data tetap seperti itu justru menghalangi survei lapangan bertambah.
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

const baris = await (await fetch(
  `${env.SUPABASE_URL}/rest/v1/accessibility_checklist`
  + '?select=ramp_tersedia,guiding_block_tersambung,tempat_duduk_tersedia,lift_tersedia_berfungsi',
  { headers: { apikey: env.SUPABASE_KEY } })).json()

// Aturannya disalin apa adanya dari cocokKebutuhan() di app/composables/use-lokasi.ts.
const cocok = {
  'Kursi roda': l => l.ramp_tersedia,
  'Tunanetra': l => l.guiding_block_tersambung,
  'Lansia atau stroller': l => l.tempat_duduk_tersedia || l.lift_tersedia_berfungsi,
}

const hitung = (...syarat) =>
  baris.filter(l => syarat.every(s => cocok[s](l))).length

const KASUS = [
  { nama: 'filter-kursi-roda', pilih: ['Kursi roda'] },
  { nama: 'filter-lansia', pilih: ['Lansia atau stroller'] },
  { nama: 'filter-tunanetra', pilih: ['Tunanetra'] },
  { nama: 'filter-gabungan', pilih: ['Kursi roda', 'Tunanetra'] },
].map(k => ({ ...k, harap: hitung(...k.pilih) }))

console.log(`  ${baris.length} lokasi berchecklist di basis data`)
for (const k of KASUS) console.log(`    ${k.pilih.join(' + ')} : ${k.harap} lokasi`)
console.log('')

async function sembunyikanDevtools(page) {
  await page.addStyleTag({
    content: '#nuxt-devtools-anchor,#nuxt-devtools-container,.nuxt-devtools-anchor{display:none!important}',
  }).catch(() => {})
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const hasil = []

for (const [label, viewport] of [
  ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
]) {
  const konteks = await browser.newContext({ ...viewport, locale: 'id-ID', timezoneId: 'Asia/Jakarta' })

  for (const kasus of KASUS) {
    const page = await konteks.newPage()
    const galat = []
    page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 120)) })

    await page.goto(BASIS, { waitUntil: 'networkidle' })
    await sembunyikanDevtools(page)
    await page.waitForSelector('.maplibregl-canvas')
    await page.waitForTimeout(9000)

    const sebelum = await page.evaluate(() => (() => {
      const tunggal = document.querySelectorAll('.penanda-skor.maplibregl-marker').length
      const dalamKluster = [...document.querySelectorAll('.penanda-kluster.maplibregl-marker')]
        .reduce((s, e) => s + Number(e.textContent), 0)
      return tunggal + dalamKluster
    })())

    for (const teks of kasus.pilih) {
      await page.evaluate((t) => {
        const c = [...document.querySelectorAll('[aria-pressed]')].find(b => b.innerText.includes(t))
        c.click()
      }, teks)
      await page.waitForTimeout(1500)
    }
    await page.waitForTimeout(3500)
    await sembunyikanDevtools(page)

    const sesudah = await page.evaluate(() => (() => {
      const tunggal = document.querySelectorAll('.penanda-skor.maplibregl-marker').length
      const dalamKluster = [...document.querySelectorAll('.penanda-kluster.maplibregl-marker')]
        .reduce((s, e) => s + Number(e.textContent), 0)
      return tunggal + dalamKluster
    })())
    const ditekan = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-pressed="true"]')].map(b => b.innerText.split('\n')[0].trim()))

    await page.screenshot({ path: join(KELUARAN, `${kasus.nama}-${label}.png`) })

    const lolos = sesudah === kasus.harap
    hasil.push({ kasus: kasus.nama, label, sebelum, sesudah, harap: kasus.harap, lolos, ditekan, galat })
    console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${kasus.nama.padEnd(20)} ${label.padEnd(8)} ${sebelum} penanda jadi ${sesudah}, diharapkan ${kasus.harap}  aktif: ${ditekan.join(' + ')}`)
    await page.close()
  }
  await konteks.close()
}

await browser.close()

const gagal = hasil.filter(h => !h.lolos)
const bergalat = hasil.filter(h => h.galat.length)
console.log(`\n${hasil.length - gagal.length} dari ${hasil.length} pemeriksaan lolos`)
console.log(bergalat.length ? 'ada galat konsol' : 'nol galat konsol')
if (gagal.length) process.exitCode = 1
