// Profil pengguna yang sedang masuk.
//
// Dipisah ke composable, bukan ditulis ulang di tiap halaman, karena kuncinya harus
// sama persis di mana pun: useAsyncData berbagi keadaan lewat kunci, jadi menu akun di
// header dan halaman akun memakai satu hasil yang sama, bukan dua permintaan yang
// bisa saling menyalip lalu menampilkan nama yang berbeda di dua tempat.
export function useProfilSaya() {
  const supabase = useSupabaseClient()
  const idPengguna = useIdPengguna()

  return useAsyncData<{ id: string, nama: string | null } | null>(
    () => `profil-${idPengguna.value ?? 'tamu'}`,
    async () => {
      if (!idPengguna.value) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nama')
        .eq('id', idPengguna.value)
        .maybeSingle()
      if (error) throw error
      return data as any
    },
    { watch: [idPengguna] },
  )
}
