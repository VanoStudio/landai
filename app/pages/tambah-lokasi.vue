<script setup lang="ts">
// Alur pendek empat langkah, bukan satu form panjang: kontributor lapangan
// mengisi ini berulang kali di lokasi berbeda (DESIGN-BRIEF).
const supabase = useSupabaseClient()
const idPengguna = useIdPengguna()

const LANGKAH = ['Titik', 'Tempat', 'Fasilitas', 'Foto'] as const
const MAKS_FOTO_UNGGAH = 3
const langkah = ref(0)

// Titik awal: koridor Blok M (PRD bagian 9).
const titik = ref({ lat: -6.2440, lng: 106.7983 })
const nama = ref('')
const kategori = ref<string>('stasiun')
const checklist = ref<IsiChecklist>(checklistKosong())
const foto = ref<{ blob: Blob, pratinjau: string }[]>([])
const catatan = ref('')

const mengirim = ref(false)
const pesanError = ref('')
const idLokasiTersimpan = ref<string | null>(null)

const bolehLanjut = computed(() => {
  if (langkah.value === 1) return nama.value.trim().length >= 3
  return true
})

function maju() {
  if (langkah.value < LANGKAH.length - 1) langkah.value++
}

function mundur() {
  if (langkah.value > 0) langkah.value--
}

async function kirim() {
  if (!idPengguna.value) {
    pesanError.value = 'Sesi tidak terbaca. Coba muat ulang halaman lalu masuk lagi.'
    return
  }
  pesanError.value = ''
  mengirim.value = true

  try {
    // 1. Lokasi. Kalau langkah berikutnya gagal lalu user mencoba lagi,
    //    id yang sama dipakai ulang supaya tidak menumpuk baris kembar.
    if (!idLokasiTersimpan.value) {
      const { data, error } = await supabase
        .from('locations')
        .insert({
          nama: nama.value.trim(),
          kategori: kategori.value as any,
          lat: titik.value.lat,
          lng: titik.value.lng,
          created_by: idPengguna.value,
        })
        .select('id')
        .single()

      if (error) throw new Error(`Lokasi gagal disimpan. ${error.message}`)
      idLokasiTersimpan.value = (data as { id: string }).id
    }

    const idLokasi = idLokasiTersimpan.value!

    // 2. Checklist. Trigger di database yang menghitung skor dari sini.
    const { error: errChecklist } = await supabase
      .from('accessibility_checklist')
      .upsert({
        location_id: idLokasi,
        ...checklist.value,
        catatan: catatan.value.trim() || null,
      })

    if (errChecklist) throw new Error(`Checklist gagal disimpan. ${errChecklist.message}`)

    // 3. Foto. Kegagalan satu foto tidak membatalkan lokasi yang sudah tersimpan.
    //    Dipotong di sini juga, supaya batasnya tetap berlaku walau daftar di
    //    langkah sebelumnya sempat kebobolan.
    for (const [i, f] of foto.value.slice(0, MAKS_FOTO_UNGGAH).entries()) {
      const jalur = `${idLokasi}/${Date.now()}-${i}.jpg`
      const { error: errUnggah } = await supabase.storage
        .from('location-photos')
        .upload(jalur, f.blob, { contentType: 'image/jpeg', upsert: false })

      if (errUnggah) continue

      const { data: pub } = supabase.storage.from('location-photos').getPublicUrl(jalur)
      await supabase.from('location_photos').insert({ location_id: idLokasi, photo_url: pub.publicUrl })
    }

    await navigateTo(`/lokasi/${idLokasi}`)
  }
  catch (e: any) {
    pesanError.value = e?.message ?? 'Gagal menyimpan. Coba lagi.'
  }
  finally {
    mengirim.value = false
  }
}

useHead({ title: 'Tambah lokasi — landai' })
</script>

<template>
  <div class="mx-auto flex min-h-[100dvh] max-w-lg flex-col">
    <header class="border-b border-gray-200 px-4 py-3">
      <div class="flex items-center justify-between gap-3">
        <NuxtLink to="/" class="tombol tombol-tersier -ml-2">Batal</NuxtLink>
        <p class="text-sm text-gray-600 tabular-nums">Langkah {{ langkah + 1 }} dari {{ LANGKAH.length }}</p>
      </div>

      <ol class="mt-3 flex gap-1.5" aria-hidden="true">
        <li
          v-for="(l, i) in LANGKAH" :key="l"
          class="h-1 flex-1 rounded-full"
          :class="i <= langkah ? 'bg-brand' : 'bg-gray-200'"
        />
      </ol>
      <h1 class="mt-3 text-xl font-bold">
        <template v-if="langkah === 0">Di mana tempatnya</template>
        <template v-else-if="langkah === 1">Tempat apa ini</template>
        <template v-else-if="langkah === 2">Apa saja yang tersedia</template>
        <template v-else>Bukti dan catatan</template>
      </h1>
    </header>

    <main class="flex-1 px-4 py-5">
      <LangkahTitik v-if="langkah === 0" :lat="titik.lat" :lng="titik.lng" @geser="titik = $event" />
      <LangkahTempat v-else-if="langkah === 1" v-model:nama="nama" v-model:kategori="kategori" />
      <LangkahChecklist v-else-if="langkah === 2" v-model="checklist" />
      <LangkahFoto v-else v-model:foto="foto" v-model:catatan="catatan" />

      <p v-if="pesanError" role="alert" class="mt-4 rounded border border-skor-kurang px-3 py-2 text-sm text-skor-kurang">
        {{ pesanError }}
      </p>
    </main>

    <footer class="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-3">
      <div class="flex gap-3">
        <button
          v-if="langkah > 0" type="button"
          class="tombol tombol-sekunder"
          @click="mundur"
        >
          Kembali
        </button>

        <button
          v-if="langkah < LANGKAH.length - 1" type="button" :disabled="!bolehLanjut"
          class="tombol tombol-utama flex-1"
          @click="maju"
        >
          Lanjut
        </button>

        <button
          v-else type="button" :disabled="mengirim"
          class="tombol tombol-utama flex-1"
          @click="kirim"
        >
          {{ mengirim ? 'Menyimpan' : 'Simpan lokasi' }}
        </button>
      </div>

      <p v-if="langkah === 1 && !bolehLanjut" class="mt-2 text-sm text-gray-600">
        Isi nama tempat dulu, minimal 3 huruf.
      </p>
    </footer>
  </div>
</template>
