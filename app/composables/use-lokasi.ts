import type { KategoriLokasi, StatusLokasi } from '~/types/database.types'

export interface LokasiPeta {
  id: string
  nama: string
  kategori: KategoriLokasi
  lat: number
  lng: number
  skor: number
  status: StatusLokasi
  ramp_tersedia: boolean
  guiding_block_tersambung: boolean
  tempat_duduk_tersedia: boolean
  lift_tersedia_berfungsi: boolean
  /** Foto pertama, dipakai sebagai gambar kecil di kartu ringkas. */
  foto_utama: string | null
  /** Jumlah warga yang menyatakan data ini masih akurat. */
  jumlah_akurat: number
  /** Jumlah warga yang menyatakan kondisinya sudah berubah. */
  jumlah_berubah: number
}

export type Kebutuhan = 'kursi_roda' | 'tunanetra' | 'lansia_stroller'

export const LABEL_KEBUTUHAN: Record<Kebutuhan, string> = {
  kursi_roda: 'Kursi roda',
  tunanetra: 'Tunanetra',
  lansia_stroller: 'Lansia atau stroller',
}

// Pemetaan filter ke checklist, PRD bagian 6.
export function cocokKebutuhan(l: LokasiPeta, k: Kebutuhan): boolean {
  if (k === 'kursi_roda') return l.ramp_tersedia
  if (k === 'tunanetra') return l.guiding_block_tersambung
  return l.tempat_duduk_tersedia || l.lift_tersedia_berfungsi
}

// Sembilan jenis tempat, digeneralkan di schema-patch-7.sql. Urutannya adalah
// urutan tampil pada formulir, disusun dari yang paling sering disurvei.
export const LABEL_KATEGORI: Record<KategoriLokasi, string> = {
  transportasi_umum: 'Transportasi umum',
  perbelanjaan: 'Pusat perbelanjaan',
  kantor_layanan: 'Kantor layanan publik',
  kesehatan: 'Fasilitas kesehatan',
  pendidikan: 'Pendidikan',
  ibadah: 'Tempat ibadah',
  ruang_publik: 'Taman dan ruang publik',
  kuliner: 'Rumah makan dan kafe',
  lainnya: 'Lainnya',
}

// Contoh yang muncul di bawah tiap pilihan pada formulir. Tanpa ini, "Transportasi
// umum" mudah dikira hanya kereta, dan halte kembali jatuh ke "Lainnya" seperti
// sebelum tambalan ini ada.
export const CONTOH_KATEGORI: Record<KategoriLokasi, string> = {
  transportasi_umum: 'Halte, stasiun, terminal',
  perbelanjaan: 'Mal, pasar, pertokoan',
  kantor_layanan: 'Kelurahan, kecamatan, kantor pos',
  kesehatan: 'Rumah sakit, puskesmas, klinik',
  pendidikan: 'Sekolah, kampus, perpustakaan',
  ibadah: 'Masjid, gereja, pura, vihara',
  ruang_publik: 'Taman, alun-alun, trotoar',
  kuliner: 'Rumah makan, kafe, warung',
  lainnya: 'Tidak masuk kategori mana pun',
}

export const KATEGORI_PILIHAN = Object.keys(LABEL_KATEGORI) as KategoriLokasi[]

// Baris lama yang belum ikut dipindahkan tambalan tetap punya tulisan yang masuk
// akal, bukan kolom kosong. Jaring pengaman, bukan jalur yang diharapkan terpakai.
const PADANAN_LAMA: Record<string, KategoriLokasi> = {
  stasiun: 'transportasi_umum',
  mal: 'perbelanjaan',
  kantor_pemerintah: 'kantor_layanan',
  taman: 'ruang_publik',
}

export function labelKategori(k: string | null | undefined): string {
  if (!k) return LABEL_KATEGORI.lainnya
  return LABEL_KATEGORI[(PADANAN_LAMA[k] ?? k) as KategoriLokasi] ?? LABEL_KATEGORI.lainnya
}

// Lebih banyak laporan "sudah berubah" daripada "masih akurat". Dipakai bersama oleh
// kartu ringkas dan halaman detail supaya ambangnya tidak ditulis dua kali.
export function perluDiperbarui(l: { jumlah_akurat: number, jumlah_berubah: number }): boolean {
  return l.jumlah_berubah > l.jumlah_akurat && l.jumlah_berubah > 0
}

export function useDaftarLokasi() {
  const supabase = useSupabaseClient()

  return useAsyncData<LokasiPeta[]>('daftar-lokasi', async () => {
    const { data, error } = await supabase
    .from('locations')
    .select(`
      id, nama, kategori, lat, lng, skor, status,
      accessibility_checklist (
        ramp_tersedia, guiding_block_tersambung,
        tempat_duduk_tersedia, lift_tersedia_berfungsi
      ),
      location_photos ( photo_url ),
      confirmations ( is_accurate )
    `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // PostgREST mengembalikan relasi sebagai objek atau array tergantung
    // inferensi kardinalitas. Diratakan di sini supaya komponen tidak perlu tahu.
    return (data ?? []).map((baris: any) => {
      const c = Array.isArray(baris.accessibility_checklist)
        ? baris.accessibility_checklist[0]
        : baris.accessibility_checklist

      const foto = Array.isArray(baris.location_photos) ? baris.location_photos : []

      // Konfirmasi ikut diambil dalam kueri yang sama, bukan lewat permintaan kedua:
      // jumlahnya puluhan baris, dan memisahkannya berarti dua perjalanan jaringan
      // untuk satu tampilan. Dihitung di sini karena PostgREST tidak bisa memberi dua
      // agregat dengan penyaring berbeda dalam satu kueri.
      const konfirmasi = Array.isArray(baris.confirmations) ? baris.confirmations : []
      const akurat = konfirmasi.filter((k: any) => k.is_accurate).length

      return {
        id: baris.id,
        nama: baris.nama,
        kategori: baris.kategori,
        lat: baris.lat,
        lng: baris.lng,
        skor: baris.skor ?? 0,
        status: baris.status,
        ramp_tersedia: c?.ramp_tersedia ?? false,
        guiding_block_tersambung: c?.guiding_block_tersambung ?? false,
        tempat_duduk_tersedia: c?.tempat_duduk_tersedia ?? false,
        lift_tersedia_berfungsi: c?.lift_tersedia_berfungsi ?? false,
        foto_utama: foto[0]?.photo_url ?? null,
        jumlah_akurat: akurat,
        jumlah_berubah: konfirmasi.length - akurat,
      }
    })
  }, { default: () => [] })
}
