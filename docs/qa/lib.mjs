// Perkakas bersama untuk sesi QA menyeluruh. Tidak dipakai aplikasi, hanya alat uji.
import { readFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const TANGKAPAN = path.join(AKAR, 'docs', 'tangkapan', 'qa')
mkdirSync(TANGKAPAN, { recursive: true })

export const env = (() => {
  const isi = readFileSync(path.join(AKAR, '.env'), 'utf8')
  const hasil = {}
  for (const baris of isi.split(/\r?\n/)) {
    const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) hasil[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return hasil
})()

export const BASE = process.env.QA_BASE || 'https://landai-zeta.vercel.app'
export const SUPABASE_URL = env.SUPABASE_URL
export const ANON = env.SUPABASE_KEY
export const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY || null

const CATATAN = path.join(TANGKAPAN, 'catatan-konsol.log')

export function catat(baris) {
  const teks = `[${new Date().toISOString()}] ${baris}\n`
  appendFileSync(CATATAN, teks)
  console.log(baris)
}

// Kumpulkan galat konsol dan galat halaman. Dipakai langkah 31.
export function pantauKonsol(page, label) {
  const galat = []
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text()
      galat.push({ label, jenis: 'console', teks: t })
      catat(`KONSOL-ERROR [${label}] ${t}`)
    }
  })
  page.on('pageerror', (e) => {
    galat.push({ label, jenis: 'pageerror', teks: String(e) })
    catat(`PAGE-ERROR [${label}] ${e}`)
  })
  page.on('requestfailed', (r) => {
    const g = r.failure()?.errorText || ''
    if (g.includes('ERR_ABORTED')) return
    galat.push({ label, jenis: 'requestfailed', teks: `${r.url()} ${g}` })
    catat(`REQ-FAILED [${label}] ${r.url()} ${g}`)
  })
  return galat
}

let urut = 0
export async function bidik(page, nama, opsi = {}) {
  urut += 1
  const berkas = path.join(TANGKAPAN, `${String(urut).padStart(2, '0')}-${nama}.png`)
  await page.screenshot({ path: berkas, fullPage: !!opsi.penuh })
  catat(`tangkapan: ${path.basename(berkas)}`)
  return berkas
}

// --- REST langsung ke Supabase, hanya untuk mengukur keadaan basis data ---
export async function rest(jalur, { token = ANON, kunci = ANON, ...init } = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${jalur}`, {
    ...init,
    headers: {
      apikey: kunci,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const teks = await r.text()
  let data = null
  try { data = teks ? JSON.parse(teks) : null } catch { data = teks }
  return { status: r.status, data }
}

export async function masukApi(email, sandi) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: sandi }),
  })
  return { status: r.status, data: await r.json() }
}

export const AKUN = (() => {
  const berkas = path.join(TANGKAPAN, 'akun-uji.json')
  if (existsSync(berkas)) return JSON.parse(readFileSync(berkas, 'utf8'))
  return null
})()

export const BERKAS_AKUN = path.join(TANGKAPAN, 'akun-uji.json')
