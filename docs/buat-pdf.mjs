import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const browser = await chromium.launch()
const page = await browser.newPage()

const galat = []
page.on('console', m => { if (m.type() === 'error') galat.push(m.text().slice(0, 120)) })
page.on('requestfailed', r => galat.push('gagal muat: ' + r.url().slice(-70)))

await page.goto(pathToFileURL(resolve('laporan.html')).href, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(1500)

const gambarRusak = await page.evaluate(() =>
  [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src')),
)

await page.pdf({
  path: process.argv[2],
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `
    <div style="width:100%;font-family:sans-serif;font-size:7pt;color:#6B7280;
                padding:0 20mm;display:flex;justify-content:space-between;">
      <span>landai &mdash; laporan progres pengembangan</span>
      <span class="pageNumber"></span>
    </div>`,
  margin: { top: '18mm', bottom: '16mm', left: '20mm', right: '20mm' },
})

await browser.close()

console.log('gambar rusak :', gambarRusak.length ? gambarRusak.join(', ') : 'tidak ada')
console.log('galat halaman:', galat.length ? galat.join(' | ') : 'tidak ada')
