// Merender aset raster dari tanda SVG yang sama, secara lokal lewat Chromium.
// Perlu raster karena WhatsApp dan Telegram tidak merender og:image berformat SVG,
// dan Safari lama tidak menerima favicon SVG.

import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const AKAR = process.argv[2]
const TANDA = await readFile(join(AKAR, 'public', 'tanda.svg'), 'utf8')

const browser = await chromium.launch()

// ---------- gambar pratinjau tautan, 1200x630 ----------
const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await og.setContent(`
<style>
  @import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600;700&display=swap');
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    font-family: 'Public Sans', system-ui, sans-serif;
    background: #F9FAFB;
    display: flex; flex-direction: column; justify-content: center;
    padding: 0 96px;
    position: relative;
  }
  .garis { position: absolute; left: 0; right: 0; top: 0; height: 10px; background: #0F6E56; }
  .merek { display: flex; align-items: center; gap: 24px; }
  .merek svg { width: 104px; height: 104px; }
  .nama { font-size: 84px; font-weight: 700; color: #0F6E56; letter-spacing: -0.02em; line-height: 1; }
  .judul { margin-top: 40px; font-size: 46px; font-weight: 600; color: #101828; line-height: 1.2; max-width: 900px; }
  .sub { margin-top: 20px; font-size: 28px; color: #4B5563; line-height: 1.45; max-width: 860px; }
  .kaki { position: absolute; left: 96px; bottom: 56px; display: flex; align-items: center; gap: 14px; font-size: 22px; color: #6B7280; }
  .titik { width: 18px; height: 18px; border-radius: 999px; }
</style>
<div class="garis"></div>
<div class="merek">${TANDA}<div class="nama">landai</div></div>
<div class="judul">Peta aksesibilitas tempat umum, diisi warga</div>
<div class="sub">Cari tahu apakah sebuah tempat bisa Anda akses, sebelum berangkat ke sana.</div>
<div class="kaki">
  <span class="titik" style="background:#639922"></span>
  <span class="titik" style="background:#BA7517"></span>
  <span class="titik" style="background:#E24B4A"></span>
  <span>Skor aksesibilitas dari delapan fasilitas</span>
</div>
`)
await og.evaluate(() => document.fonts.ready)
await og.waitForTimeout(900)
await og.screenshot({ path: join(AKAR, 'public', 'og.png') })
await og.close()

// ---------- ikon raster untuk perangkat yang tidak menerima SVG ----------
for (const [nama, ukuran] of [['apple-touch-icon.png', 180], ['favicon-32.png', 32]]) {
  const p = await browser.newPage({ viewport: { width: ukuran, height: ukuran }, deviceScaleFactor: 1 })
  await p.setContent(`
    <style>*{margin:0}body{width:${ukuran}px;height:${ukuran}px}svg{width:${ukuran}px;height:${ukuran}px;display:block}</style>
    ${TANDA}`)
  await p.waitForTimeout(200)
  await p.screenshot({ path: join(AKAR, 'public', nama), omitBackground: true })
  await p.close()
  console.log(`  ${nama} ${ukuran}x${ukuran}`)
}

await browser.close()
console.log('  og.png 1200x630')
