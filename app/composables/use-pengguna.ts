// @nuxtjs/supabase 2.0.10 mengisi useSupabaseUser() dengan dua bentuk berbeda:
// di sisi server berupa objek User dari Supabase, yang punya `id`; di sisi klien
// berupa klaim JWT hasil getClaims(), yang punya `sub` dan sama sekali tidak punya
// `id`. Membaca `.id` langsung akan bernilai undefined begitu halaman terhidrasi.
//
// Akibatnya tidak kelihatan sebagai error: kolom pemilik hilang dari badan
// permintaan, baris masuk dengan pemilik kosong, lalu Row Level Security
// menolaknya dengan pesan yang seolah menuduh policy-nya salah.
//
// Satu tempat membaca id pengguna, menerima kedua bentuk.
export function useIdPengguna() {
  const user = useSupabaseUser()

  return computed<string | null>(() => {
    const u = user.value as Record<string, any> | null
    return u?.sub ?? u?.id ?? null
  })
}
