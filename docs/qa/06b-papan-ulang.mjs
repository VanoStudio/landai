// Langkah 21 diperiksa ulang dengan pembacaan baris yang benar. Percobaan pertama
// salah membaca kartu legenda tingkat sebagai baris kontributor.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { BASE, TANGKAPAN, bidik, catat, pantauKonsol, rest } from './lib.mjs'

const { data: baris } = await rest('locations?select=created_by,profiles(nama)&created_by=not.is.null')
const per = new Map()
for (const b of baris) {
  const p = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles
  const s = per.get(b.created_by) || { nama: p?.nama || 'Warga', jumlah: 0 }
  s.jumlah += 1
  per.set(b.created_by, s)
}
const harapan = [...per.values()].sort((a, b) => b.jumlah - a.jumlah)
const TINGKAT = [
  { nama: 'Baru mulai', minimal: 1, berikutnya: 3 },
  { nama: 'Kontributor aktif', minimal: 3, berikutnya: 6 },
  { nama: 'Kontributor utama', minimal: 6, berikutnya: null },
]
const tingkatDari = j => [...TINGKAT].reverse().find(t => j >= t.minimal) ?? TINGKAT[0]
const kemajuanDari = (j, t) => t.berikutnya === null ? 100 : Math.min(100, Math.round(j / t.berikutnya * 100))

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'id-ID' })
const galat = pantauKonsol(page, 'papan')
await page.goto(`${BASE}/papan-kontributor`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)
await bidik(page, 'papan-kontributor', { penuh: true })

const barisTampil = await page.evaluate(() =>
  [...document.querySelectorAll('li')]
    .filter(e => /\d+ lokasi/.test(e.innerText) && /menuju tingkat|tingkat tertinggi/.test(e.innerText))
    .map((e) => {
      const bilah = e.querySelector('[style*="width"]')
      return {
        teks: e.innerText.replace(/\s+/g, ' ').trim(),
        lebar: Number((bilah?.getAttribute('style') || '').replace(/.*width:\s*([\d.]+)%.*/, '$1')),
      }
    }))
catat('baris papan: ' + JSON.stringify(barisTampil, null, 1))

const cocokUrutan = harapan.every((h, i) => {
  const t = barisTampil[i]?.teks || ''
  return t.startsWith(String(i + 1)) && t.includes(h.nama) && t.includes(`${h.jumlah} lokasi`)
}) && barisTampil.length === harapan.length
catat(`${cocokUrutan ? 'LOLOS' : 'GAGAL'}  [21] urutan sesuai jumlah lokasi tiap akun — basis data ${harapan.map(h => `${h.nama}=${h.jumlah}`).join(', ')}`)

const cocokTingkat = harapan.every((h, i) => (barisTampil[i]?.teks || '').includes(tingkatDari(h.jumlah).nama))
catat(`${cocokTingkat ? 'LOLOS' : 'GAGAL'}  [21] tingkat sesuai ambang — ${harapan.map(h => `${h.nama}: ${h.jumlah} lokasi, ${tingkatDari(h.jumlah).nama}`).join(' | ')}`)

const cocokBilah = harapan.every((h, i) => barisTampil[i]?.lebar === kemajuanDari(h.jumlah, tingkatDari(h.jumlah)))
catat(`${cocokBilah ? 'LOLOS' : 'GAGAL'}  [21] bilah kemajuan sesuai rumus — ${harapan.map((h, i) => `${h.nama}: harap ${kemajuanDari(h.jumlah, tingkatDari(h.jumlah))}%, tampil ${barisTampil[i]?.lebar}%`).join(' | ')}`)

writeFileSync(path.join(TANGKAPAN, 'hasil-06b.json'), JSON.stringify({ harapan, barisTampil, galat }, null, 2))
await browser.close()
