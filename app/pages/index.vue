<script setup lang="ts">
// Peta adalah hero. Tidak ada halaman pembuka sebelum peta (DESIGN-BRIEF).
// Di layar lebar, daftar lokasi duduk di sampingnya; di ponsel keduanya bergantian
// lewat tombol pindah tampilan, karena membelah layar 390px jadi dua tidak menyisakan
// ruang yang layak untuk keduanya.
const { data: semua, pending, error, refresh } = useDaftarLokasi()
const user = useSupabaseUser()
const keluar = useKeluar()

// Rangka pemuatan hidup di sini, bukan di dalam komponen peta, karena komponen itu
// khusus sisi klien dan tidak dirender server sama sekali. Ditaruh di halaman berarti
// rangkanya sudah ada di HTML pertama, menutupi jendela paling kosong yaitu sebelum
// hidrasi selesai.
const petaSiap = ref(false)
const petaRef = ref<{
  tandaiPosisiSaya: (lat: number, lng: number) => void
  pindahKe: (lat: number, lng: number, zoom?: number) => void
} | null>(null)

// Memakai ulang composable GPS yang sama dengan langkah pertama formulir, termasuk
// pemeriksaan konteks aman dan kalimat galatnya. Tidak ada pembacaan posisi baru
// yang ditulis di sini.
const { ambilPosisi, memuat: memuatGps, pesanError: errorGps } = useGps()

async function keLokasiSaya() {
  const p = await ambilPosisi()
  if (!p) return
  petaRef.value?.tandaiPosisiSaya(p.lat, p.lng)
}

const filterAktif = ref<Kebutuhan[]>([])
const terpilihId = ref<string | null>(null)
const tampilan = ref<'peta' | 'daftar'>('peta')

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

// Menekan butir daftar memindahkan fokus peta sekaligus membuka kartunya. Di ponsel
// tampilan ikut berpindah ke peta, karena kalau tidak, kartu yang baru dibuka berada
// di layar yang sedang tidak dilihat.
function pilihDariDaftar(l: LokasiPeta) {
  terpilihId.value = l.id
  tampilan.value = 'peta'
  nextTick(() => petaRef.value?.pindahKe(l.lat, l.lng, 17))
}

useHead({ title: 'landai — peta aksesibilitas' })
</script>

<template>
  <div class="flex h-[100dvh] w-full flex-col overflow-hidden">
    <!-- Identitas, pencarian area, akun -->
    <header class="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
      <p class="shrink-0 text-lg font-bold leading-none text-brand">landai</p>
      <p class="hidden shrink-0 text-xs text-gray-600 xl:block">Peta aksesibilitas difabel</p>

      <CariArea
        class="min-w-0 flex-1"
        @pilih="tampilan = 'peta'; petaRef?.pindahKe($event.lat, $event.lng)"
      />

      <div class="flex shrink-0 items-center gap-2 text-sm">
        <NuxtLink
          to="/tentang"
          aria-label="Tentang landai"
          class="flex h-11 w-11 items-center justify-center rounded font-medium text-gray-700 hover:text-gray-900 sm:w-auto sm:px-2"
        >
          <svg
            viewBox="0 0 24 24" class="h-5 w-5 sm:hidden" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 7.6v.2" />
          </svg>
          <span class="hidden sm:inline">Tentang</span>
        </NuxtLink>

        <template v-if="user">
          <NuxtLink
            to="/tambah-lokasi"
            class="hidden h-11 items-center rounded bg-brand px-3 font-medium text-white hover:bg-brand-gelap sm:flex"
          >Tambah lokasi</NuxtLink>
          <button
            class="h-11 rounded border border-gray-300 px-3 font-medium text-gray-800 hover:border-gray-500"
            @click="keluar()"
          >Keluar</button>
        </template>
        <template v-else>
          <NuxtLink
            to="/masuk"
            class="flex h-11 items-center rounded border border-gray-300 px-3 font-medium text-gray-800 hover:border-gray-500"
          >Masuk</NuxtLink>
        </template>
      </div>
    </header>

    <!-- Penyaring kebutuhan dan pemindah tampilan. Satu baris yang membungkus, dipakai
         bersama oleh peta dan daftar, supaya tombol pindah tidak ikut hilang saat
         kolom petanya disembunyikan di ponsel. -->
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
      <ChipKebutuhan
        v-for="k in DAFTAR_KEBUTUHAN" :key="k"
        :jenis="k"
        :aktif="filterAktif.includes(k)"
        :jumlah="jumlahPerKebutuhan[k]"
        @ubah="ubahFilter"
      />

      <div
        class="ml-auto flex h-11 shrink-0 items-center rounded-full border border-gray-300 p-1 lg:hidden"
        role="tablist" aria-label="Pindah tampilan"
      >
        <button
          v-for="t in (['peta', 'daftar'] as const)" :key="t"
          type="button" role="tab"
          :aria-selected="tampilan === t"
          class="h-9 rounded-full px-3 text-[13px] font-medium capitalize"
          :class="tampilan === t ? 'bg-brand text-white' : 'text-gray-700'"
          @click="tampilan = t"
        >{{ t }}</button>
      </div>
    </div>

    <div class="flex min-h-0 flex-1">
      <!-- Kolom peta -->
      <div
        class="relative min-w-0 flex-1"
        :class="tampilan === 'daftar' ? 'hidden lg:block' : 'block'"
      >
        <PetaLokasi
          ref="petaRef"
          :lokasi="lokasiTersaring"
          :terpilih="terpilihId"
          @pilih="terpilihId = $event?.id ?? null"
          @siap="petaSiap = true"
        />

        <!-- Rangka pemuatan peta. Bentuknya meniru blok kota dan garis jalan, bukan
             deretan batang abu generik, supaya jelas yang sedang dimuat sebuah peta. -->
        <Transition name="rangka">
          <div
            v-if="!petaSiap"
            class="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-gray-100"
            aria-hidden="true"
          >
            <div class="rangka-peta absolute inset-0">
              <span class="rangka-jalan" style="top: 32%; left: -10%; width: 120%; transform: rotate(-4deg)" />
              <span class="rangka-jalan" style="top: 66%; left: -10%; width: 120%; transform: rotate(3deg)" />
              <span class="rangka-jalan rangka-jalan-tegak" style="left: 38%; top: -10%; height: 120%" />
              <span class="rangka-blok" style="top: 38%; left: 8%; width: 24%; height: 22%" />
              <span class="rangka-blok" style="top: 40%; left: 44%; width: 18%; height: 18%" />
              <span class="rangka-blok" style="top: 70%; left: 16%; width: 30%; height: 16%" />
              <span class="rangka-blok" style="top: 12%; left: 52%; width: 26%; height: 16%" />
            </div>
          </div>
        </Transition>

        <p v-if="!petaSiap" class="sr-only" role="status">Memuat peta</p>

        <LegendaSkor
          v-if="(semua?.length ?? 0) > 0"
          class="absolute left-4 top-4 z-10 w-fit max-w-[calc(100%-2rem)]"
        />

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

        <!-- Kartu ringkas. Naik dari bawah, bukan muncul mendadak, supaya mata sempat
             mengikuti dari penanda yang diketuk ke kartunya. -->
        <Transition name="kartu">
          <div v-if="lokasiTerpilih" class="absolute inset-x-0 bottom-0 z-20 p-4 sm:max-w-sm">
            <KartuRingkas :lokasi="lokasiTerpilih" @tutup="terpilihId = null" />
          </div>
        </Transition>

        <!-- Lokasi saya. Ditaruh tepat di atas kontrol perbesar, mengikuti kebiasaan
             aplikasi peta, supaya ibu jari menemukannya tanpa mencari. -->
        <button
          type="button"
          :disabled="memuatGps"
          :aria-label="memuatGps ? 'Sedang membaca lokasi kamu' : 'Ke lokasi saya'"
          class="absolute bottom-32 right-4 z-20 h-11 w-11 place-items-center rounded-full border border-gray-300 bg-white shadow-lg hover:border-gray-500 disabled:opacity-60"
          :class="lokasiTerpilih ? 'hidden sm:grid' : 'grid'"
          @click="keLokasiSaya"
        >
          <svg
            viewBox="0 0 24 24" class="h-5 w-5 text-gray-800" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
            :class="memuatGps ? 'animate-spin' : ''"
          >
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
            <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
          </svg>
        </button>

        <p
          v-if="errorGps"
          role="alert"
          class="absolute inset-x-4 bottom-48 z-20 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-skor-kurang shadow-lg sm:max-w-sm"
        >{{ errorGps }}</p>

        <!-- Tombol tambah lokasi, hanya layar kecil -->
        <NuxtLink
          v-if="!lokasiTerpilih"
          :to="user ? '/tambah-lokasi' : '/masuk'"
          class="absolute bottom-10 left-4 z-20 inline-flex min-h-12 items-center rounded-full bg-brand px-5 text-sm font-semibold text-white shadow-lg hover:bg-brand-gelap sm:hidden"
        >
          Tambah lokasi
        </NuxtLink>
      </div>

      <!-- Panel daftar lokasi -->
      <aside
        class="w-full shrink-0 border-gray-200 lg:w-[340px] lg:border-l"
        :class="tampilan === 'peta' ? 'hidden lg:block' : 'block'"
      >
        <DaftarLokasi
          :lokasi="lokasiTersaring"
          :terpilih="terpilihId"
          @pilih="pilihDariDaftar"
        />
      </aside>
    </div>
  </div>
</template>
