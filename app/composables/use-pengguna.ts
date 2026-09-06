// @nuxtjs/supabase 2.0.10 mengisi useSupabaseUser() dengan dua bentuk berbeda: di sisi
// server berupa objek User dari Supabase, yang punya `id`; di sisi klien berupa klaim JWT
// hasil getClaims(), yang punya `sub` dan sama sekali tidak punya `id`.
export function useIdPengguna() {
  const user = useSupabaseUser()

  return computed<string | null>(() => {
    const u = user.value as Record<string, any> | null
    return u?.sub ?? u?.id ?? null
  })
}
