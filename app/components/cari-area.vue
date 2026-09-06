<script setup lang="ts">
// Pencarian area di peta utama.

interface HasilArea {
  nama: string
  alamat: string
  lat: number
  lng: number
}

const emit = defineEmits<{ pilih: [HasilArea] }>()

const kueri = ref('')
const hasil = ref<HasilArea[]>([])
const mencari = ref(false)
const pesan = ref('')
const terbuka = ref(false)
const wadah = ref<HTMLElement | null>(null)

async function cari() {
  const q = kueri.value.trim()
  if (q.length < 3) {
    pesan.value = 'Ketik minimal 3 huruf.'
    terbuka.value = true
    return
  }

  mencari.value = true
  pesan.value = ''
  terbuka.value = true
  try {
    const res = await $fetch<{ hasil: HasilArea[] }>('/api/geocode', { query: { q } })
    hasil.value = res.hasil
    if (res.hasil.length === 0) pesan.value = 'Tempat tidak ketemu. Coba kata lain.'
  }
  catch {
    pesan.value = 'Pencarian sedang bermasalah. Coba lagi sebentar lagi.'
  }
  finally {
    mencari.value = false
  }
}

function pakai(h: HasilArea) {
  emit('pilih', h)
  tutup()
}

function tutup() {
  terbuka.value = false
  hasil.value = []
  pesan.value = ''
}

// Menutup hasil saat menekan di luar, supaya daftar tidak menghalangi peta.
function klikLuar(e: MouseEvent) {
  if (wadah.value && !wadah.value.contains(e.target as Node)) tutup()
}

onMounted(() => document.addEventListener('click', klikLuar))
onBeforeUnmount(() => document.removeEventListener('click', klikLuar))
</script>

<template>
  <div ref="wadah" class="relative min-w-0">
    <!-- Tombol kirim ditaruh di dalam kolom, bukan sebagai tombol terpisah di sampingnya. Di
         layar 390px, tombol terpisah menyisakan kolom terlalu sempit sampai teks bantuannya
         terpotong. -->
    <form class="relative" @submit.prevent="cari">
      <input
        v-model="kueri" type="search" inputmode="search"
        placeholder="Cari area"
        aria-label="Cari area di peta"
        class="h-11 w-full min-w-0 rounded border border-gray-300 bg-white pl-3 pr-11 text-sm"
        @focus="terbuka = hasil.length > 0 || !!pesan"
      >
      <button
        type="submit" :disabled="mencari"
        :aria-label="mencari ? 'Sedang mencari' : 'Cari area'"
        class="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-r text-gray-600 hover:text-gray-900 disabled:opacity-50"
      >
        <svg
          viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" aria-hidden="true"
          :class="mencari ? 'animate-pulse' : ''"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M16.5 16.5L21 21" />
        </svg>
      </button>
    </form>

    <div
      v-if="terbuka && (hasil.length > 0 || pesan)"
      class="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
    >
      <ul v-if="hasil.length" class="divide-y divide-gray-200">
        <li v-for="h in hasil" :key="`${h.lat},${h.lng}`">
          <button type="button" class="w-full px-3 py-2.5 text-left hover:bg-gray-50" @click="pakai(h)">
            <span class="block text-sm font-medium">{{ h.nama }}</span>
            <span class="mt-0.5 block truncate text-xs text-gray-600">{{ h.alamat }}</span>
          </button>
        </li>
      </ul>
      <p v-else class="px-3 py-2.5 text-sm text-gray-600">{{ pesan }}</p>
    </div>
  </div>
</template>
