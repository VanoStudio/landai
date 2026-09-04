<script setup lang="ts">
// Tombol masuk dengan Google. Dipakai di halaman masuk dan halaman daftar, karena
// pada alur OAuth keduanya adalah tindakan yang sama: Supabase membuat akun kalau
// belum ada, dan trigger handle_new_user yang sudah ada tetap yang mengisi baris
// profil, persis seperti pendaftaran lewat email.

const supabase = useSupabaseClient()
const { providerAktif } = useProviderAuth()

const memuat = ref(false)
const pesanError = ref('')

async function masukGoogle() {
  pesanError.value = ''
  memuat.value = true

  try {
    // Diperiksa lebih dulu. Tanpa ini, provider yang mati membuat pengguna mendarat
    // di halaman JSON mentah tanpa penjelasan apa pun.
    if (!(await providerAktif('google'))) {
      pesanError.value = terjemahkanError('Unsupported provider: provider is not enabled')
      return
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/konfirmasi` },
    })

    if (error) pesanError.value = terjemahkanError(error.message)
  }
  catch (e: any) {
    pesanError.value = terjemahkanError(e?.message ?? '')
  }
  finally {
    memuat.value = false
  }
}
</script>

<template>
  <div>
    <button
      type="button" :disabled="memuat"
      class="flex h-11 w-full items-center justify-center gap-2.5 rounded border border-gray-400 bg-white px-4 font-medium text-gray-800 hover:border-gray-600 disabled:opacity-50"
      @click="masukGoogle"
    >
      <!-- Lambang Google resmi, empat warna, dipakai apa adanya sesuai ketentuan
           mereknya. Ini satu-satunya tempat warna di luar palet aplikasi muncul,
           dan alasannya kepatuhan merek pihak ketiga, bukan pilihan desain. -->
      <svg viewBox="0 0 18 18" class="h-5 w-5 shrink-0" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
      </svg>
      {{ memuat ? 'Menghubungkan' : 'Masuk dengan Google' }}
    </button>

    <p v-if="pesanError" role="alert" class="mt-2 text-sm text-skor-kurang">{{ pesanError }}</p>
  </div>
</template>
