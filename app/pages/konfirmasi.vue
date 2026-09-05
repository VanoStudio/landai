<script setup lang="ts">
// Halaman pendaratan setelah pengguna kembali dari tautan konfirmasi email atau
// dari alur Google. @nuxtjs/supabase yang menukar kode jadi sesi; di sini cukup
// menunggu user terisi lalu memindahkan ke peta.
//
// Kalau yang datang justru kegagalan, penyebabnya harus terbaca. Supabase menaruh
// keterangannya di query untuk sebagian galat dan di fragmen alamat untuk sebagian
// lain, jadi keduanya dibaca.
const user = useSupabaseUser()
const route = useRoute()

const pesanError = ref('')

function bacaGalat(): string {
  const dariQuery = (route.query.error_description || route.query.error) as string | undefined
  if (dariQuery) return dariQuery

  if (import.meta.client && window.location.hash) {
    const f = new URLSearchParams(window.location.hash.slice(1))
    return f.get('error_description') || f.get('error') || ''
  }
  return ''
}

onMounted(() => {
  const mentah = bacaGalat()
  if (mentah) pesanError.value = terjemahkanError(decodeURIComponent(mentah.replace(/\+/g, ' ')))
})

watchEffect(() => {
  if (user.value) navigateTo('/', { replace: true })
})

useHead({ title: 'Mengaktifkan Akun' })
</script>

<template>
  <main class="mx-auto max-w-sm p-6">
    <MerekLandai class="mb-6" :ukuran="26" ke="/" />

    <template v-if="pesanError">
      <h1 class="text-xl font-bold text-brand">Masuk tidak berhasil</h1>
      <p role="alert" class="mt-3 text-sm text-skor-kurang">{{ pesanError }}</p>

      <div class="mt-6 flex flex-wrap gap-3 text-sm">
        <NuxtLink
          to="/masuk"
          class="tombol tombol-utama"
        >Coba lagi</NuxtLink>
        <NuxtLink
          to="/"
          class="tombol tombol-sekunder"
        >Kembali ke peta</NuxtLink>
      </div>
    </template>

    <p v-else class="text-sm text-gray-600" role="status">Mengaktifkan akun, tunggu sebentar.</p>
  </main>
</template>
