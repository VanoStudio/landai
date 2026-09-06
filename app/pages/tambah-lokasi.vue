<script setup lang="ts">
// Alur pendek empat langkah, bukan satu form panjang: kontributor lapangan
// mengisi ini berulang kali di lokasi berbeda (DESIGN.md).
const supabase = useSupabaseClient()
const idPengguna = useIdPengguna()
const route = useRoute()
const { tampilkan } = useNotifikasi()

// Kunci halaman diikat ke alamat penuh, termasuk kuerinya. Tanpa ini, berpindah dari
// alur tambah ke alur ubah lewat peringatan duplikat hanya mengubah kueri tanpa
// memasang ulang komponennya, jadi isian awalnya tidak pernah terambil.
definePageMeta({ key: route => route.fullPath })

const MAKS_FOTO_UNGGAH = 3

// Menyunting memakai halaman yang sama persis dengan menambah: empat langkah yang
// sama, komponen yang sama, hanya isian awalnya diambil dari baris yang sudah ada.
// Membuat halaman kedua berarti dua alur yang harus dijaga sejalan selamanya.
const idUbah = computed(() => {
  const q = route.query.ubah
  return typeof q === 'string' && q.length > 0 ? q : null
})
const modeUbah = computed(() => idUbah.value !== null)

// Titik awal: koridor Blok M (PRD bagian 9).
const titik = ref({ lat: -6.2440, lng: 106.7983 })
const nama = ref('')
// Sengaja kosong, bukan berisi jenis pertama. Nilai awal yang sudah terisi ikut
// terkirim apa adanya oleh orang yang hanya menekan Lanjut, dan itulah yang membuat
// empat halte pada survei pertama tercatat dengan jenis yang tidak dipilih siapa pun.
const kategori = ref<string>('')
const checklist = ref<IsiChecklist>(checklistKosong())
const foto = ref<{ blob: Blob, pratinjau: string }[]>([])
const catatan = ref('')

const mengirim = ref(false)
const pesanError = ref('')
const idLokasiTersimpan = ref<string | null>(null)

// Siapa pemilik lokasi yang sedang dibuka. Bukan lagi penjaga pintu, melainkan penentu
// langkah mana yang boleh disentuh: sejak schema-patch-5.sql siapa pun yang sudah masuk
// boleh memperbarui KONDISI fasilitas, tetapi nama, kategori, dan koordinat tetap milik
// pembuatnya. Batas itu ditegakkan aturan keamanan tingkat baris dan hak akses kolom di
// basis data; yang di sini hanya supaya orang tidak disodori isian yang pasti ditolak.
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

// Langkah mana yang tampil. Bukan pemilik hanya melihat dua langkah terakhir, yaitu
// daftar periksa dan bukti foto, karena hanya itu yang boleh ia ubah. Menyembunyikan
// dua langkah pertama lebih jujur daripada menampilkannya lalu menolak simpanannya.
const langkahTersedia = computed<number[]>(() =>
  modeUbah.value && !pemilikLokasi.value ? [2, 3] : [0, 1, 2, 3],
)

// Posisi di dalam daftar langkah yang tampil, bukan nomor langkah aslinya. Keduanya
// dipisah supaya isi tiap langkah tidak perlu tahu langkah mana saja yang disembunyikan.
const posisi = ref(0)
const langkah = computed(() => langkahTersedia.value[posisi.value] ?? 0)
const terakhir = computed(() => posisi.value >= langkahTersedia.value.length - 1)

const bolehLanjut = computed(() => {
  if (langkah.value === 1) return nama.value.trim().length >= 3 && kategori.value !== ''
  return true
})

// Kalimat penuntunnya menyebut apa yang KURANG, bukan satu kalimat tetap yang
// menyuruh mengisi nama padahal namanya sudah diisi dan yang belum justru jenisnya.
const kurangApa = computed(() => {
  if (nama.value.trim().length < 3) return 'Isi nama tempat dulu, minimal 3 huruf.'
  if (kategori.value === '') return 'Pilih jenis tempatnya dulu.'
  return ''
})

async function maju() {
  // Pemeriksaan duplikat dijalankan saat meninggalkan langkah titik, karena di situlah
  // koordinatnya baru pasti. Namanya sendiri baru dibandingkan di langkah berikutnya.
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

  // Isi kasar menahan pengiriman satu kali supaya peringatannya terbaca. Sesudah
  // penulisnya menekan "Tetap kirim", isi yang sama persis tidak ditanya lagi.
  if (!periksaKataKasar(true)) return

  pesanError.value = ''
  mengirim.value = true

  try {
    // 1. Lokasi. Saat menyunting, barisnya diperbarui; saat menambah, dibuat.
    //    Kolom skor dan status sengaja tidak ikut dikirim: hak tulis kedua kolom itu
    //    dicabut dari peran klien di schema-patch-3.sql, dan hanya pemicu basis data
    //    yang boleh mengisinya.
    // Bukan pemilik tidak menyentuh baris locations sama sekali. Kalaupun dicoba,
    // aturan keamanan tingkat baris akan menolaknya, tapi mengirim permintaan yang
    // sudah pasti ditolak hanya menghasilkan pesan galat yang membingungkan.
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

    // 2. Checklist. Trigger di database yang menghitung skor dari sini, dan pada
    //    penyuntingan pemicu kedua menghapus konfirmasi lama lalu menurunkan status
    //    kembali ke belum terverifikasi. Keduanya di basis data, bukan di sini, jadi
    //    tidak ada jalan menyunting data tanpa ikut menurunkan statusnya.
    //    TIDAK memakai upsert, dan ini bukan pilihan gaya.
    //
    //    Upsert milik PostgREST diterjemahkan menjadi insert on conflict do update yang
    //    menyetel SELURUH kolom yang dikirim, termasuk location_id. Postgres memeriksa
    //    hak UPDATE saat menyusun rencana, bukan saat konflik benar-benar terjadi, jadi
    //    perintah itu menuntut hak update atas location_id walaupun barisnya baru dan
    //    tidak akan pernah bentrok. Hak itu sengaja dicabut di schema-patch-5.sql untuk
    //    menutup serangan pemindahan baris daftar periksa ke lokasi orang lain, jadi
    //    setiap upsert dijawab:
    //
    //      42501 permission denied for table accessibility_checklist
    //
    //    Terukur: seluruh alur tambah lokasi mati karenanya. Pertahanan kolomnya benar
    //    dan tetap dipertahankan; yang diganti cara menyimpannya.
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

      // Nol baris tersentuh. Bisa berarti barisnya memang belum ada, bisa juga berarti
      // izin memperbarui data orang lain belum aktif. Keduanya tidak bisa dibedakan dari
      // sisi peramban, jadi bagi bukan pemilik kalimatnya tidak menyebut sebab yang
      // belum tentu benar.
      if (modeUbah.value && !pemilikLokasi.value) {
        throw new Error('Pembaruan tidak tersimpan. Untuk saat ini lokasi ini hanya bisa diperbarui oleh kontributor yang menambahkannya.')
      }

      const { error: errIsi } = await supabase
        .from('accessibility_checklist')
        .insert({ location_id: idLokasi, ...isi })

      if (errIsi) throw new Error(`Daftar periksa gagal disimpan. ${errIsi.message}`)
    }

    if (modeUbah.value) {
      // Barisnya hampir pasti sudah ada, jadi diperbarui lebih dulu.
      await simpanChecklist()
    }
    else {
      // Lokasi baru: barisnya pasti belum ada. Kalau simpan diulang setelah kegagalan
      // sebagian, id lokasinya dipakai ulang dan barisnya sudah ada, jadi bentrokan
      // kunci ganda dijatuhkan ke jalur perbarui.
      const { error: errIsi } = await supabase
        .from('accessibility_checklist')
        .insert({ location_id: idLokasi, ...isi })

      if (errIsi) {
        if (errIsi.code !== '23505') throw new Error(`Daftar periksa gagal disimpan. ${errIsi.message}`)
        await simpanChecklist()
      }
    }

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

    // Menambah lokasi dulu tidak memberi kabar apa pun, hanya mode ubah yang memberi.
    // Halaman berganti begitu saja, dan orang yang baru mengisi empat langkah di
    // lapangan tidak punya penanda bahwa pekerjaannya benar-benar tersimpan.
    tampilkan(
      !modeUbah.value
        ? 'Lokasi tersimpan dan sudah muncul di peta. Terima kasih sudah menambahkannya.'
        : pemilikLokasi.value
          ? 'Perubahan tersimpan. Lokasi ini kembali berstatus belum terverifikasi.'
          : 'Terima kasih. Pembaruan Anda tersimpan dan tercatat atas nama Anda, dan lokasi ini kembali berstatus belum terverifikasi.',
    )

    // replace, bukan push. Formulir yang sudah selesai tidak boleh tinggal di riwayat
    // peramban. Menekan tombol kembali di ponsel sesudah menyimpan justru mengembalikan
    // orang ke formulir, dan karena halaman ini berkunci pada alamat penuhnya, yang
    // muncul adalah formulir KOSONG, seolah simpanannya hilang. Dengan replace, kembali
    // berarti kembali ke peta, yang memang yang diharapkan orang.
    await navigateTo(`/lokasi/${idLokasi}`, { replace: true })
  }
  catch (e: any) {
    pesanError.value = e?.message ?? 'Gagal menyimpan. Coba lagi.'
  }
  finally {
    mengirim.value = false
  }
}

// ---------------------------------------------------------------------------
// Peringatan lokasi kemungkinan duplikat.
//
// Dua syarat harus terpenuhi bersamaan: titiknya dalam radius empat puluh meter DAN
// namanya mirip. Satu syarat saja terlalu sering salah tuduh. Dua kios berbeda di
// gedung yang sama memang berjarak beberapa meter, dan dua cabang toko yang sama
// memang bernama persis sama walau berjauhan.
//
// Peringatannya tidak pernah memblokir. Bisa saja itu memang tempat berbeda yang
// kebetulan berdekatan dan bernama mirip, dan orang yang sedang berdiri di sana lebih
// tahu daripada rumus jarak.
// ---------------------------------------------------------------------------
const kandidatDekat = ref<{ id: string, nama: string, jarak: number }[]>([])
const duplikatDiabaikan = ref(false)

async function periksaDuplikat() {
  if (modeUbah.value) return

  // Kotak pembatas kasar dulu, supaya yang diambil dari basis data sedikit, baru
  // jaraknya dihitung tepat. Satu derajat lintang sekitar 111.320 meter; untuk bujur
  // angkanya menyusut mengikuti kosinus lintang.
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

// ---------------------------------------------------------------------------
// Peringatan isi kasar. Menegur, bukan memblokir.
//
// Isi formulir ini terbaca warga lain yang membuka peta, termasuk orang yang
// memakainya untuk memutuskan apakah sebuah tempat bisa mereka datangi. Karena itu
// nama tempat dan catatan lapangan ditegur kalau mengandung kata kasar.
//
// Tetapi keputusannya tetap di tangan penulisnya. Penyaring kata mana pun akan
// salah menuduh cepat atau lambat, dan nama tempat sungguhan di Indonesia terlalu
// beragam untuk dipercayakan pada sebuah daftar. Jadi peringatannya menahan
// pengiriman SEKALI, lalu mempersilakan.
//
// Ditahan sekali, bukan nol kali, supaya peringatannya benar-benar terbaca. Dan
// bukan lebih dari sekali, supaya orang yang memang menulis "Rumah Makan Babi
// Panggang" tidak dipaksa berdebat dengan mesin.
// ---------------------------------------------------------------------------
type KolomTeks = 'nama' | 'catatan'

const kataTerpicu = ref<string[]>([])
const kolomTerpicu = ref<KolomTeks[]>([])
const menungguKirim = ref(false)

// Isi persis yang sudah pernah disetujui penggunanya. Begitu ia mengubah salah satu
// kolom, tandanya tidak lagi cocok dan peringatannya berhak muncul lagi.
const isiDisetujui = ref<string | null>(null)
// Ditulis sebagai JSON, bukan gabungan berpemisah. Pemisah apa pun bisa muncul
// di dalam isi kolomnya sendiri, dan dua isi berbeda akan menghasilkan tanda yang
// sama persis, sehingga persetujuan untuk isi lama ikut berlaku untuk isi baru.
const tandaIsi = computed(() => JSON.stringify([nama.value.trim(), catatan.value.trim()]))

// Bukan pemilik hanya menyunting kondisi fasilitas dan catatannya; nama tempat tidak
// pernah ikut terkirim, jadi tidak ada gunanya menegur soal nama.
const kolomDiperiksa = computed<KolomTeks[]>(() =>
  modeUbah.value && !pemilikLokasi.value ? ['catatan'] : ['nama', 'catatan'],
)

// Kedua kolom diperiksa sampai habis, bukan berhenti di temuan pertama. Kalau nama
// dan catatan sama-sama bermasalah, menyebut salah satunya saja membuat orang
// memperbaiki satu lalu tertahan lagi oleh yang satunya tanpa tahu sebabnya.
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

  // Sudah pernah disetujui untuk isi yang persis sama: jangan tanya dua kali.
  if (isiDisetujui.value === tandaIsi.value) return true

  kataTerpicu.value = [...kata]
  kolomTerpicu.value = kolom
  menungguKirim.value = dariKirim
  return false
}

// Diperiksa saat fokus meninggalkan kolomnya, bukan pada setiap ketikan. Menegur
// orang di tengah mengetik hanya mengganggu, karena kata belum tentu selesai.
// Dipasang di wadah lewat focusout, satu-satunya peristiwa fokus yang menggelembung,
// supaya komponen langkahnya tidak perlu diubah sama sekali.
function saatKeluarKolom(e: FocusEvent) {
  const id = (e.target as HTMLElement | null)?.id
  if (id === 'nama-tempat' || id === 'catatan') periksaKataKasar(false)
}

// Diantar ke kolom bermasalah yang pertama. Kalau keduanya bermasalah, yang kedua
// akan menahan pengiriman berikutnya, dan bannernya menyebut kedua kolom sejak awal
// jadi tidak ada kejutan.
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

// Isi berubah setelah disetujui: peringatan lama tidak lagi berlaku, dan
// persetujuannya pun tidak. Keduanya dilepas supaya isi baru diperiksa dari awal.
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

      <!-- Bilah kemajuan mengikuti langkah yang benar-benar tampil, bukan keempatnya,
           supaya bukan pemilik tidak melihat dua ruas yang tidak pernah bisa ia isi. -->
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

    <!-- focusout, bukan blur, karena hanya focusout yang menggelembung ke wadah.
         Dengan begitu kolom nama dan catatan bisa diperiksa saat ditinggalkan tanpa
         mengubah komponen langkahnya sama sekali. -->
    <main class="flex-1 px-4 py-5" @focusout="saatKeluarKolom">
      <LangkahTitik v-if="langkah === 0" :lat="titik.lat" :lng="titik.lng" @geser="titik = $event" />
      <template v-else-if="langkah === 1">
        <LangkahTempat v-model:nama="nama" v-model:kategori="kategori" />

        <!-- Peringatan kemungkinan duplikat. Tidak pernah memblokir: bisa saja ini
             memang tempat berbeda yang kebetulan berdekatan dan bernama mirip, dan
             orang yang sedang berdiri di sana lebih tahu daripada rumus jarak. -->
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
