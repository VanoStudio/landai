// Langkah 29 diukur secara optis, bukan dari atribut mentah. Ketebalan yang terlihat
// mata adalah stroke-width dikali rasio ukuran render terhadap viewBox, jadi dua ikon
// dengan atribut berbeda bisa saja tergambar dengan ketebalan yang sama persis.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { BASE, TANGKAPAN, BERKAS_AKUN, catat } from './lib.mjs'

const simpanan = JSON.parse(readFileSync(BERKAS_AKUN, 'utf8'))
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'id-ID' })

const kumpul = async (jalur, tunggu) => {
  await p.goto(BASE + jalur, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(tunggu)
  return p.evaluate(() => [...document.querySelectorAll('svg')].map((s) => {
    const vb = (s.getAttribute('viewBox') || '0 0 24 24').split(/\s+/).map(Number)
    const r = s.getBoundingClientRect()
    const w = s.getAttribute('stroke-width')
      || [...s.querySelectorAll('[stroke-width]')].map(e => e.getAttribute('stroke-width'))[0]
    if (!w || !r.width) return null
    const induk = s.closest('button, a')
    return {
      atribut: Number(w),
      lebarRender: Math.round(r.width),
      viewBox: vb[2],
      optis: Number((Number(w) * (r.width / vb[2])).toFixed(2)),
      peran: (induk?.getAttribute('aria-label')
        || induk?.textContent?.replace(/\s+/g, ' ').trim()
        || s.parentElement?.textContent?.replace(/\s+/g, ' ').trim()
        || 'tanpa label').slice(0, 34),
    }
  }).filter(Boolean))
}

const daftar = [
  ...await kumpul('/', 9000),
  ...await kumpul(`/lokasi/${simpanan.idLokasi}`, 4000),
]
for (const i of daftar) {
  catat(`ikon "${i.peran}": atribut ${i.atribut} pada viewBox ${i.viewBox}, dirender ${i.lebarRender}px, ketebalan optis ${i.optis}px`)
}
const optis = daftar.map(i => i.optis)
const rentang = Math.max(...optis) - Math.min(...optis)
catat(`${rentang <= 0.35 ? 'LOLOS' : 'GAGAL'}  [29] ketebalan optis seluruh ikon — ${Math.min(...optis)}px sampai ${Math.max(...optis)}px, selisih ${rentang.toFixed(2)}px`)
writeFileSync(path.join(TANGKAPAN, 'ikon-optis.json'), JSON.stringify(daftar, null, 2))
await browser.close()
