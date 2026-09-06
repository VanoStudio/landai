<script setup lang="ts">
// Panel daftar lokasi. Dipanggil lewat pemindah tampilan di header, lalu bisa ditutup
// lagi: di layar lebar ia melayang di tepi kanan peta, di ponsel menutupi seluruh
// layar. Peta tidak pernah menyusut karenanya, jadi peta tetap elemen utama berapa pun
// banyaknya lokasi nanti. Menekan satu butir memindahkan fokus peta ke lokasi itu
// sekaligus membuka kartunya, jadi daftar dan peta selalu sinkron.

const props = defineProps<{
  lokasi: LokasiPeta[]
  terpilih?: string | null
}>()

const emit = defineEmits<{ pilih: [LokasiPeta], tutup: [] }>()

// Diurutkan dari skor tertinggi. Orang membuka daftar untuk mencari tempat yang
// bisa dimasuki, bukan untuk membaca urutan pemasukan data.
const terurut = computed(() =>
  [...props.lokasi].sort((a, b) => b.skor - a.skor || a.nama.localeCompare(b.nama, 'id')),
)
</script>

<template>
  <div class="flex h-full flex-col bg-white">
    <div class="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-3">
      <h2 class="text-base font-semibold">Daftar lokasi</h2>
      <p class="ml-auto text-sm text-gray-600 tabular-nums">{{ terurut.length }} tempat</p>

      <button
        type="button" aria-label="Tutup daftar lokasi"
        class="-my-2 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        @click="emit('tutup')"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor"
          stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <p v-if="terurut.length === 0" class="px-4 py-6 text-sm text-gray-600">
      Tidak ada lokasi yang memenuhi kebutuhan terpilih.
    </p>

    <ul v-else class="min-h-0 flex-1 divide-y divide-gray-200 overflow-y-auto">
      <li v-for="l in terurut" :key="l.id">
        <button
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
          :class="l.id === props.terpilih ? 'bg-gray-50' : ''"
          :aria-current="l.id === props.terpilih ? 'true' : undefined"
          @click="emit('pilih', l)"
        >
          <!-- Angka skor memakai bentuk yang sama dengan penanda peta: terisi berarti
               terverifikasi, berongga berarti belum. Bentuknya yang membedakan, bukan
               warnanya, supaya tetap terbaca tanpa membedakan warna. -->
          <span
            class="penanda-skor penanda-daftar shrink-0"
            :style="{ '--warna-skor': warnaSkor(l.skor) }"
            :data-status="l.status"
            aria-hidden="true"
          ><span class="penanda-bulat">{{ l.skor }}</span></span>

          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ l.nama }}</span>
            <span class="mt-0.5 block text-xs text-gray-600">
              {{ labelKategori(l.kategori) }}, {{ labelSkor(l.skor) }}
            </span>
          </span>

          <span class="sr-only">
            skor {{ l.skor }} dari 100,
            {{ l.status === 'terverifikasi' ? 'terverifikasi warga' : 'belum dikonfirmasi' }}
          </span>

          <img
            v-if="l.foto_utama"
            :src="l.foto_utama" alt="" loading="lazy" decoding="async"
            class="h-10 w-10 shrink-0 rounded object-cover"
          >
        </button>
      </li>
    </ul>
  </div>
</template>
