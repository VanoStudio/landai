export function useKeluar() {
  const supabase = useSupabaseClient()

  return async function keluar() {
    await supabase.auth.signOut()
    await navigateTo('/', { replace: true })
  }
}
