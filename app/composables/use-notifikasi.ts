// Notifikasi singkat, satu antrean untuk seluruh aplikasi.

export interface Notifikasi {
  id: number
  pesan: string
  jenis: 'galat' | 'info'
}

/* Cukup lama untuk dibaca satu kalimat, cukup singkat untuk tidak menghalangi. */
export const DURASI_NOTIFIKASI = 4000

let urut = 0

export function useNotifikasi() {
  const daftar = useState<Notifikasi[]>('notifikasi', () => [])

  function tutup(id: number) {
    daftar.value = daftar.value.filter(n => n.id !== id)
  }

  function tampilkan(pesan: string, jenis: Notifikasi['jenis'] = 'info') {
    const bersih = pesan?.trim()
    if (!bersih) return

    // Pesan yang sama, misalnya karena tombol ditekan dua kali, tidak menumpuk jadi dua kartu.
    // Yang lama dibuang supaya hitungan waktunya dimulai ulang.
    daftar.value = [...daftar.value.filter(n => n.pesan !== bersih), { id: ++urut, pesan: bersih, jenis }]

    if (import.meta.client) {
      const id = urut
      setTimeout(() => tutup(id), DURASI_NOTIFIKASI)
    }
  }

  return { daftar, tampilkan, tutup }
}
