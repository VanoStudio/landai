import { chromium } from 'playwright'

const BASIS = 'http://localhost:3000'
const langkah = []
const catat = (n, l, k = '') => { langkah.push(l); console.log(`  ${l ? 'LOLOS' : 'GAGAL'}  ${n}${k ? '  ' + k : ''}`) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

await page.goto(`${BASIS}/masuk`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

await page.evaluate(() => {
  [...document.querySelectorAll('button')].find(x => x.textContent.includes('Masuk dengan Google'))?.click()
})
await page.waitForTimeout(6000)

const alamat = page.url()
const keGoogle = alamat.includes('accounts.google.com')
catat('Tombol mengalihkan ke layar izin Google', keGoogle, alamat.slice(0, 72))

if (keGoogle) {
  const u = new URL(alamat)
  const balik = u.searchParams.get('redirect_uri')
  catat('redirect_uri menunjuk ke callback Supabase',
    balik === 'https://eagvqtumjcwzaefbriiq.supabase.co/auth/v1/callback', balik ?? '-')
  catat('Scope meminta email dan profil', (u.searchParams.get('scope') ?? '').includes('email'),
    u.searchParams.get('scope') ?? '-')
  // Google memindahkan parameter aslinya ke dalam opparams setelah rantai
  // pengalihannya sendiri, jadi dicari di seluruh alamat, bukan di query teratas.
  const utuh = decodeURIComponent(decodeURIComponent(alamat))
  const cocok = utuh.match(/redirect_to=([^&\s]+)/)
  const tujuan = cocok ? decodeURIComponent(cocok[1]) : null
  catat('Aplikasi pulang ke halaman konfirmasi', (tujuan ?? '').includes('/konfirmasi'), tujuan ?? '-')
}

await browser.close()
const gagal = langkah.filter(l => !l).length
console.log(`\n${langkah.length - gagal} dari ${langkah.length} pemeriksaan lolos`)
if (gagal) process.exitCode = 1
