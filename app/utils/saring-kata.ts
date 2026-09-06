// Penyaring isi kasar untuk formulir kontribusi. Seluruhnya berjalan di peramban: tanpa
// API luar, tanpa panggilan server, tanpa perubahan skema.

import {
  KATA_KASAR,
  KATA_KASAR_BERKONTEKS,
  PENANDA_KONTEKS_WAJAR,
} from './daftar-kata-kasar'

// Pemetaan leetspeak yang lazim. Sengaja hanya angka dan dua simbol yang memang dipakai
// sebagai pengganti huruf.
const PETA_LEET: Record<string, string> = {
  4: 'a', '@': 'a', 3: 'e', 1: 'i', 0: 'o', 5: 's', $: 's',
}

// Kata gabungan hanya diperiksa untuk entri sepanjang ini ke atas. Menggabungkan dua kata
// pendek yang bersebelahan terlalu mudah menghasilkan kebetulan.
const PANJANG_MINIMAL_GABUNGAN = 5

// Seberapa dekat penanda konteks harus berada supaya sebuah kata dianggap dipakai dalam
// arti sebenarnya.
const JANGKAUAN_KONTEKS = 3

function terjemahkanLeet(s: string): string {
  let keluar = ''
  for (const c of s) keluar += PETA_LEET[c] ?? c
  return keluar
}

// Huruf berulang dirapatkan jadi satu, bukan tiga jadi satu.
function rapatkanUlangan(s: string): string {
  return s.replace(/(.)\1+/g, '$1')
}

function hurufSaja(s: string): string {
  return s.replace(/[^a-z]/g, '')
}

function bakukan(s: string): string {
  return rapatkanUlangan(hurufSaja(terjemahkanLeet(s.toLowerCase())))
}

// Satu kata menghasilkan dua bentuk baku, dan keduanya perlu. Bentuk pertama memangkas
// tanda baca di ujung lebih dulu, supaya "anjing@@@" tidak berubah jadi "anjinga".
function bentukKata(kata: string): string[] {
  const dipangkas = kata.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '')
  const a = bakukan(dipangkas)
  const b = bakukan(kata)
  return a === b ? [a] : [a, b]
}

function pecah(teks: string): string[] {
  return String(teks ?? '').toLowerCase().split(/\s+/).filter(Boolean)
}

/* Membakukan teks: huruf kecil, leetspeak diterjemahkan, tanda baca penghubung dibuang,
   huruf berulang dirapatkan. */
export function normalizeText(text: string): string {
  return pecah(text).map(k => bentukKata(k)[0]).filter(Boolean).join(' ')
}

// Daftar kata ikut dibakukan dengan aturan yang sama, sekali saat modul dimuat.
const petaKasar = new Map(KATA_KASAR.map(k => [bakukan(k), k]))
const petaKasarBerkonteks = new Map(KATA_KASAR_BERKONTEKS.map(k => [bakukan(k), k]))
const penandaKonteks = new Set(PENANDA_KONTEKS_WAJAR.map(bakukan))

function adaPenandaDekat(kata: string[], posisi: number): boolean {
  const dari = Math.max(0, posisi - JANGKAUAN_KONTEKS)
  const sampai = Math.min(kata.length - 1, posisi + JANGKAUAN_KONTEKS)
  for (let i = dari; i <= sampai; i++) {
    if (i !== posisi && penandaKonteks.has(kata[i] ?? '')) return true
  }
  return false
}

export interface HasilSaringan {
  isToxic: boolean
  matchedWords: string[]
}

/* Memeriksa sebuah teks terhadap daftar kata kasar. */
export function detectToxicWords(text: string): HasilSaringan {
  const kata = pecah(text)
  if (kata.length === 0) return { isToxic: false, matchedWords: [] }

  const bentuk = kata.map(bentukKata)
  const utama = bentuk.map(b => b[0] ?? '')
  const ketemu = new Set<string>()

  const catatKalauCocok = (bakuan: string, posisi: number) => {
    if (!bakuan) return
    const langsung = petaKasar.get(bakuan)
    if (langsung) { ketemu.add(langsung); return }

    const berkonteks = petaKasarBerkonteks.get(bakuan)
    if (berkonteks && !adaPenandaDekat(utama, posisi)) ketemu.add(berkonteks)
  }

  bentuk.forEach((bentukan, i) => bentukan.forEach(b => catatKalauCocok(b, i)))

  // Menyisipkan spasi di tengah kata adalah cara penyamaran yang paling sering dipakai, jadi
  // setiap pasangan kata bersebelahan ikut diperiksa sebagai satu kata.
  for (let i = 0; i < utama.length - 1; i++) {
    const gabungan = (utama[i] ?? '') + (utama[i + 1] ?? '')
    if (gabungan.length < PANJANG_MINIMAL_GABUNGAN) continue
    catatKalauCocok(gabungan, i)
  }

  const matchedWords = [...ketemu]
  return { isToxic: matchedWords.length > 0, matchedWords }
}

/* Menyamarkan bagian tengah kata untuk ditampilkan di layar. Peringatannya perlu menyebut
   kata mana yang terpicu supaya bisa ditindaklanjuti, tapi tidak perlu menuliskannya ulang
   secara utuh. */
export function sensorKata(kata: string): string {
  if (kata.length <= 2) return kata[0] + '*'
  return kata[0] + '*'.repeat(kata.length - 2) + kata[kata.length - 1]
}
