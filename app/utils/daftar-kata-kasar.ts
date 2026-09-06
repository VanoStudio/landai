// Daftar kata untuk peringatan isi kasar pada formulir kontribusi. Berkas ini sengaja
// dipisah dari logika penyaringnya supaya menambah kata tidak perlu menyentuh kode sama
// sekali.

// Kata yang tidak punya arti sah lain dalam nama tempat maupun catatan lapangan.
// Kemunculannya selalu ditandai.
export const KATA_KASAR: string[] = [
  // seksual
  'kontol', 'memek', 'pepek', 'peler', 'titit', 'jembut', 'ngentot', 'entot',
  'ngewe', 'kimak', 'pukimak', 'cukimai', 'cukimay', 'ngaceng',
  // umpatan keras
  'bangsat', 'bajingan', 'keparat', 'brengsek', 'jancok', 'jancuk', 'jancik',
  'asu', 'anjir', 'anjay', 'anjrit', 'njing', 'kampret', 'ngehe', 'sialan',
  'laknat', 'bacot', 'taik',
  // merendahkan kemampuan
  'goblok', 'goblog', 'tolol', 'bego', 'dungu', 'sinting', 'idiot',
]

// Kata yang JUGA merupakan kata biasa. "Klinik Hewan Anjing dan Kucing" dan "Sate Babi Pak
// Kumis" adalah nama tempat yang sah, begitu pula "Curug Setan".
export const KATA_KASAR_BERKONTEKS: string[] = [
  'anjing', 'anjeng', 'babi', 'monyet', 'setan', 'iblis',
]

// Penanda bahwa kata di atas sedang dipakai dalam arti sebenarnya: klinik hewan, rumah
// makan, atau nama tempat wisata.
export const PENANDA_KONTEKS_WAJAR: string[] = [
  // hewan sebagai hewan
  'klinik', 'hewan', 'dokter', 'peternakan', 'ternak', 'kandang', 'pakan',
  'petshop', 'grooming', 'vaksin', 'penitipan', 'shelter', 'satwa', 'binatang',
  // hewan sebagai makanan
  'sate', 'satai', 'guling', 'panggang', 'rica', 'kecap', 'warung', 'rumah',
  'makan', 'restoran', 'resto', 'kedai', 'lawar',
  // nama tempat dan wisata
  'gunung', 'pantai', 'curug', 'goa', 'gua', 'bukit', 'jembatan', 'air',
  'terjun', 'wisata', 'kebun', 'taman', 'safari', 'pasar',
]
