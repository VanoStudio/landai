// Profil pengguna yang sedang masuk.
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
