<script setup lang="ts">
const props = defineProps<{ lokasi: LokasiPeta }>()
defineEmits<{ tutup: [] }>()

// Tautan foto bisa mati kalau berkasnya dihapus dari penyimpanan. Gambar rusak
// lebih buruk daripada tidak ada gambar, jadi disembunyikan begitu gagal dimuat.
const fotoGagal = ref(false)
watch(() => props.lokasi.id, () => { fotoGagal.value = false })

const fasilitas = computed(() => ([
  { jenis: 'kursi_roda' as const, ada: props.lokasi.ramp_tersedia, label: 'Ramp tersedia' },
  { jenis: 'tunanetra' as const, ada: props.lokasi.guiding_block_tersambung, label: 'Guiding block tersambung' },
  {
    jenis: 'lansia_stroller' as const,
    ada: props.lokasi.tempat_duduk_tersedia || props.lokasi.lift_tersedia_berfungsi,
    label: 'Tempat duduk atau lift',
  },
]))
</script>

<template>
  <article class="rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="truncate text-base font-semibold text-gray-900">{{ props.lokasi.nama }}</h2>
        <p class="mt-0.5 text-sm text-gray-600">{{ LABEL_KATEGORI[props.lokasi.kategori] }}</p>
      </div>

      <button
        type="button" aria-label="Tutup"
        class="-m-1 shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        @click="$emit('tutup')"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>

    <div class="mt-3 flex items-end justify-between gap-4">
      <div class="flex items-end gap-4">
        <p class="flex items-baseline gap-1 leading-none">
          <span
            class="text-5xl font-bold tabular-nums"
            :style="{ color: warnaSkor(props.lokasi.skor) }"
          >{{ props.lokasi.skor }}</span>
          <span class="text-sm text-gray-500">/100</span>
        </p>
        <p class="pb-1 text-sm font-medium text-gray-700">{{ labelSkor(props.lokasi.skor) }}</p>
      </div>

      <!-- Foto kondisi. Ukurannya sengaja kecil supaya angka skor tetap elemen
           terbesar di kartu ini. Saat foto belum ada, tempatnya diisi ikon kamera,
           bukan dibiarkan hilang: tinggi kartu jadi tetap sama antar lokasi, dan
           bidang kosong itu sekaligus mengabarkan bahwa foto memang bisa ditambah. -->
      <img
        v-if="props.lokasi.foto_utama && !fotoGagal"
        :src="props.lokasi.foto_utama"
        :alt="`Kondisi ${props.lokasi.nama}`"
        loading="lazy" decoding="async"
        class="h-16 w-16 shrink-0 rounded object-cover"
        @error="fotoGagal = true"
      >
      <FotoKosong v-else ringkas />
    </div>

    <ul class="mt-4 flex gap-4">
      <li v-for="f in fasilitas" :key="f.jenis" class="flex items-center gap-1.5">
        <IkonAksesibilitas
          :jenis="f.jenis" :label="f.label"
          class="h-6 w-6" :class="f.ada ? 'text-gray-900' : 'text-gray-300'"
        />
        <span class="sr-only">{{ f.label }}: {{ f.ada ? 'ada' : 'tidak ada' }}</span>
        <svg v-if="!f.ada" viewBox="0 0 24 24" class="h-3 w-3 text-gray-400" fill="none"
          stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </li>
    </ul>

    <div class="mt-4 flex items-center gap-3">
      <NuxtLink
        :to="`/lokasi/${props.lokasi.id}`"
        class="tombol tombol-utama"
      >
        Lihat detail
      </NuxtLink>
      <p v-if="props.lokasi.status === 'belum_terverifikasi'" class="text-xs text-gray-600">
        Belum dikonfirmasi warga lain
      </p>
    </div>
  </article>
</template>
