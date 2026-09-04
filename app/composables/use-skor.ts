// Skor 0-100 selalu kelipatan 12,5 karena checklist 8 item.
// Ambang tiga tingkat: baik 5+/8, sedang 3-4/8, kurang 0-2/8.
export type TingkatSkor = 'baik' | 'sedang' | 'kurang'

export function tingkatSkor(skor: number): TingkatSkor {
  if (skor >= 63) return 'baik'
  if (skor >= 38) return 'sedang'
  return 'kurang'
}

// Nilai hex, bukan class Tailwind, karena marker MapLibre dirender di luar Vue.
export const WARNA_SKOR: Record<TingkatSkor, string> = {
  baik: '#639922',
  sedang: '#BA7517',
  kurang: '#E24B4A',
}

export const LABEL_SKOR: Record<TingkatSkor, string> = {
  baik: 'Ramah akses',
  sedang: 'Sebagian ramah',
  kurang: 'Belum ramah',
}

export function warnaSkor(skor: number): string {
  return WARNA_SKOR[tingkatSkor(skor)]
}

export function labelSkor(skor: number): string {
  return LABEL_SKOR[tingkatSkor(skor)]
}
