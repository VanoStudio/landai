<script setup lang="ts">
// Halaman pendaratan setelah user mengklik tautan konfirmasi email.
// @nuxtjs/supabase yang menukar kode jadi sesi; di sini cukup menunggu
// user terisi lalu memindahkan ke peta.
const user = useSupabaseUser()

watchEffect(() => {
  if (user.value) navigateTo('/', { replace: true })
})
</script>

<template>
  <main class="mx-auto max-w-sm p-6">
    <p class="text-sm text-gray-600">Mengaktifkan akun, tunggu sebentar.</p>
  </main>
</template>
