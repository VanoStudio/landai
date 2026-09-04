<script setup lang="ts">
const props = defineProps<{ lat: number, lng: number }>()
const emit = defineEmits<{ geser: [{ lat: number, lng: number }] }>()

const kueri = ref('')
const hasil = ref<{ nama: string, alamat: string, lat: number, lng: number }[]>([])
const mencari = ref(false)
const pesanCari = ref('')

const { ambilPosisi, memuat: memuatGps, pesanError: errorGps } = useGps()
const akurasi = ref<number | null>(null)

async function cari() {
  const q = kueri.value.trim()
  if (q.length < 3) {
    pesanCari.value = 'Ketik minimal 3 huruf.'
    return
  }
  mencari.value = true
  pesanCari.value = ''
  try {
    const res = await $fetch<{ hasil: typeof hasil.value }>('/api/geocode', { query: { q } })
    hasil.value = res.hasil
    if (res.hasil.length === 0) pesanCari.value = 'Tempat tidak ketemu. Geser pin manual saja.'
  }
  catch {
    pesanCari.value = 'Pencarian sedang bermasalah. Geser pin manual saja.'
  }
  finally {
    mencari.value = false
  }
}

function pakaiHasil(h: { nama: string, lat: number, lng: number }) {
  hasil.value = []
  kueri.value = h.nama
  akurasi.value = null
  emit('geser', { lat: h.lat, lng: h.lng })
}

async function pakaiGps() {
  const p = await ambilPosisi()
  if (!p) return
  akurasi.value = Math.round(p.akurasi)
  emit('geser', { lat: p.lat, lng: p.lng })
}
</script>

<template>
  <div class="space-y-4">
    <form class="flex gap-2" @submit.prevent="cari">
      <input
        v-model="kueri" type="search" inputmode="search"
        placeholder="Cari nama tempat"
        aria-label="Cari nama tempat"
        class="min-w-0 flex-1 rounded border border-gray-400 px-3 py-2.5 text-base"
      >
      <button
        type="submit" :disabled="mencari"
        class="tombol tombol-sekunder shrink-0"
      >
        {{ mencari ? 'Mencari' : 'Cari' }}
      </button>
    </form>

    <ul v-if="hasil.length" class="divide-y divide-gray-200 rounded border border-gray-300">
      <li v-for="h in hasil" :key="`${h.lat},${h.lng}`">
        <button
          type="button" class="w-full px-3 py-2.5 text-left hover:bg-gray-50"
          @click="pakaiHasil(h)"
        >
          <span class="block text-sm font-medium">{{ h.nama }}</span>
          <span class="mt-0.5 block truncate text-xs text-gray-600">{{ h.alamat }}</span>
        </button>
      </li>
    </ul>

    <p v-if="pesanCari" class="text-sm text-gray-600">{{ pesanCari }}</p>

    <div class="h-64 overflow-hidden rounded border border-gray-300 sm:h-80">
      <PemilihTitik :lat="props.lat" :lng="props.lng" @geser="emit('geser', $event)" />
    </div>

    <button
      type="button" :disabled="memuatGps"
      class="tombol tombol-sekunder w-full"
      @click="pakaiGps"
    >
      {{ memuatGps ? 'Membaca lokasi' : 'Pakai lokasi saya' }}
    </button>

    <p v-if="errorGps" role="alert" class="text-sm text-skor-kurang">{{ errorGps }}</p>
    <p v-else-if="akurasi !== null" class="text-sm text-gray-600">
      Lokasi terbaca dengan ketelitian sekitar {{ akurasi }} meter. Geser pin kalau meleset.
    </p>
    <p v-else class="text-sm text-gray-600">
      Ketuk peta atau geser pin untuk menaruh titik tepat di pintu masuk.
    </p>
  </div>
</template>
