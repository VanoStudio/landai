import type { Database } from '~/types/database.types'

export type KunciChecklist =
  | 'ramp_tersedia'
  | 'lebar_pintu_cukup'
  | 'toilet_difabel'
  | 'parkir_difabel'
  | 'lift_tersedia_berfungsi'
  | 'guiding_block_tersambung'
  | 'tempat_duduk_tersedia'
  | 'permukaan_jalan_rata'

export type IsiChecklist = Record<KunciChecklist, boolean>

// Kalimat bantuan ditulis untuk orang yang berdiri di lokasi sambil memegang HP,
// bukan untuk pembaca dokumen. Pendek, konkret, bisa dicek mata.
export const ITEM_CHECKLIST: { kunci: KunciChecklist, label: string, bantuan: string }[] = [
  { kunci: 'ramp_tersedia', label: 'Ramp tersedia', bantuan: 'Ada jalur landai ke pintu masuk, bukan cuma tangga.' },
  { kunci: 'lebar_pintu_cukup', label: 'Pintu cukup lebar', bantuan: 'Kursi roda bisa lewat tanpa dimiringkan, kira-kira 80 cm.' },
  { kunci: 'toilet_difabel', label: 'Toilet difabel', bantuan: 'Ada toilet dengan pegangan dan ruang putar kursi roda.' },
  { kunci: 'parkir_difabel', label: 'Parkir difabel', bantuan: 'Ada petak parkir bertanda kursi roda dekat pintu masuk.' },
  { kunci: 'lift_tersedia_berfungsi', label: 'Lift ada dan menyala', bantuan: 'Kalau bertingkat, lift benar-benar berfungsi saat dicek.' },
  { kunci: 'guiding_block_tersambung', label: 'Guiding block tersambung', bantuan: 'Jalur ubin kuning tidak terputus dan tidak terhalang.' },
  { kunci: 'tempat_duduk_tersedia', label: 'Tempat duduk tersedia', bantuan: 'Ada kursi atau bangku untuk istirahat sebentar.' },
  { kunci: 'permukaan_jalan_rata', label: 'Permukaan jalan rata', bantuan: 'Tidak banyak lubang, gundukan, atau trotoar rusak.' },
]

export function checklistKosong(): IsiChecklist {
  return Object.fromEntries(ITEM_CHECKLIST.map(i => [i.kunci, false])) as IsiChecklist
}

// Skor sebenarnya dihitung trigger di database. Ini hanya pratinjau supaya
// kontributor melihat dampak jawabannya saat mengisi.
export function pratinjauSkor(isi: IsiChecklist): number {
  const total = ITEM_CHECKLIST.filter(i => isi[i.kunci]).length
  return Math.round((total / ITEM_CHECKLIST.length) * 100)
}

// Daftar jenis tempat pindah ke use-lokasi.ts, berdampingan dengan label dan
// contohnya, supaya kunci dan tulisannya tidak pernah lagi hidup di dua berkas
// terpisah yang bisa berbeda diam-diam.
