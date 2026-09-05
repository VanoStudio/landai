// Bukti cacat hidrasi dan bukti perbaikannya.
//
// Penyebabnya tanggal kontributor: server render memakai zona mesinnya sendiri,
// peramban memakai zona pembacanya. Untuk memperlihatkannya tanpa bergantung pada
// zona mesin mana pun, peramban di sini sengaja dipasang pada zona yang berbeda dari
// server. Produksi masih memakai kode lama, dev server lokal sudah memakai kode baru.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { BERKAS_AKUN, catat, bidik } from './lib.mjs'

const simpanan = JSON.parse(readFileSync(BERKAS_AKUN, 'utf8'))
const SASARAN = [
  { nama: 'produksi, kode lama', basis: 'https://landai-zeta.vercel.app' },
  { nama: 'dev lokal, kode baru', basis: 'http://localhost:3000' },
]

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

for (const s of SASARAN) {
  for (const zona of ['Asia/Jakarta', 'America/New_York']) {
    const k = await browser.newContext({
      viewport: { width: 390, height: 844 }, locale: 'id-ID', timezoneId: zona,
    })
    const p = await k.newPage()
    const galat = []
    p.on('console', m => { if (m.type() === 'error') galat.push(m.text()) })

    // Tanggal yang dirender server, dibaca dari HTML pertama sebelum hidrasi.
    const jawab = await p.goto(`${s.basis}/lokasi/${simpanan.idLokasi}`, { waitUntil: 'commit' })
    const html = await jawab.text()
    const tanggalServer = (html.match(/Ditambahkan[^<]*/) || ['tidak ketemu'])[0].trim()

    await p.waitForTimeout(6000)
    const tanggalKlien = await p.evaluate(() =>
      [...document.querySelectorAll('p,div,span')].map(e => e.textContent.trim())
        .find(t => /^Ditambahkan/.test(t)) || 'tidak ketemu')
    const cocok = tanggalServer === tanggalKlien
    catat(`[${s.nama}] zona peramban ${zona}`)
    catat(`   server : ${tanggalServer}`)
    catat(`   klien  : ${tanggalKlien}`)
    catat(`   ${cocok ? 'cocok' : 'BERBEDA'}, galat konsol ${galat.length}${galat.length ? ': ' + galat[0].slice(0, 60) : ''}`)
    await k.close()
  }
}
await browser.close()
