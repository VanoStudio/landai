<script setup lang="ts">
// Halaman akun. Isinya satu hal saja: nama yang tampil di peta.
//
// Ada karena nama itu bukan urusan kosmetik di aplikasi ini. Nama inilah yang tertulis
// pada "Ditambahkan ... " di halaman detail dan pada papan kontributor, jadi ia
// dibaca siapa pun yang membuka peta. Sebelum halaman ini ada, nama hanya bisa diubah
// lewat SQL, dan nama yang datang dari akun Google sekolah terbawa apa adanya, lengkap
// dengan awalan seperti "8C_" atau "[AKUN BELAJAR]".
//
// Surel sengaja hanya ditampilkan, tidak bisa diubah di sini. Mengubah surel berarti
// mengubah identitas masuk, dan itu perlu pengiriman tautan konfirmasi ke dua alamat
// sekaligus. Di luar cakupan, dan salah kalau dikerjakan setengah.
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const idPengguna = useIdPengguna()
const { tampilkan } = useNotifikasi()

const { data: profil, refresh } = await useProfilSaya()

const nama = ref('')
const menyimpan = ref(false)
const pesanError = ref('')

watchEffect(() => {
  if (profil.value && !menyimpan.value) nama.value = profil.value.nama ?? ''
})

const surel = computed(() => {
  const u = user.value as Record<string, any> | null
  return u?.email ?? ''
})

const bolehSimpan = computed(() =>
  nama.value.trim().length >= 2 && nama.value.trim() !== (profil.value?.nama ?? ''),
)

async function simpan() {
  if (!idPengguna.value) return
  pesanError.value = ''
  menyimpan.value = true

  const { data, error } = await supabase
    .from('profiles')
    .update({ nama: nama.value.trim() })
    .eq('id', idPengguna.value)
    .select('id, nama')

  menyimpan.value = false

  if (error) {
    pesanError.value = `Nama gagal disimpan. ${error.message}`
    return
  }

  // Nol baris berubah berarti aturan keamanan menolak diam-diam, bukan berhasil.
  if (!data || data.length === 0) {
    pesanError.value = 'Nama gagal disimpan. Coba muat ulang halaman lalu masuk lagi.'
    return
  }

  await refresh()
  tampilkan('Nama tampilan tersimpan.')
}

useHead({ title: 'Akun — landai' })
</script>

<template>
  <div class="mx-auto max-w-lg">
    <header class="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
      <div class="flex items-center gap-3">
        <NuxtLink to="/" class="tombol tombol-tersier -ml-2">
          Kembali ke peta
        </NuxtLink>
        <MerekLandai class="ml-auto" :ukuran="22" tulisan="text-sm" />
      </div>
    </header>

    <article class="px-4 pb-16 pt-6">
      <h1 class="text-2xl font-bold leading-tight">Akun</h1>
      <p class="mt-3 text-gray-700">
        Nama di bawah ini yang tertulis pada lokasi yang Anda tambahkan dan pada papan
        kontributor. Nama itu bisa dilihat siapa saja yang membuka peta.
      </p>

      <form class="mt-6 space-y-5" @submit.prevent="simpan">
        <div>
          <label for="nama-tampilan" class="block text-sm font-medium">Nama tampilan</label>
          <input
            id="nama-tampilan" v-model="nama" type="text"
            required minlength="2" maxlength="60" autocomplete="name"
            placeholder="Nama yang ingin Anda tampilkan"
            class="mt-1 min-h-11 w-full rounded border border-gray-400 px-3 py-2"
          >
          <p class="mt-1.5 text-sm text-gray-600">
            Boleh nama panggilan. Kalau nama Anda terbawa awalan dari akun sekolah
            seperti <span class="whitespace-nowrap">8C_</span> atau
            <span class="whitespace-nowrap">[AKUN BELAJAR]</span>, rapikan di sini.
          </p>
        </div>

        <div>
          <label for="surel" class="block text-sm font-medium">Email</label>
          <input
            id="surel" :value="surel" type="email" readonly disabled
            class="mt-1 min-h-11 w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-gray-600"
          >
          <p class="mt-1.5 text-sm text-gray-600">
            Email dipakai untuk masuk dan tidak bisa diubah dari sini.
          </p>
        </div>

        <p v-if="pesanError" role="alert" class="text-sm text-skor-kurang">{{ pesanError }}</p>

        <button
          type="submit" :disabled="!bolehSimpan || menyimpan"
          class="tombol tombol-utama w-full"
        >
          {{ menyimpan ? 'Menyimpan' : 'Simpan nama' }}
        </button>
      </form>

      <NuxtLink to="/papan-kontributor" class="tombol tombol-sekunder mt-8">
        Lihat papan kontributor
      </NuxtLink>
    </article>
  </div>
</template>
