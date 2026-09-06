<script setup lang="ts">
// Peta selalu selebar penuh. Daftar lokasi bukan kolom tetap di sampingnya melainkan panel
// yang dipanggil lalu ditutup lagi: kolom tetap memangkas lebar peta selamanya.
const { data: semua, pending, error, refresh } = useDaftarLokasi()
const user = useSupabaseUser()

// Rangka pemuatan hidup di sini, bukan di komponen peta, karena komponen itu khusus sisi
// klien. Di halaman, rangkanya sudah ada di HTML pertama.
const petaSiap = ref(false)

// Hanya untuk muat pertama dalam satu sesi.
const pembukaBelumPernah = useState('pembuka-belum-pernah', () => true)

// Dibaca saat setup, bukan di onMounted, supaya ikut dirender server. Kalau baru dipasang
// setelah hidrasi, ia muncul sesudah rangka pemuatan, kebalikan dari gunanya.
const pembukaTampil = ref(pembukaBelumPernah.value)
const pembukaSelesai = ref(false)

onMounted(() => {
  if (!pembukaTampil.value) return
  pembukaBelumPernah.value = false

  const mulai = performance.now()

  // Menolak panggilan kedua lewat penanda, bukan dengan menghentikan pengamatnya dari dalam
  // callback-nya sendiri: dengan immediate, rujukan ke penghentinya jatuh sebelum const-nya
  // terisi dan seluruh halaman membalas 500.
  let sudahTutup = false
  const tutup = () => {
    if (sudahTutup) return
    sudahTutup = true
    setTimeout(() => { pembukaSelesai.value = true }, Math.max(0, 480 - (performance.now() - mulai)))
  }

  watch(pending, (masihMuat) => { if (!masihMuat) tutup() }, { immediate: true })
  setTimeout(tutup, 1900)
})
const petaRef = ref<{
  tandaiPosisiSaya: (lat: number, lng: number) => void
  pindahKe: (lat: number, lng: number, zoom?: number) => void
} | null>(null)

// Memakai ulang composable GPS yang sama dengan langkah pertama formulir.
const { ambilPosisi, memuat: memuatGps, pesanError: errorGps } = useGps()
const { tampilkan } = useNotifikasi()

async function keLokasiSaya() {
  const p = await ambilPosisi()
  if (!p) {
    // Lewat antrean notifikasi yang padam sendiri, bukan kotak menetap.
    tampilkan(errorGps.value, 'galat')
    return
  }
  petaRef.value?.tandaiPosisiSaya(p.lat, p.lng)
}

// Di 375px ketiga chip berjumlah sekitar 480px, jadi selalu ada yang di luar layar. Kabut
// di tepi kanan menandainya, dan padam sendiri di ujung guliran.
const barisChip = ref<HTMLElement | null>(null)
const adaLanjutan = ref(false)

function ukurLanjutan() {
  const el = barisChip.value
  if (!el) return
  adaLanjutan.value = el.scrollWidth - el.clientWidth - el.scrollLeft > 8
}

onMounted(() => {
  ukurLanjutan()
  window.addEventListener('resize', ukurLanjutan)
})
onBeforeUnmount(() => window.removeEventListener('resize', ukurLanjutan))

const filterAktif = ref<Kebutuhan[]>([])
const terpilihId = ref<string | null>(null)
const tampilan = ref<'peta' | 'daftar'>('peta')

// Label ditulis lengkap. "Daftar" sendirian berarti senarai sekaligus mendaftar akun, dan
// tombol ini duduk berdampingan dengan Masuk dan Tambah lokasi.
const TAMPILAN = [
  { nilai: 'peta', label: 'Peta' },
  { nilai: 'daftar', label: 'Daftar Lokasi' },
] as const

const DAFTAR_KEBUTUHAN: Kebutuhan[] = ['kursi_roda', 'tunanetra', 'lansia_stroller']

// Beberapa filter aktif berarti lokasi harus memenuhi semuanya, bukan salah satu.
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

// Keadaan tampilan, bukan data: dipakai untuk memutuskan panel daftar perlu ditutup.
const layarLebar = ref(false)
let pantau: MediaQueryList | null = null
const ikutiLebar = (e: MediaQueryListEvent) => { layarLebar.value = e.matches }

onMounted(() => {
  pantau = window.matchMedia('(min-width: 1024px)')
  layarLebar.value = pantau.matches
  pantau.addEventListener('change', ikutiLebar)
})

onBeforeUnmount(() => pantau?.removeEventListener('change', ikutiLebar))

// Di ponsel panelnya ikut ditutup, karena kalau tidak, kartu yang baru dibuka berada di
// layar yang sedang tidak dilihat.
function pilihDariDaftar(l: LokasiPeta) {
  terpilihId.value = l.id
  if (!layarLebar.value) tampilan.value = 'peta'
  nextTick(() => petaRef.value?.pindahKe(l.lat, l.lng, 17))
}

</script>

<template>
  <div class="flex h-[100dvh] w-full flex-col overflow-hidden">
    <LayarPembuka v-if="pembukaTampil" :selesai="pembukaSelesai" />

    <!-- Membungkus jadi dua baris di layar sempit. -->
    <header class="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2.5">
      <!-- Tanda tidak pernah tampil tanpa tulisan di sampingnya. -->
      <MerekLandai class="order-1" :ukuran="26" tagline />

      <div class="order-2 ml-auto flex shrink-0 items-center gap-2 text-sm lg:order-3 lg:ml-0">
        <!-- Menyaring data dan mengganti cara melihatnya dua pekerjaan berbeda, jadi tidak duduk
             dalam satu baris. -->
        <!-- Keduanya bersentuhan, jadi sasaran sentuhnya harus utuh 44px. -->
        <div
          class="flex h-11 shrink-0 items-stretch overflow-hidden rounded-full border border-gray-300"
          role="tablist" aria-label="Pindah tampilan"
        >
          <button
            v-for="t in TAMPILAN" :key="t.nilai"
            type="button" role="tab"
            :aria-selected="tampilan === t.nilai"
            class="-my-px h-11 whitespace-nowrap rounded-full px-3 text-[13px] font-medium sm:px-4"
            :class="tampilan === t.nilai ? 'bg-brand text-white' : 'text-gray-700'"
            @click="tampilan = t.nilai"
          >{{ t.label }}</button>
        </div>

        <NuxtLink
          to="/tentang"
          aria-label="Tentang landai"
          class="tombol tombol-tersier w-11 sm:w-auto"
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

        <!-- Satu-satunya aksi utama di layar ini. -->
        <NuxtLink
          :to="user ? '/tambah-lokasi' : '/masuk'"
          class="tombol tombol-utama hidden md:inline-flex"
        >Tambah lokasi</NuxtLink>

        <!-- Satu tombol untuk seluruh urusan akun. -->
        <MenuAkun v-if="user" />

        <NuxtLink
          v-else
          to="/masuk"
          class="tombol tombol-sekunder"
        >Masuk</NuxtLink>
      </div>

      <CariArea
        class="order-3 w-full min-w-0 lg:order-2 lg:ml-auto lg:w-auto lg:max-w-md lg:flex-1"
        @pilih="tampilan = 'peta'; petaRef?.pindahKe($event.lat, $event.lng)"
      />
    </header>

    <!-- Baris penyaring kebutuhan. -->
    <div class="relative shrink-0 border-b border-gray-200 bg-white">
      <div
        ref="barisChip"
        class="baris-chip flex items-center gap-2 overflow-x-auto px-4 py-2.5 sm:flex-wrap sm:overflow-visible"
        @scroll="ukurLanjutan"
      >
        <ChipKebutuhan
          v-for="k in DAFTAR_KEBUTUHAN" :key="k"
          :jenis="k"
          :aktif="filterAktif.includes(k)"
          :jumlah="jumlahPerKebutuhan[k]"
          @ubah="ubahFilter"
        />
      </div>

      <div
        v-show="adaLanjutan"
        class="kabut-gulir pointer-events-none absolute inset-y-0 right-0 w-12 sm:hidden"
        aria-hidden="true"
      />
    </div>

    <div class="relative flex min-h-0 flex-1">
      <!-- Panel melayang di atas peta, bukan memotong lebarnya, jadi kanvas peta tidak pernah
           berubah ukuran saat panel dibuka. -->
      <div class="relative min-w-0 flex-1">
        <PetaLokasi
          ref="petaRef"
          :lokasi="lokasiTersaring"
          :terpilih="terpilihId"
          @pilih="terpilihId = $event?.id ?? null"
          @siap="petaSiap = true"
        />

        <!-- Rangka pemuatan peta, meniru blok kota dan garis jalan. -->
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

        <!-- Wadahnya tembus klik, hanya kartunya yang menangkap ketukan, jadi peta di belakangnya
             tetap bisa digeser. -->
        <div class="pointer-events-none absolute left-4 top-4 z-20 flex w-fit max-w-[calc(100%-2rem)] flex-col items-start gap-2">
          <LegendaSkor
            v-if="(semua?.length ?? 0) > 0"
            class="pointer-events-auto"
          />
          <KartuPengenalan class="pointer-events-auto max-w-[17.5rem]" />
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

        <!-- Naik dari bawah, bukan muncul mendadak, supaya mata sempat mengikutinya. -->
        <Transition name="kartu">
          <div v-if="lokasiTerpilih" class="absolute inset-x-0 bottom-0 z-20 p-4 sm:max-w-sm">
            <KartuRingkas :lokasi="lokasiTerpilih" @tutup="terpilihId = null" />
          </div>
        </Transition>

        <!-- Di atas kontrol perbesar, mengikuti kebiasaan aplikasi peta. -->
        <button
          type="button"
          :disabled="memuatGps"
          :aria-label="memuatGps ? 'Sedang membaca lokasi Anda' : 'Ke lokasi saya'"
          class="kendali-lokasi-saya absolute z-20 h-11 w-11 place-items-center rounded-full border border-gray-300 bg-white shadow-lg hover:border-gray-500 disabled:opacity-60"
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

        <!-- Tombol tambah lokasi, hanya layar kecil -->
        <NuxtLink
          v-if="!lokasiTerpilih"
          :to="user ? '/tambah-lokasi' : '/masuk'"
          class="tombol tombol-utama tombol-pil absolute bottom-10 left-4 z-20 shadow-lg md:hidden"
        >
          Tambah lokasi
        </NuxtLink>
      </div>

      <!-- Muncul hanya saat diminta: menutupi layar di ponsel, melayang di layar lebar. -->
      <Transition name="panel">
        <aside
          v-if="tampilan === 'daftar'"
          class="absolute inset-0 z-30 bg-white lg:left-auto lg:w-[360px] lg:border-l lg:border-gray-200 lg:shadow-2xl"
          aria-label="Daftar lokasi"
        >
          <DaftarLokasi
            :lokasi="lokasiTersaring"
            :terpilih="terpilihId"
            @pilih="pilihDariDaftar"
            @tutup="tampilan = 'peta'"
          />
        </aside>
      </Transition>
    </div>
  </div>
</template>
