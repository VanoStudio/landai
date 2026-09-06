// Tipe database, ditulis manual mengikuti schema.sql + schema-patch.sql.
// Dipakai otomatis oleh @nuxtjs/supabase supaya query salah kolom ketahuan
// saat menulis kode, bukan saat demo.

// Sembilan jenis sejak schema-patch-7.sql. Digeneralkan setelah survei pertama
// memperlihatkan masalahnya: empat halte bus terpaksa dicatat sebagai "lainnya"
// karena satu-satunya pilihan transportasi adalah "stasiun".
//
// Nilai lama masih diterima batasan basis data supaya tidak ada jendela waktu yang
// gagal saat tambalan dan kode ter-deploy tidak bersamaan, tetapi antarmuka tidak
// pernah mengirimnya lagi, jadi tidak ikut ditulis di tipe ini.
export type KategoriLokasi =
  | 'transportasi_umum'
  | 'perbelanjaan'
  | 'kantor_layanan'
  | 'kesehatan'
  | 'pendidikan'
  | 'ibadah'
  | 'ruang_publik'
  | 'kuliner'
  | 'lainnya'

export type StatusLokasi = 'belum_terverifikasi' | 'terverifikasi'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; nama: string | null; created_at: string }
        Insert: { id: string; nama?: string | null; created_at?: string }
        Update: { id?: string; nama?: string | null; created_at?: string }
        Relationships: []
      }
      locations: {
        Row: {
          id: string
          nama: string
          kategori: KategoriLokasi
          lat: number
          lng: number
          skor: number
          status: StatusLokasi
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nama: string
          kategori: KategoriLokasi
          lat: number
          lng: number
          skor?: number
          status?: StatusLokasi
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['locations']['Insert']>
        Relationships: []
      }
      accessibility_checklist: {
        Row: {
          location_id: string
          ramp_tersedia: boolean
          lebar_pintu_cukup: boolean
          toilet_difabel: boolean
          parkir_difabel: boolean
          lift_tersedia_berfungsi: boolean
          guiding_block_tersambung: boolean
          tempat_duduk_tersedia: boolean
          permukaan_jalan_rata: boolean
          catatan: string | null
        }
        Insert: {
          location_id: string
          ramp_tersedia?: boolean
          lebar_pintu_cukup?: boolean
          toilet_difabel?: boolean
          parkir_difabel?: boolean
          lift_tersedia_berfungsi?: boolean
          guiding_block_tersambung?: boolean
          tempat_duduk_tersedia?: boolean
          permukaan_jalan_rata?: boolean
          catatan?: string | null
        }
        Update: Partial<Database['public']['Tables']['accessibility_checklist']['Insert']>
        Relationships: []
      }
      location_photos: {
        Row: { id: string; location_id: string; photo_url: string; created_at: string }
        Insert: { id?: string; location_id: string; photo_url: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['location_photos']['Insert']>
        Relationships: []
      }
      confirmations: {
        Row: {
          id: string
          location_id: string
          user_id: string
          is_accurate: boolean
          created_at: string
        }
        Insert: {
          id?: string
          location_id: string
          user_id: string
          is_accurate: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['confirmations']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
