<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()

const email = ref('')
const password = ref('')
const memuat = ref(false)
const pesanError = ref('')

watchEffect(() => {
  if (user.value) navigateTo((route.query.redirect as string) || '/')
})

async function masuk() {
  pesanError.value = ''
  memuat.value = true
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  memuat.value = false

  if (error) {
    pesanError.value = terjemahkanError(error.message)
    return
  }
  await navigateTo((route.query.redirect as string) || '/')
}
</script>

<template>
  <main class="mx-auto max-w-sm p-6">
    <MerekLandai :ukuran="26" ke="/" />
    <h1 class="mt-6 text-xl font-bold text-brand">Masuk</h1>

    <form class="mt-6 space-y-4" @submit.prevent="masuk">
      <div>
        <label for="email" class="block text-sm font-medium">Email</label>
        <input id="email" v-model="email" type="email" required autocomplete="email"
          class="mt-1 min-h-11 w-full rounded border border-gray-400 px-3 py-2">
      </div>
      <div>
        <label for="password" class="block text-sm font-medium">Kata sandi</label>
        <input id="password" v-model="password" type="password" required
          autocomplete="current-password"
          class="mt-1 min-h-11 w-full rounded border border-gray-400 px-3 py-2">
      </div>

      <p v-if="pesanError" role="alert" class="text-sm text-skor-kurang">{{ pesanError }}</p>

      <button type="submit" :disabled="memuat"
        class="tombol tombol-utama w-full">
        {{ memuat ? 'Memproses' : 'Masuk' }}
      </button>
    </form>

    <div class="my-5 flex items-center gap-3">
      <span class="h-px flex-1 bg-gray-200" />
      <span class="text-xs text-gray-500">atau</span>
      <span class="h-px flex-1 bg-gray-200" />
    </div>

    <TombolGoogle />

    <p class="mt-4 text-sm">
      Belum punya akun?
      <NuxtLink to="/daftar" class="font-medium text-brand underline">Daftar</NuxtLink>
    </p>

    <p class="mt-6 border-t border-gray-200 pt-4 text-sm">
      <NuxtLink to="/" class="tombol tombol-tersier">Kembali ke peta</NuxtLink>
    </p>
  </main>
</template>
