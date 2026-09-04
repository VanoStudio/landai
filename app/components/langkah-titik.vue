<script setup lang="ts">
const props = defineProps<{ lat: number, lng: number }>()
const emit = defineEmits<{ geser: [{ lat: number, lng: number }] }>()

const kueri = ref('')
const hasil = ref<{ nama: string, alamat: string, lat: number, lng: number }[]>([])
const mencari = ref(false)
const pesanCari = ref('')

const { ambilPosisi, memuat: memuatGps, pesanError: pesanErrorGps } = useGps()
const { tampilkan } = useNotifikasi()
const akurasi = ref<number | null>(null)

// Dari mana titik yang sekarang berasal. Penting karena ketiganya punya tingkat
// kepercayaan yang jauh berbeda, dan pencarian nama adalah yang paling rapuh:
// Nominatim mencocokkan kata, bukan tempat. Kueri "Kantor Kecamatan Kebayoran
// Baru" mengembalikan "Kantor Kepala Seksi Pendidikan Dasar Kecamatan Kebayoran
// Baru", kantor yang berbeda, 1,8 km dari kantor kecamatan yang sebenarnya.
// Surveyor yang menekan hasil pertama tanpa memeriksa akan menyimpan titik yang
// salah, dan tidak ada satu pun yang memberitahunya.
const asalTitik = ref<'awal' | 'cari' | 'gps' | 'geser'>('awal')

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
  asalTitik.value = 'cari'
  emit('geser', { lat: h.lat, lng: h.lng })
}

async function pakaiGps() {
  const p = await ambilPosisi()
  if (!p) {
    tampilkan(pesanErrorGps.value, 'galat')
    return
  }
  akurasi.value = Math.round(p.akurasi)
  asalTitik.value = 'gps'
  emit('geser', { lat: p.lat, lng: p.lng })
}

function geserManual(t: { lat: number, lng: number }) {
  akurasi.value = null
  asalTitik.value = 'geser'
  emit('geser', t)
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
      <PemilihTitik :lat="props.lat" :lng="props.lng" @geser="geserManual" />
    </div>

    <button
      type="button" :disabled="memuatGps"
      class="tombol tombol-sekunder w-full"
      @click="pakaiGps"
    >
      {{ memuatGps ? 'Membaca lokasi' : 'Pakai lokasi saya' }}
    </button>

    <!-- Peringatan khusus untuk titik hasil pencarian nama. Pencarian mencocokkan
         kata, bukan tempat, jadi hasil pertamanya bisa gedung lain yang kebetulan
         namanya mirip. Kalimatnya menyebut jaraknya bisa ratusan meter supaya
         terbaca sebagai peringatan sungguhan, bukan basa-basi. -->
    <p
      v-if="asalTitik === 'cari'" role="status"
      class="rounded-lg border border-skor-sedang bg-white px-3 py-2 text-sm text-gray-800"
    >
      Titik ini datang dari pencarian nama, bukan dari GPS. Pencarian bisa meleset
      ratusan meter ke gedung lain yang namanya mirip. Kalau kamu sedang berdiri di
      tempatnya, pakai lokasi saya lebih tepat, atau geser pin ke pintu masuknya.
    </p>
    <p v-else-if="akurasi !== null" class="text-sm text-gray-600">
      Lokasi terbaca dengan ketelitian sekitar {{ akurasi }} meter. Geser pin kalau meleset.
    </p>
    <p v-else class="text-sm text-gray-600">
      Ketuk peta atau geser pin untuk menaruh titik tepat di pintu masuk.
    </p>
  </div>
</template>
