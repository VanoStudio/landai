<script setup lang="ts">
// Empat langkah pendek, bukan satu form panjang: kontributor mengisi ini berulang kali di
// lokasi berbeda dalam satu hari.
const supabase = useSupabaseClient()
const idPengguna = useIdPengguna()
const route = useRoute()
const { tampilkan } = useNotifikasi()

// Kunci diikat ke alamat penuh: tanpa ini, pindah dari alur tambah ke alur ubah hanya
// mengubah kueri tanpa memasang ulang komponen, jadi isian awalnya tidak terambil.
definePageMeta({ key: route => route.fullPath })

const MAKS_FOTO_UNGGAH = 3

const idUbah = computed(() => {
  const q = route.query.ubah
  return typeof q === 'string' && q.length > 0 ? q : null
})
const modeUbah = computed(() => idUbah.value !== null)

// Titik awal sebelum kontributor memakai GPS atau menggeser pin.
const titik = ref({ lat: -6.2705, lng: 106.8294 })
const nama = ref('')
// Sengaja kosong: nilai awal yang sudah terisi ikut terkirim apa adanya oleh orang yang
// hanya menekan Lanjut.
const kategori = ref<string>('')
const checklist = ref<IsiChecklist>(checklistKosong())
const foto = ref<{ blob: Blob, pratinjau: string }[]>([])
const catatan = ref('')

const mengirim = ref(false)
const pesanError = ref('')
const idLokasiTersimpan = ref<string | null>(null)

// Menentukan langkah mana yang boleh disentuh. Siapa pun yang masuk boleh memperbarui
// kondisi fasilitas; nama, kategori, dan koordinat tetap milik pembuatnya.
const pemilikLokasi = ref(true)

if (idUbah.value) {
  const { data: asal, error: galatAsal } = await useAsyncData(
    () => `ubah-${idUbah.value}`,
    async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, nama, kategori, lat, lng, created_by, accessibility_checklist (*)')
        .eq('id', idUbah.value as string)
        .maybeSingle()
      if (error) throw error
      return data as any
    },
  )

  if (galatAsal.value || !asal.value) {
    throw createError({ statusCode: 404, statusMessage: 'Lokasi tidak ditemukan', fatal: true })
  }

  pemilikLokasi.value = asal.value.created_by === idPengguna.value

  const c = Array.isArray(asal.value.accessibility_checklist)
    ? asal.value.accessibility_checklist[0]
    : asal.value.accessibility_checklist

  titik.value = { lat: asal.value.lat, lng: asal.value.lng }
  nama.value = asal.value.nama
  kategori.value = asal.value.kategori
  if (c) {
    checklist.value = {
      ramp_tersedia: c.ramp_tersedia,
      lebar_pintu_cukup: c.lebar_pintu_cukup,
      toilet_difabel: c.toilet_difabel,
      parkir_difabel: c.parkir_difabel,
      lift_tersedia_berfungsi: c.lift_tersedia_berfungsi,
      guiding_block_tersambung: c.guiding_block_tersambung,
      tempat_duduk_tersedia: c.tempat_duduk_tersedia,
      permukaan_jalan_rata: c.permukaan_jalan_rata,
    }
    catatan.value = c.catatan ?? ''
  }
  idLokasiTersimpan.value = asal.value.id
}

// Bukan pemilik hanya melihat daftar periksa dan foto, karena hanya itu yang boleh ia
// ubah.
const langkahTersedia = computed<number[]>(() =>
  modeUbah.value && !pemilikLokasi.value ? [2, 3] : [0, 1, 2, 3],
)

const posisi = ref(0)
const langkah = computed(() => langkahTersedia.value[posisi.value] ?? 0)
const terakhir = computed(() => posisi.value >= langkahTersedia.value.length - 1)

const bolehLanjut = computed(() => {
  if (langkah.value === 1) return nama.value.trim().length >= 3 && kategori.value !== ''
  return true
})

const kurangApa = computed(() => {
  if (nama.value.trim().length < 3) return 'Isi nama tempat dulu, minimal 3 huruf.'
  if (kategori.value === '') return 'Pilih jenis tempatnya dulu.'
  return ''
})

async function maju() {
  // Dijalankan saat meninggalkan langkah titik, karena di situlah koordinatnya pasti.
  if (langkah.value === 0) await periksaDuplikat()
  if (!terakhir.value) posisi.value++
}

function mundur() {
  if (posisi.value > 0) posisi.value--
}

async function kirim() {
  if (!idPengguna.value) {
    pesanError.value = 'Sesi tidak terbaca. Coba muat ulang halaman lalu masuk lagi.'
    return
  }

  if (!periksaKataKasar(true)) return

  pesanError.value = ''
  mengirim.value = true

  try {
    // Kolom skor dan status tidak ikut dikirim: hak tulisnya dicabut dari peran klien, hanya
    // pemicu basis data yang boleh mengisinya.
    if (modeUbah.value && pemilikLokasi.value) {
      const { error } = await supabase
        .from('locations')
        .update({
          nama: nama.value.trim(),
          kategori: kategori.value as any,
          lat: titik.value.lat,
          lng: titik.value.lng,
        })
        .eq('id', idUbah.value as string)

      if (error) throw new Error(`Perubahan lokasi gagal disimpan. ${error.message}`)
    }
    else if (!idLokasiTersimpan.value) {
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

    // JANGAN diganti upsert. Upsert PostgREST menyetel seluruh kolom termasuk
    // location_id, dan Postgres memeriksa hak UPDATE saat menyusun rencana, jadi
    // dijawab "42501 permission denied" walaupun barisnya baru. Hak kolom itu dicabut
    // untuk menutup pemindahan baris daftar periksa ke lokasi orang lain.
    const isi = {
      ...checklist.value,
      catatan: catatan.value.trim() || null,
    }

    async function simpanChecklist() {
      const { data: terubah, error } = await supabase
        .from('accessibility_checklist')
        .update(isi)
        .eq('location_id', idLokasi)
        .select('location_id')

      if (error) throw new Error(`Daftar periksa gagal disimpan. ${error.message}`)
      if (terubah && terubah.length > 0) return

      // Nol baris bisa berarti barisnya belum ada atau izinnya ditolak, dan keduanya tidak bisa
      // dibedakan dari peramban.
      if (modeUbah.value && !pemilikLokasi.value) {
        throw new Error('Pembaruan tidak tersimpan. Untuk saat ini lokasi ini hanya bisa diperbarui oleh kontributor yang menambahkannya.')
      }

      const { error: errIsi } = await supabase
        .from('accessibility_checklist')
        .insert({ location_id: idLokasi, ...isi })

      if (errIsi) throw new Error(`Daftar periksa gagal disimpan. ${errIsi.message}`)
    }

    if (modeUbah.value) {
      await simpanChecklist()
    }
    else {
      // Simpan ulang setelah kegagalan sebagian memakai id yang sama, jadi bentrokan kunci ganda
      // dijatuhkan ke jalur perbarui.
      const { error: errIsi } = await supabase
        .from('accessibility_checklist')
        .insert({ location_id: idLokasi, ...isi })

      if (errIsi) {
        if (errIsi.code !== '23505') throw new Error(`Daftar periksa gagal disimpan. ${errIsi.message}`)
        await simpanChecklist()
      }
    }

    // Kegagalan satu foto tidak membatalkan lokasi yang sudah tersimpan.
    for (const [i, f] of foto.value.slice(0, MAKS_FOTO_UNGGAH).entries()) {
      const jalur = `${idLokasi}/${Date.now()}-${i}.jpg`
      const { error: errUnggah } = await supabase.storage
        .from('location-photos')
        .upload(jalur, f.blob, { contentType: 'image/jpeg', upsert: false })

      if (errUnggah) continue

      const { data: pub } = supabase.storage.from('location-photos').getPublicUrl(jalur)
      await supabase.from('location_photos').insert({ location_id: idLokasi, photo_url: pub.publicUrl })
    }

    tampilkan(
      !modeUbah.value
        ? 'Lokasi tersimpan dan sudah muncul di peta. Terima kasih sudah menambahkannya.'
        : pemilikLokasi.value
          ? 'Perubahan tersimpan. Lokasi ini kembali berstatus belum terverifikasi.'
          : 'Terima kasih. Pembaruan Anda tersimpan dan tercatat atas nama Anda, dan lokasi ini kembali berstatus belum terverifikasi.',
    )

    // replace, bukan push: formulir yang sudah selesai tidak boleh tinggal di riwayat, karena
    // tombol kembali akan memunculkannya lagi dalam keadaan kosong.
    await navigateTo(`/lokasi/${idLokasi}`, { replace: true })
  }
  catch (e: any) {
    pesanError.value = e?.message ?? 'Gagal menyimpan. Coba lagi.'
  }
  finally {
    mengirim.value = false
  }
}

// Peringatan duplikat. Dua syarat sekaligus, jarak DAN kemiripan nama: satu syarat saja
// terlalu sering salah tuduh.
const kandidatDekat = ref<{ id: string, nama: string, jarak: number }[]>([])
const duplikatDiabaikan = ref(false)

async function periksaDuplikat() {
  if (modeUbah.value) return

  // Kotak pembatas kasar dulu supaya baris yang diambil sedikit, baru jaraknya dihitung
  // tepat. Satu derajat lintang sekitar 111.320 meter.
  const d = RADIUS_DUPLIKAT / 111320
  const dLng = d / Math.max(0.2, Math.cos((titik.value.lat * Math.PI) / 180))

  const { data } = await supabase
    .from('locations')
    .select('id, nama, lat, lng')
    .gte('lat', titik.value.lat - d).lte('lat', titik.value.lat + d)
    .gte('lng', titik.value.lng - dLng).lte('lng', titik.value.lng + dLng)

  kandidatDekat.value = ((data ?? []) as any[])
    .map(l => ({ id: l.id, nama: l.nama, jarak: jarakMeter(titik.value, l) }))
    .filter(l => l.jarak <= RADIUS_DUPLIKAT)
    .sort((a, b) => a.jarak - b.jarak)
}

const kemungkinanDuplikat = computed(() => {
  if (duplikatDiabaikan.value || modeUbah.value) return null
  const n = nama.value.trim()
  if (n.length < 3) return null
  return kandidatDekat.value.find(k => namanyaMirip(k.nama, n)) ?? null
})

// Peringatan isi kasar. Menahan pengiriman sekali supaya terbaca, lalu mempersilakan:
// penyaring kata mana pun akan salah menuduh nama tempat yang sah cepat atau lambat.
type KolomTeks = 'nama' | 'catatan'

const kataTerpicu = ref<string[]>([])
const kolomTerpicu = ref<KolomTeks[]>([])
const menungguKirim = ref(false)

const isiDisetujui = ref<string | null>(null)
// JSON, bukan gabungan berpemisah: pemisah apa pun bisa muncul di dalam isinya sendiri dan
// membuat dua isi berbeda menghasilkan tanda yang sama.
const tandaIsi = computed(() => JSON.stringify([nama.value.trim(), catatan.value.trim()]))

const kolomDiperiksa = computed<KolomTeks[]>(() =>
  modeUbah.value && !pemilikLokasi.value ? ['catatan'] : ['nama', 'catatan'],
)

// Kedua kolom diperiksa sampai habis: menyebut satu saja membuat orang memperbaiki satu
// lalu tertahan lagi oleh yang lain.
function periksaKataKasar(dariKirim: boolean): boolean {
  const kata = new Set<string>()
  const kolom: KolomTeks[] = []

  for (const k of kolomDiperiksa.value) {
    const hasil = detectToxicWords(k === 'nama' ? nama.value : catatan.value)
    if (!hasil.isToxic) continue
    hasil.matchedWords.forEach(w => kata.add(w))
    kolom.push(k)
  }

  if (kolom.length === 0) {
    kataTerpicu.value = []
    kolomTerpicu.value = []
    return true
  }

  if (isiDisetujui.value === tandaIsi.value) return true

  kataTerpicu.value = [...kata]
  kolomTerpicu.value = kolom
  menungguKirim.value = dariKirim
  return false
}

// focusout, bukan blur: hanya focusout yang menggelembung ke wadah, jadi komponen
// langkahnya tidak perlu diubah.
function saatKeluarKolom(e: FocusEvent) {
  const id = (e.target as HTMLElement | null)?.id
  if (id === 'nama-tempat' || id === 'catatan') periksaKataKasar(false)
}

function keKolomTerpicu() {
  const pertama = kolomTerpicu.value[0] ?? 'catatan'
  const i = langkahTersedia.value.indexOf(pertama === 'nama' ? 1 : 3)
  if (i >= 0) posisi.value = i

  const idKolom = pertama === 'nama' ? 'nama-tempat' : 'catatan'
  kataTerpicu.value = []
  menungguKirim.value = false

  nextTick(() => {
    const el = document.getElementById(idKolom)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus()
  })
}

function tetapKirim() {
  isiDisetujui.value = tandaIsi.value
  kataTerpicu.value = []
  kolomTerpicu.value = []
  if (menungguKirim.value) {
    menungguKirim.value = false
    kirim()
  }
}

watch(tandaIsi, () => {
  if (kataTerpicu.value.length) kataTerpicu.value = []
})

useHead(() => ({ title: modeUbah.value ? 'Edit Lokasi' : 'Tambah Lokasi' }))
</script>

<template>
  <div class="mx-auto flex min-h-[100dvh] max-w-lg flex-col">
    <header class="border-b border-gray-200 px-4 py-3">
      <div class="flex items-center gap-3">
        <NuxtLink
          :to="modeUbah ? `/lokasi/${idUbah}` : '/'"
          class="tombol tombol-tersier -ml-2"
        >Batal</NuxtLink>
        <MerekLandai class="mx-auto" :ukuran="20" tulisan="text-sm" />
        <p class="shrink-0 text-sm text-gray-600 tabular-nums">Langkah {{ posisi + 1 }} dari {{ langkahTersedia.length }}</p>
      </div>

      <ol class="mt-3 flex gap-1.5" aria-hidden="true">
        <li
          v-for="(l, i) in langkahTersedia" :key="l"
          class="h-1 flex-1 rounded-full"
          :class="i <= posisi ? 'bg-brand' : 'bg-gray-200'"
        />
      </ol>

      <p v-if="modeUbah && pemilikLokasi" class="mt-3 text-sm text-gray-600">
        <span class="font-medium text-gray-800">Mengubah lokasi Anda.</span>
        Setelah disimpan, statusnya kembali menjadi belum terverifikasi, karena
        konfirmasi warga sebelumnya berlaku untuk data versi lama.
      </p>

      <p v-else-if="modeUbah" class="mt-3 text-sm text-gray-600">
        <span class="font-medium text-gray-800">Membantu memperbarui data lokasi ini.</span>
        Nama, jenis, dan titiknya hanya bisa diubah kontributor yang menambahkannya, jadi
        di sini Anda memperbarui kondisi fasilitas dan fotonya. Pembaruan Anda tercatat
        atas nama Anda, dan lokasi ini kembali berstatus belum terverifikasi supaya warga lain
        memeriksanya lagi.
      </p>

      <h1 class="mt-3 text-xl font-bold">
        <template v-if="langkah === 0">Di mana tempatnya</template>
        <template v-else-if="langkah === 1">Tempat apa ini</template>
        <template v-else-if="langkah === 2">Apa saja yang tersedia</template>
        <template v-else>Bukti dan catatan</template>
      </h1>
    </header>

    <!-- focusout, bukan blur, karena hanya focusout yang menggelembung ke wadah. Dengan begitu
         kolom nama dan catatan bisa diperiksa saat ditinggalkan tanpa mengubah komponen
         langkahnya sama sekali. -->
    <main class="flex-1 px-4 py-5" @focusout="saatKeluarKolom">
      <LangkahTitik v-if="langkah === 0" :lat="titik.lat" :lng="titik.lng" @geser="titik = $event" />
      <template v-else-if="langkah === 1">
        <LangkahTempat v-model:nama="nama" v-model:kategori="kategori" />

        <!-- Peringatan kemungkinan duplikat. -->
        <section
          v-if="kemungkinanDuplikat" role="status"
          class="mt-4 rounded-lg border border-skor-sedang bg-white px-4 py-3"
        >
          <h2 class="text-sm font-semibold">Mungkin tempat ini sudah ada di peta</h2>
          <p class="mt-1 text-sm text-gray-700">
            Ada <span class="font-medium">{{ kemungkinanDuplikat.nama }}</span> sekitar
            {{ Math.round(kemungkinanDuplikat.jarak) }} meter dari titik yang Anda pilih,
            dan namanya mirip. Kalau memang tempat yang sama, memperbarui yang sudah ada
            lebih berguna daripada menambah baris kedua.
          </p>

          <div class="mt-3 flex flex-wrap gap-2">
            <NuxtLink
              :to="`/tambah-lokasi?ubah=${kemungkinanDuplikat.id}`"
              class="tombol tombol-sekunder"
            >
              Perbarui yang sudah ada
            </NuxtLink>
            <button
              type="button" class="tombol tombol-tersier"
              @click="duplikatDiabaikan = true"
            >
              Ini tempat lain, lanjutkan
            </button>
          </div>
        </section>
      </template>
      <LangkahChecklist v-else-if="langkah === 2" v-model="checklist" />
      <LangkahFoto v-else v-model:foto="foto" v-model:catatan="catatan" />

      <PeringatanKata
        v-if="kataTerpicu.length"
        :matched-words="kataTerpicu"
        :kolom="kolomTerpicu"
        @edit="keKolomTerpicu"
        @lanjut="tetapKirim"
      />

      <p v-if="pesanError" role="alert" class="mt-4 rounded-lg border border-skor-kurang px-3 py-2 text-sm text-skor-kurang">
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
          v-if="!terakhir" type="button" :disabled="!bolehLanjut"
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
          {{ mengirim ? 'Menyimpan' : (modeUbah ? 'Simpan perubahan' : 'Simpan lokasi') }}
        </button>
      </div>

      <p v-if="langkah === 1 && kurangApa" class="mt-2 text-sm text-gray-600">
        {{ kurangApa }}
      </p>
    </footer>
  </div>
</template>
