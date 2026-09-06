<script setup lang="ts">
// Kartu tunggal, bukan grid kartu kecil.
const route = useRoute()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const idPengguna = useIdPengguna()
const id = computed(() => String(route.params.id))

// Kueri dicoba lengkap dulu, lalu kelompok kolom dari tambalan belakangan dilepas satu per
// satu kalau basis datanya belum menerimanya.
async function ambilLokasi(pakaiJejak: boolean, pakaiPengunggah: boolean) {
  return supabase
    .from('locations')
    .select(`
      id, nama, kategori, lat, lng, skor, status, created_at, created_by,
      ${pakaiJejak ? 'updated_by, updated_at, pembaru:profiles!updated_by ( nama ),' : ''}
      accessibility_checklist (*),
      location_photos ( id, photo_url, created_at${pakaiPengunggah ? ', uploaded_by' : ''} ),
      confirmations ( id, user_id, is_accurate ),
      penambah:profiles!created_by ( nama )
    `)
    .eq('id', id.value)
    .maybeSingle()
}

const { data: lokasi, error, refresh } = await useAsyncData(
  () => `lokasi-${id.value}`,
  async () => {
    let pertama: any = null

    for (const [jejak, pengunggah] of [[true, true], [true, false], [false, false]] as const) {
      const { data, error } = await ambilLokasi(jejak, pengunggah)
      if (!error) return data as any
      pertama ??= error
    }

    throw pertama
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

// Foto yang diunggah sejak penandaan otomatis ada sudah membawa tandanya di dalam
// berkasnya. Yang lebih tua ditandai lewat lapisan tampilan.
const SEJAK_BERTANDA = Date.parse('2026-09-06T08:46:00Z')
const perluTanda = (f: any) => !f.created_at || Date.parse(f.created_at) < SEJAK_BERTANDA

// Menyimpan nomor urut, bukan sekadar buka atau tutup, supaya pratinjaunya terbuka tepat
// pada foto yang diketuk.
const pratinjauDi = ref<number | null>(null)
const bukaPratinjau = (i: number) => { pratinjauDi.value = i }

// Pratinjau yang terbuka bisa menunjuk nomor yang sudah tidak ada setelah daftarnya
// berubah.
watch(foto, (baru) => {
  if (pratinjauDi.value !== null && pratinjauDi.value >= baru.length) pratinjauDi.value = null
})
const konfirmasi = computed(() => lokasi.value?.confirmations ?? [])
const jumlahAkurat = computed(() => konfirmasi.value.filter((k: any) => k.is_accurate).length)
const jumlahBerubah = computed(() => konfirmasi.value.length - jumlahAkurat.value)

const konfirmasiSaya = computed(() =>
  konfirmasi.value.find((k: any) => k.user_id === idPengguna.value) ?? null,
)

// Lapisan tampilan saja: yang menahan orang lain adalah RLS di basis data.
const pemilik = computed(() =>
  !!idPengguna.value && lokasi.value?.created_by === idPengguna.value,
)

// Ambangnya dipakai bersama kartu ringkas, ditulis sekali di use-lokasi.
const butuhPembaruan = computed(() =>
  perluDiperbarui({ jumlah_akurat: jumlahAkurat.value, jumlah_berubah: jumlahBerubah.value }),
)

// Baris tanpa created_by berarti data contoh lewat SQL, bukan kiriman warga.
const namaKontributor = computed(() => {
  const p = lokasi.value?.penambah
  const satu = Array.isArray(p) ? p[0] : p
  if (satu?.nama) return satu.nama
  return lokasi.value?.created_by ? 'Warga' : null
})

// Zona waktu eksplisit. Server render berjalan di UTC sedangkan peramban kontributor di
// WIB, dan tanpa ini keduanya menghasilkan tanggal berbeda sehingga Vue menandai hidrasi
// tidak cocok.
const pembaru = computed(() => {
  const l = lokasi.value
  if (!l?.updated_by || !l?.updated_at) return null
  const p = Array.isArray(l.pembaru) ? l.pembaru[0] : l.pembaru
  return {
    nama: p?.nama || 'Warga',
    tanggal: new Date(l.updated_at).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
  }
})

const tanggal = computed(() =>
  lokasi.value?.created_at
    ? new Date(lokasi.value.created_at).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
      })
    : '',
)

// Tautan biasa ke Google Maps, bukan navigasi buatan sendiri.
const rute = computed(() =>
  lokasi.value
    ? `https://www.google.com/maps/dir/?api=1&destination=${lokasi.value.lat},${lokasi.value.lng}`
    : '',
)

const mengirim = ref(false)
const pesanError = ref('')

// Boleh dihapus pengunggahnya sendiri atau pemilik lokasi. Yang menegakkannya kebijakan
// basis data; di sini hanya supaya tombolnya tidak disodorkan sia-sia.
const { tampilkan } = useNotifikasi()
const mintaKonfirmasi = ref<string | null>(null)
const menghapusFoto = ref<string | null>(null)

function bolehHapusFoto(f: any): boolean {
  if (!idPengguna.value) return false
  return f.uploaded_by === idPengguna.value || pemilik.value
}

async function hapusFoto(f: any) {
  // Dua ketukan, bukan dialog bawaan peramban: dialog mudah tertekan tanpa dibaca di layar
  // sentuh, dan menghapus foto tidak bisa dibatalkan.
  if (mintaKonfirmasi.value !== f.id) {
    mintaKonfirmasi.value = f.id
    return
  }

  menghapusFoto.value = f.id

  // Baris dulu, baru berkasnya. Kalau terbalik dan penghapusan baris gagal, yang tertinggal
  // adalah baris yang menunjuk gambar hilang, tampil rusak bagi semua orang.
  const { error: galatBaris } = await supabase
    .from('location_photos')
    .delete()
    .eq('id', f.id)

  if (galatBaris) {
    menghapusFoto.value = null
    mintaKonfirmasi.value = null
    tampilkan('Foto gagal dihapus. Hanya pengunggahnya atau kontributor lokasi ini yang bisa menghapusnya.', 'galat')
    return
  }

  const jalur = String(f.photo_url).split('/location-photos/')[1]
  if (jalur) {
    await supabase.storage.from('location-photos').remove([decodeURIComponent(jalur)])
  }

  menghapusFoto.value = null
  mintaKonfirmasi.value = null
  await refresh()
  tampilkan('Foto dihapus.')
}

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

useHead(() => ({ title: lokasi.value ? lokasi.value.nama : 'Lokasi' }))
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
      <p class="mt-1 text-sm text-gray-600">{{ labelKategori(lokasi.kategori) }}</p>

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

      <!-- Ditaruh tepat di bawah skor karena angka itulah yang sedang diragukan warga. -->
      <p
        v-if="butuhPembaruan" role="status"
        class="mt-4 rounded-lg border border-skor-sedang bg-white px-3 py-2.5 text-sm text-gray-800"
      >
        <span class="font-medium">Mungkin sudah berubah.</span>
        {{ jumlahBerubah }} warga melaporkan kondisi di sini tidak lagi sesuai catatan ini.
        Kalau Anda baru dari sana, foto dan daftar periksa yang baru sangat membantu.
      </p>

      <div class="mt-5 flex flex-wrap gap-3">
        <!-- Label dibedakan supaya jelas apa yang bisa diubah: pemilik mengubah seluruh datanya,
             yang lain hanya kondisinya. -->
        <NuxtLink
          v-if="user"
          :to="`/tambah-lokasi?ubah=${lokasi.id}`"
          class="tombol tombol-sekunder"
        >
          {{ pemilik ? 'Edit lokasi' : 'Perbarui kondisi' }}
        </NuxtLink>

        <TambahFoto
          v-if="foto.length < MAKS_FOTO_PER_LOKASI"
          :id-lokasi="lokasi.id" :jumlah-sekarang="foto.length"
          @tersimpan="refresh()"
        />

        <a
          :href="rute" target="_blank" rel="noopener noreferrer"
          class="tombol tombol-sekunder"
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
      </div>

      <!-- Judul bagian berdiri sendiri selebar penuh, seperti judul bagian lainnya. -->
      <h2 class="mt-6 text-base font-semibold">Foto kondisi</h2>

      <ul v-if="foto.length" class="mt-3 grid gap-2" :class="foto.length > 1 ? 'grid-cols-2' : 'grid-cols-1'">
        <li v-for="(f, i) in foto" :key="f.id" class="relative">
          <!-- Dipangkas jadi kotak supaya kisinya rapi, dan yang terpangkas sering justru bagian yang
               menentukan penilaian, jadi tiap foto bisa dibuka utuh. -->
          <button
            type="button"
            :aria-label="`Lihat foto ${i + 1} dari ${foto.length} ukuran penuh`"
            class="block w-full overflow-hidden rounded"
            @click="bukaPratinjau(i)"
          >
            <img
              :src="f.photo_url" :alt="`Kondisi ${lokasi.nama}`" loading="lazy"
              class="w-full object-cover transition-transform duration-200 hover:scale-[1.03]"
              :class="foto.length > 1 ? 'aspect-square' : 'aspect-[4/3]'"
            >
          </button>

          <TandaFoto v-if="perluTanda(f)" />

          <!-- Hanya untuk pengunggahnya sendiri atau pemilik lokasi. -->
          <button
            v-if="bolehHapusFoto(f)"
            type="button"
            :disabled="menghapusFoto === f.id"
            :aria-label="mintaKonfirmasi === f.id ? 'Ketuk sekali lagi untuk menghapus foto ini' : 'Hapus foto ini'"
            class="absolute right-2 top-2 inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-3 text-[13px] font-medium shadow-lg disabled:opacity-60"
            :class="mintaKonfirmasi === f.id ? 'border-skor-kurang text-skor-kurang' : 'border-gray-300 text-gray-800'"
            @click="hapusFoto(f)"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M9 7V5h6v2" />
              <path d="M6.5 7l.8 12h9.4l.8-12" />
            </svg>
            <span v-if="menghapusFoto === f.id">Menghapus</span>
            <span v-else-if="mintaKonfirmasi === f.id">Yakin hapus?</span>
            <span v-else>Hapus</span>
          </button>
        </li>
      </ul>
      <FotoKosong v-else class="mt-3" />

      <p v-if="foto.length >= MAKS_FOTO_PER_LOKASI" class="mt-2 text-sm text-gray-600">
        Sudah ada {{ MAKS_FOTO_PER_LOKASI }} foto di lokasi ini, jumlah maksimalnya.
      </p>

      <PratinjauFoto
        v-if="pratinjauDi !== null"
        :foto="foto" :mulai="pratinjauDi" :nama-lokasi="lokasi.nama"
        @tutup="pratinjauDi = null"
      />

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
      <p v-if="pembaru" class="mt-1 text-sm text-gray-700">
        Terakhir diperbarui {{ pembaru.nama }} pada {{ pembaru.tanggal }}.
      </p>

      <p class="mt-1 text-sm text-gray-700 tabular-nums">
        {{ jumlahAkurat }} warga menyatakan masih akurat<template v-if="jumlahBerubah">, {{ jumlahBerubah }} menyatakan sudah berubah</template>.
      </p>
      <p v-if="lokasi.status !== 'terverifikasi'" class="mt-1 text-sm text-gray-600">
        Butuh 3 konfirmasi akurat untuk berstatus terverifikasi.
      </p>

      <h2 class="mt-8 text-base font-semibold">Anda pernah ke sini?</h2>
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
