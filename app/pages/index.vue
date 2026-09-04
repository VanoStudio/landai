<script setup lang="ts">
// Peta adalah hero. Tidak ada halaman pembuka sebelum peta (DESIGN-BRIEF).
const { data: semua, pending, error, refresh } = useDaftarLokasi()
const user = useSupabaseUser()
const keluar = useKeluar()

const filterAktif = ref<Kebutuhan[]>([])
const terpilihId = ref<string | null>(null)

const DAFTAR_KEBUTUHAN: Kebutuhan[] = ['kursi_roda', 'tunanetra', 'lansia_stroller']

// Beberapa filter aktif = lokasi harus memenuhi semuanya. Rombongan dengan
// kebutuhan campuran perlu tempat yang memenuhi seluruhnya, bukan salah satu.
const lokasiTersaring = computed(() =>
  (semua.value ?? []).filter(l => filterAktif.value.every(k => cocokKebutuhan(l, k))),
)

const jumlahPerKebutuhan = computed(() =>
  Object.fromEntries(
    DAFTAR_KEBUTUHAN.map(k => [k, (semua.value ?? []).filter(l => cocokKebutuhan(l, k)).length]),
  ) as Record<Kebutuhan, number>,
)

const lokasiTerpilih = computed(() =>
  lokasiTersaring.value.find(l => l.id === terpilihId.value) ?? null,
)

function ubahFilter(k: Kebutuhan) {
  terpilihId.value = null
  filterAktif.value = filterAktif.value.includes(k)
    ? filterAktif.value.filter(x => x !== k)
    : [...filterAktif.value, k]
}

useHead({ title: 'landai — peta aksesibilitas' })
</script>

<template>
  <div class="relative h-[100dvh] w-full overflow-hidden">
    <PetaLokasi
      :lokasi="lokasiTersaring"
      :terpilih="terpilihId"
      @pilih="terpilihId = $event?.id ?? null"
    />

    <!-- Lapisan atas: identitas, akun, filter -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-10">
      <div class="pointer-events-auto flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <div class="min-w-0">
          <p class="text-lg font-bold leading-none text-brand">landai</p>
          <p class="mt-1 truncate text-xs text-gray-600">Peta aksesibilitas difabel</p>
        </div>

        <div class="flex shrink-0 items-center gap-2 text-sm">
          <NuxtLink
            to="/tentang"
            class="rounded px-2 py-2 font-medium text-gray-700 hover:text-gray-900"
          >Tentang</NuxtLink>

          <template v-if="user">
            <NuxtLink
              to="/tambah-lokasi"
              class="hidden rounded bg-brand px-3 py-2 font-medium text-white hover:bg-brand-gelap sm:block"
            >Tambah lokasi</NuxtLink>
            <button
              class="rounded border border-gray-300 px-3 py-2 font-medium text-gray-800 hover:border-gray-500"
              @click="keluar()"
            >Keluar</button>
          </template>
          <template v-else>
            <NuxtLink
              to="/masuk"
              class="rounded border border-gray-300 px-3 py-2 font-medium text-gray-800 hover:border-gray-500"
            >Masuk</NuxtLink>
          </template>
        </div>
      </div>

      <div class="pointer-events-auto space-y-2 px-4 py-3">
        <div class="flex flex-wrap gap-2">
          <ChipKebutuhan
            v-for="k in DAFTAR_KEBUTUHAN" :key="k"
            :jenis="k"
            :aktif="filterAktif.includes(k)"
            :jumlah="jumlahPerKebutuhan[k]"
            @ubah="ubahFilter"
          />
        </div>

        <LegendaSkor v-if="(semua?.length ?? 0) > 0" class="w-fit max-w-full" />
      </div>
    </div>

    <!-- Status data -->
    <div
      v-if="pending || error || (semua?.length ?? 0) === 0 || lokasiTersaring.length === 0"
      class="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center px-4"
    >
      <p class="pointer-events-auto max-w-sm rounded-lg border border-gray-200 bg-white px-4 py-3 text-center text-sm text-gray-700 shadow-lg">
        <template v-if="pending">Memuat lokasi</template>
        <template v-else-if="error">
          Gagal memuat data.
          <button class="font-medium text-brand underline" @click="refresh()">Coba lagi</button>
        </template>
        <template v-else-if="(semua?.length ?? 0) === 0">
          Belum ada lokasi terdata. Jadi yang pertama menambahkan.
        </template>
        <template v-else>
          Tidak ada lokasi yang memenuhi semua kebutuhan terpilih.
        </template>
      </p>
    </div>

    <!-- Kartu ringkas -->
    <div v-if="lokasiTerpilih" class="absolute inset-x-0 bottom-0 z-20 p-4 sm:max-w-sm">
      <KartuRingkas :lokasi="lokasiTerpilih" @tutup="terpilihId = null" />
    </div>

    <!-- Tombol tambah lokasi, hanya layar kecil -->
    <NuxtLink
      v-if="!lokasiTerpilih"
      :to="user ? '/tambah-lokasi' : '/masuk'"
      class="absolute bottom-10 left-4 z-20 inline-flex min-h-12 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white shadow-lg hover:bg-brand-gelap sm:hidden"
    >
      Tambah lokasi
    </NuxtLink>
  </div>
</template>
