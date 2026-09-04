<script setup lang="ts">
// Kartu tunggal, bukan grid kartu kecil (DESIGN-BRIEF).
const route = useRoute()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const idPengguna = useIdPengguna()
const id = computed(() => String(route.params.id))

const { data: lokasi, error, refresh } = await useAsyncData(
  () => `lokasi-${id.value}`,
  async () => {
    const { data, error } = await supabase
      .from('locations')
      .select(`
        id, nama, kategori, lat, lng, skor, status, created_at, created_by,
        accessibility_checklist (*),
        location_photos ( id, photo_url ),
        confirmations ( id, user_id, is_accurate ),
        profiles ( nama )
      `)
      .eq('id', id.value)
      .maybeSingle()

    if (error) throw error
    return data as any
  },
)

if (!lokasi.value && !error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Lokasi tidak ditemukan', fatal: true })
}

const checklist = computed(() => {
  const c = lokasi.value?.accessibility_checklist
  return (Array.isArray(c) ? c[0] : c) ?? null
})

const foto = computed(() => lokasi.value?.location_photos ?? [])
const konfirmasi = computed(() => lokasi.value?.confirmations ?? [])
const jumlahAkurat = computed(() => konfirmasi.value.filter((k: any) => k.is_accurate).length)
const jumlahBerubah = computed(() => konfirmasi.value.length - jumlahAkurat.value)

const konfirmasiSaya = computed(() =>
  konfirmasi.value.find((k: any) => k.user_id === idPengguna.value) ?? null,
)

// Baris tanpa created_by berarti data contoh yang dimasukkan lewat SQL, bukan
// kiriman warga. Jangan menyebut kontributor yang tidak pernah ada.
const namaKontributor = computed(() => {
  const p = lokasi.value?.profiles
  const satu = Array.isArray(p) ? p[0] : p
  if (satu?.nama) return satu.nama
  return lokasi.value?.created_by ? 'Warga' : null
})

const tanggal = computed(() =>
  lokasi.value?.created_at
    ? new Date(lokasi.value.created_at).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '',
)

// Sama seperti di kartu ringkas: tautan biasa ke Google Maps, bukan navigasi sendiri.
const rute = computed(() =>
  lokasi.value
    ? `https://www.google.com/maps/dir/?api=1&destination=${lokasi.value.lat},${lokasi.value.lng}`
    : '',
)

const mengirim = ref(false)
const pesanError = ref('')

async function konfirmasiAkurasi(akurat: boolean) {
  if (!idPengguna.value) {
    await navigateTo(`/masuk?redirect=/lokasi/${id.value}`)
    return
  }

  mengirim.value = true
  pesanError.value = ''

  const { error } = await supabase
    .from('confirmations')
    .upsert(
      { location_id: id.value, user_id: idPengguna.value, is_accurate: akurat },
      { onConflict: 'location_id,user_id' },
    )

  mengirim.value = false

  if (error) {
    pesanError.value = 'Konfirmasi gagal tersimpan. Coba lagi.'
    return
  }
  await refresh()
}

useHead(() => ({ title: lokasi.value ? `${lokasi.value.nama} — landai` : 'landai' }))
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

    <p v-if="error" class="p-4 text-sm text-skor-kurang">Gagal memuat lokasi ini.</p>

    <article v-else-if="lokasi" class="px-4 pb-16 pt-5">
      <h1 class="text-2xl font-bold leading-tight">{{ lokasi.nama }}</h1>
      <p class="mt-1 text-sm text-gray-600">{{ LABEL_KATEGORI[lokasi.kategori as KategoriLokasi] }}</p>

      <!-- Angka skor: fokus visual halaman ini -->
      <div class="mt-5 flex items-end justify-between gap-4 border-y border-gray-200 py-5">
        <p class="flex items-baseline gap-1.5 leading-none">
          <span class="text-7xl font-bold tabular-nums" :style="{ color: warnaSkor(lokasi.skor) }">
            {{ lokasi.skor }}
          </span>
          <span class="text-base text-gray-500">/100</span>
        </p>
        <div class="pb-1 text-right">
          <p class="font-semibold">{{ labelSkor(lokasi.skor) }}</p>
          <p class="mt-1 text-sm text-gray-600">
            {{ lokasi.status === 'terverifikasi' ? 'Terverifikasi warga' : 'Belum dikonfirmasi' }}
          </p>
        </div>
      </div>

      <a
        :href="rute" target="_blank" rel="noopener noreferrer"
        class="tombol tombol-sekunder mt-5"
      >
        Buka rute di Google Maps
        <svg
            viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
          >
            <path d="M14 4h6v6" />
            <path d="M20 4 11 13" />
            <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
          </svg>
        <span class="sr-only">membuka tab baru</span>
      </a>

      <ul v-if="foto.length" class="mt-5 grid gap-2" :class="foto.length > 1 ? 'grid-cols-2' : 'grid-cols-1'">
        <li v-for="f in foto" :key="f.id">
          <img
            :src="f.photo_url" :alt="`Kondisi ${lokasi.nama}`" loading="lazy"
            class="w-full rounded object-cover" :class="foto.length > 1 ? 'aspect-square' : 'aspect-[4/3]'"
          >
        </li>
      </ul>
      <FotoKosong v-else class="mt-5" />

      <h2 class="mt-8 text-base font-semibold">Rincian fasilitas</h2>
      <ul v-if="checklist" class="mt-2 divide-y divide-gray-200">
        <li v-for="item in ITEM_CHECKLIST" :key="item.kunci" class="flex items-start gap-3 py-3">
          <span
            class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
            :class="checklist[item.kunci] ? 'bg-skor-baik text-white' : 'border border-gray-300 text-gray-400'"
            aria-hidden="true"
          >
            <svg v-if="checklist[item.kunci]" viewBox="0 0 24 24" class="h-3 w-3" fill="none"
              stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else viewBox="0 0 24 24" class="h-2.5 w-2.5" fill="none" stroke="currentColor"
              stroke-width="3.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-medium" :class="checklist[item.kunci] ? '' : 'text-gray-500'">
              {{ item.label }}
            </span>
            <span class="sr-only">{{ checklist[item.kunci] ? 'tersedia' : 'tidak tersedia' }}</span>
          </span>
        </li>
      </ul>

      <div v-if="checklist?.catatan" class="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <p class="text-sm font-medium">Catatan kontributor</p>
        <p class="mt-1 text-sm text-gray-700">{{ checklist.catatan }}</p>
      </div>

      <h2 class="mt-8 text-base font-semibold">Sumber data</h2>
      <p class="mt-2 text-sm text-gray-700">
        <template v-if="namaKontributor">Ditambahkan {{ namaKontributor }} pada {{ tanggal }}.</template>
        <template v-else>Ditambahkan pada {{ tanggal }}. Kontributor tidak tercatat.</template>
      </p>
      <p class="mt-1 text-sm text-gray-700 tabular-nums">
        {{ jumlahAkurat }} warga menyatakan masih akurat<template v-if="jumlahBerubah">, {{ jumlahBerubah }} menyatakan sudah berubah</template>.
      </p>
      <p v-if="lokasi.status !== 'terverifikasi'" class="mt-1 text-sm text-gray-600">
        Butuh 3 konfirmasi akurat untuk berstatus terverifikasi.
      </p>

      <h2 class="mt-8 text-base font-semibold">Kamu pernah ke sini?</h2>
      <p class="mt-1 text-sm text-gray-600">Bantu warga lain dengan memastikan datanya masih benar.</p>

      <div class="mt-3 flex flex-wrap gap-3">
        <button
          type="button" :disabled="mengirim"
          class="tombol"
          :class="konfirmasiSaya?.is_accurate === true ? 'tombol-utama' : 'tombol-sekunder'"
          @click="konfirmasiAkurasi(true)"
        >
          Masih akurat
        </button>
        <button
          type="button" :disabled="mengirim"
          class="tombol"
          :class="konfirmasiSaya?.is_accurate === false ? 'tombol-dipilih-gelap' : 'tombol-sekunder'"
          @click="konfirmasiAkurasi(false)"
        >
          Sudah berubah
        </button>
      </div>

      <p v-if="!user" class="mt-2 text-sm text-gray-600">Perlu masuk dulu untuk konfirmasi.</p>
      <p v-if="pesanError" role="alert" class="mt-2 text-sm text-skor-kurang">{{ pesanError }}</p>
    </article>
  </div>
</template>
