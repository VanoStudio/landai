<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const nama = ref('')
const email = ref('')
const password = ref('')
const memuat = ref(false)
const pesanError = ref('')
const perluCekEmail = ref(false)

// Kalau sudah punya sesi, tidak perlu di halaman daftar.
watchEffect(() => {
  if (user.value) navigateTo('/')
})

async function daftar() {
  pesanError.value = ''

  if (password.value.length < 6) {
    pesanError.value = 'Kata sandi minimal 6 karakter.'
    return
  }

  memuat.value = true
  const { data, error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: {
      // Dibaca trigger handle_new_user() untuk mengisi profiles.nama
      data: { nama: nama.value },
      emailRedirectTo: `${window.location.origin}/konfirmasi`,
    },
  })
  memuat.value = false

  if (error) {
    pesanError.value = terjemahkanError(error.message)
    return
  }

  // Kalau konfirmasi email menyala, Supabase mengembalikan user tanpa sesi.
  if (data.user && !data.session) {
    perluCekEmail.value = true
    return
  }

  await navigateTo('/')
}
</script>

<template>
  <main class="mx-auto max-w-sm p-6">
    <h1 class="text-xl font-bold text-brand">Daftar akun</h1>
    <p class="mt-1 text-sm text-gray-600">Akun dipakai untuk menambah lokasi.</p>

    <div v-if="perluCekEmail" class="mt-6 rounded border border-gray-300 p-4 text-sm">
      <p class="font-medium">Cek email kamu</p>
      <p class="mt-1 text-gray-600">
        Kami kirim tautan konfirmasi ke {{ email }}. Buka tautan itu untuk mengaktifkan akun.
      </p>
    </div>

    <form v-else class="mt-6 space-y-4" @submit.prevent="daftar">
      <div>
        <label for="nama" class="block text-sm font-medium">Nama</label>
        <input id="nama" v-model="nama" type="text" required autocomplete="name"
          class="mt-1 w-full rounded border border-gray-400 px-3 py-2">
      </div>
      <div>
        <label for="email" class="block text-sm font-medium">Email</label>
        <input id="email" v-model="email" type="email" required autocomplete="email"
          class="mt-1 w-full rounded border border-gray-400 px-3 py-2">
      </div>
      <div>
        <label for="password" class="block text-sm font-medium">Kata sandi</label>
        <input id="password" v-model="password" type="password" required minlength="6"
          autocomplete="new-password"
          class="mt-1 w-full rounded border border-gray-400 px-3 py-2">
        <p class="mt-1 text-xs text-gray-600">Minimal 6 karakter.</p>
      </div>

      <p v-if="pesanError" role="alert" class="text-sm text-skor-kurang">{{ pesanError }}</p>

      <button type="submit" :disabled="memuat"
        class="w-full rounded bg-brand px-4 py-2 font-medium text-white disabled:opacity-50">
        {{ memuat ? 'Memproses' : 'Daftar' }}
      </button>
    </form>

    <p class="mt-4 text-sm">
      Sudah punya akun?
      <NuxtLink to="/masuk" class="font-medium text-brand underline">Masuk</NuxtLink>
    </p>

    <p class="mt-6 border-t border-gray-200 pt-4 text-sm">
      <NuxtLink to="/" class="font-medium text-gray-700 hover:text-gray-900">Kembali ke peta</NuxtLink>
    </p>
  </main>
</template>
