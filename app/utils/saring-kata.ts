// Penyaring isi kasar untuk formulir kontribusi. Seluruhnya berjalan di peramban:
// tanpa API luar, tanpa panggilan server, tanpa perubahan skema. Daftar katanya ada
// di daftar-kata-kasar.ts.
//
// Yang dijaga berkas ini bukan cuma "menemukan kata kasar", melainkan TIDAK salah
// menuduh. Nama tempat sungguhan ditulis orang yang sedang berdiri di lapangan,
// sering dengan singkatan, angka, dan tanda baca. Peringatan palsu pada nama yang
// wajar lebih merugikan daripada satu umpatan yang lolos, karena ia membuat orang
// berhenti percaya pada peringatannya.
//
// Karena itu pencocokan dilakukan PER KATA UTUH, bukan per potongan. "Anjungan",
// "bangsal", dan "asuransi" tidak boleh tertangkap hanya karena mengandung huruf
// yang mirip.

import {
  KATA_KASAR,
  KATA_KASAR_BERKONTEKS,
  PENANDA_KONTEKS_WAJAR,
} from './daftar-kata-kasar'

// Pemetaan leetspeak yang lazim. Sengaja hanya angka dan dua simbol yang memang
// dipakai sebagai pengganti huruf. Tanda seru TIDAK dipetakan: "anjing!!!" jauh
// lebih sering muncul sebagai penekanan daripada sebagai penyamaran, dan
// memetakannya justru merusak pencocokan.
const PETA_LEET: Record<string, string> = {
  4: 'a', '@': 'a', 3: 'e', 1: 'i', 0: 'o', 5: 's', $: 's',
}

// Kata gabungan hanya diperiksa untuk entri sepanjang ini ke atas. Menggabungkan
// dua kata pendek yang bersebelahan terlalu mudah menghasilkan kebetulan.
const PANJANG_MINIMAL_GABUNGAN = 5

// Seberapa dekat penanda konteks harus berada supaya sebuah kata dianggap dipakai
// dalam arti sebenarnya. Tiga kata cukup untuk menutup "Klinik Hewan Anjing dan
// Kucing" tanpa ikut memaafkan umpatan yang kebetulan sekalimat dengan kata biasa.
const JANGKAUAN_KONTEKS = 3

function terjemahkanLeet(s: string): string {
  let keluar = ''
  for (const c of s) keluar += PETA_LEET[c] ?? c
  return keluar
}

// Huruf berulang dirapatkan jadi satu, bukan tiga jadi satu. Aturan yang lebih
// keras ini aman karena daftar katanya dinormalkan dengan aturan yang sama persis,
// jadi tidak ada entri yang berubah bentuk. Sebaliknya, aturan "tiga atau lebih"
// meloloskan "anjjir" yang hanya berulang dua kali.
function rapatkanUlangan(s: string): string {
  return s.replace(/(.)\1+/g, '$1')
}

function hurufSaja(s: string): string {
  return s.replace(/[^a-z]/g, '')
}

function bakukan(s: string): string {
  return rapatkanUlangan(hurufSaja(terjemahkanLeet(s.toLowerCase())))
}

// Satu kata menghasilkan dua bentuk baku, dan keduanya perlu.
//
// Bentuk pertama memangkas tanda baca di ujung lebih dulu, supaya "anjing@@@"
// tidak berubah jadi "anjinga". Bentuk kedua menerjemahkan leetspeak lebih dulu
// tanpa memangkas apa pun, supaya "@njing" tetap terbaca "anjing". Satu bentuk
// saja akan meloloskan salah satu dari keduanya.
function bentukKata(kata: string): string[] {
  const dipangkas = kata.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '')
  const a = bakukan(dipangkas)
  const b = bakukan(kata)
  return a === b ? [a] : [a, b]
}

function pecah(teks: string): string[] {
  return String(teks ?? '').toLowerCase().split(/\s+/).filter(Boolean)
}

/**
 * Membakukan teks: huruf kecil, leetspeak diterjemahkan, tanda baca penghubung
 * dibuang, huruf berulang dirapatkan. Spasi antar kata dipertahankan, karena
 * pencocokan dilakukan per kata utuh dan bukan per potongan.
 */
export function normalizeText(text: string): string {
  return pecah(text).map(k => bentukKata(k)[0]).filter(Boolean).join(' ')
}

// Daftar kata ikut dibakukan dengan aturan yang sama, sekali saat modul dimuat.
// Nilainya menyimpan ejaan asli, supaya yang dilaporkan ke pengguna adalah kata
// yang dikenalinya, bukan hasil normalisasi yang terlihat aneh.
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

/**
 * Memeriksa sebuah teks terhadap daftar kata kasar.
 *
 * Yang dikembalikan pada `matchedWords` adalah ejaan asli dari daftar, bukan
 * potongan teks pengguna, supaya banner peringatan tidak ikut menampilkan ulang
 * tulisan aslinya.
 */
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

  // Menyisipkan spasi di tengah kata adalah cara penyamaran yang paling sering
  // dipakai, jadi setiap pasangan kata bersebelahan ikut diperiksa sebagai satu
  // kata. Dibatasi pada entri yang cukup panjang supaya dua kata pendek yang
  // kebetulan bersebelahan tidak menghasilkan tuduhan.
  for (let i = 0; i < utama.length - 1; i++) {
    const gabungan = (utama[i] ?? '') + (utama[i + 1] ?? '')
    if (gabungan.length < PANJANG_MINIMAL_GABUNGAN) continue
    catatKalauCocok(gabungan, i)
  }

  const matchedWords = [...ketemu]
  return { isToxic: matchedWords.length > 0, matchedWords }
}

/**
 * Menyamarkan bagian tengah kata untuk ditampilkan di layar. Peringatannya perlu
 * menyebut kata mana yang terpicu supaya bisa ditindaklanjuti, tapi tidak perlu
 * menuliskannya ulang secara utuh.
 */
export function sensorKata(kata: string): string {
  if (kata.length <= 2) return kata[0] + '*'
  return kata[0] + '*'.repeat(kata.length - 2) + kata[kata.length - 1]
}
