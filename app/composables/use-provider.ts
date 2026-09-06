// Supabase menyiarkan daftar provider yang aktif lewat /auth/v1/settings, endpoint publik
// yang hanya butuh kunci publishable.

interface SetelanAuth {
  external?: Record<string, boolean>
}

let tersimpan: Record<string, boolean> | null = null

export function useProviderAuth() {
  const config = useRuntimeConfig()

  async function daftarProvider(): Promise<Record<string, boolean>> {
    if (tersimpan) return tersimpan

    const { url, key } = config.public.supabase as { url: string, key: string }
    const setelan = await $fetch<SetelanAuth>(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      timeout: 8000,
    })

    tersimpan = setelan.external ?? {}
    return tersimpan
  }

  async function providerAktif(nama: string): Promise<boolean> {
    try {
      return (await daftarProvider())[nama] === true
    }
    catch {
      // Kalau pemeriksaannya sendiri gagal, jangan menghalangi pengguna. Biarkan percobaan masuk
      // berjalan dan galatnya ditangani di halaman pendaratan.
      return true
    }
  }

  return { providerAktif }
}
