<script setup lang="ts">
// Pratinjau foto layar penuh.
//
// Foto di halaman detail dipangkas jadi kotak supaya kisinya rapi, dan pemangkasan
// itu justru membuang bagian yang sering paling penting: ujung ramp, tepi trotoar,
// pegangan tangga. Tanpa cara membuka fotonya utuh, orang menilai aksesibilitas
// sebuah tempat dari potongan gambar. Di sini fotonya ditampilkan seutuhnya,
// dimuat pas ke dalam layar tanpa dipangkas sama sekali.
const props = defineProps<{
  foto: { id: string, photo_url: string }[]
  mulai: number
  namaLokasi: string
}>()

const emit = defineEmits<{ tutup: [] }>()

const posisi = ref(props.mulai)
const tombolTutup = ref<HTMLButtonElement | null>(null)
const memuat = ref(true)

const sekarang = computed(() => props.foto[posisi.value] ?? null)
const banyak = computed(() => props.foto.length > 1)

function geser(arah: number) {
  if (!banyak.value) return
  memuat.value = true
  posisi.value = (posisi.value + arah + props.foto.length) % props.foto.length
}

function tombolPapan(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('tutup')
  if (e.key === 'ArrowRight') geser(1)
  if (e.key === 'ArrowLeft') geser(-1)
}

// Geser jari untuk berpindah foto. Di ponsel inilah cara yang dicari orang lebih
// dulu, sebelum mencari tombol panah.
let mulaiX = 0
function sentuhMulai(e: TouchEvent) {
  mulaiX = e.changedTouches[0]?.clientX ?? 0
}
function sentuhSelesai(e: TouchEvent) {
  const beda = (e.changedTouches[0]?.clientX ?? 0) - mulaiX
  if (Math.abs(beda) > 50) geser(beda < 0 ? 1 : -1)
}

onMounted(() => {
  document.addEventListener('keydown', tombolPapan)
  // Halaman di belakang tidak boleh ikut tergulir saat lapisan ini terbuka.
  document.body.style.overflow = 'hidden'
  nextTick(() => tombolTutup.value?.focus())
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', tombolPapan)
  document.body.style.overflow = ''
})
</script>

<template>
  <!-- Latarnya nyaris pekat dan diburamkan. Pada 92 persen, tulisan halaman di
       belakang masih terbaca menembus lapisan ini, dan mata ikut membacanya alih-alih
       memperhatikan fotonya. Foto di sini bukti kondisi lapangan, jadi ia harus
       berdiri sendiri. -->
  <div
    role="dialog" aria-modal="true" :aria-label="`Foto ${namaLokasi}`"
    class="fixed inset-0 z-50 flex flex-col bg-black/96 backdrop-blur-sm"
    @click.self="emit('tutup')"
    @touchstart.passive="sentuhMulai"
    @touchend.passive="sentuhSelesai"
  >
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
      <p class="min-w-0 truncate text-sm">
        {{ namaLokasi }}
        <span v-if="banyak" class="ml-1 text-white/70 tabular-nums">
          {{ posisi + 1 }} dari {{ foto.length }}
        </span>
      </p>

      <button
        ref="tombolTutup"
        type="button" aria-label="Tutup pratinjau"
        class="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-white hover:bg-white/15"
        @click="emit('tutup')"
      >
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <div class="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4" @click.self="emit('tutup')">
      <!-- object-contain, bukan object-cover. Seluruh bingkai foto harus terlihat. -->
      <img
        v-if="sekarang"
        :key="sekarang.id"
        :src="sekarang.photo_url"
        :alt="`Kondisi ${namaLokasi}, foto ${posisi + 1} dari ${foto.length}`"
        class="max-h-full max-w-full rounded object-contain"
        @load="memuat = false"
      >

      <p v-if="memuat" class="absolute text-sm text-white/70" role="status">Memuat foto</p>

      <template v-if="banyak">
        <button
          type="button" aria-label="Foto sebelumnya"
          class="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white hover:bg-black/70"
          @click="geser(-1)"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <button
          type="button" aria-label="Foto berikutnya"
          class="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white hover:bg-black/70"
          @click="geser(1)"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </template>
    </div>
  </div>
</template>
