// Alat bantu untuk peringatan lokasi kemungkinan duplikat. Dua syarat harus terpenuhi
// bersamaan sebelum peringatan muncul: titiknya berdekatan DAN namanya mirip.

/* Jarak dua titik di permukaan bumi, dalam meter. Rumus haversine. */
export function jarakMeter(
  a: { lat: number, lng: number },
  b: { lat: number, lng: number },
): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

// Huruf kecil, tanda baca dibuang, spasi dirapatkan. Tanpa ini "Blok M Plaza" dan "Blok-M
// Plaza." terbaca sebagai dua nama yang berbeda jauh.
function rapikan(teks: string): string {
  return teks
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* Jarak Levenshtein, memakai dua baris saja supaya tidak menyimpan matriks penuh. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let sebelum = Array.from({ length: b.length + 1 }, (_, i) => i)
  let sekarang = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    sekarang[0] = i
    for (let j = 1; j <= b.length; j++) {
      const biaya = a[i - 1] === b[j - 1] ? 0 : 1
      sekarang[j] = Math.min(
        sekarang[j - 1]! + 1,
        sebelum[j]! + 1,
        sebelum[j - 1]! + biaya,
      )
    }
    const tukar = sebelum
    sebelum = sekarang
    sekarang = tukar
  }

  return sebelum[b.length]!
}

function ternormalisasi(x: string, y: string): number {
  if (x === y) return 1
  const panjang = Math.max(x.length, y.length)
  if (panjang === 0) return 0
  return 1 - levenshtein(x, y) / panjang
}

/* Kata diurutkan supaya susunan yang berbeda tidak dihukum. */
function urutkanKata(teks: string): string {
  return teks.split(' ').sort().join(' ')
}

/* Kemiripan dua nama, 0 sampai 1. Diambil nilai terbesar antara Levenshtein ternormalisasi
   apa adanya dan Levenshtein atas kata yang sudah diurutkan. */
export function kemiripanNama(a: string, b: string): number {
  const x = rapikan(a)
  const y = rapikan(b)
  if (!x || !y) return 0
  return Math.max(ternormalisasi(x, y), ternormalisasi(urutkanKata(x), urutkanKata(y)))
}

/* Ambang kemiripan. Setengah, sesuai keputusan produk. */
export const AMBANG_MIRIP = 0.5

/* Panjang minimum agar pemuatan nama dianggap berarti. */
const MINIMUM_TERMUAT = 4

/* Dua nama dianggap mirip kalau kemiripannya melewati ambang, ATAU salah satunya termuat
   penuh di dalam yang lain. */
export function namanyaMirip(a: string, b: string): boolean {
  const x = rapikan(a)
  const y = rapikan(b)
  if (!x || !y) return false

  const pendek = x.length <= y.length ? x : y
  const panjang = pendek === x ? y : x
  if (pendek.length >= MINIMUM_TERMUAT && panjang.includes(pendek)) return true

  return kemiripanNama(a, b) >= AMBANG_MIRIP
}

/* Radius pemeriksaan duplikat, dalam meter. */
export const RADIUS_DUPLIKAT = 40
