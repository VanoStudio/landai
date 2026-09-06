<script setup lang="ts">
// Menambah foto langsung dari halaman detail lokasi.
//
// Sebelum ini satu-satunya jalan menambah foto adalah membuka formulir sunting lalu
// menyusuri tiga langkah yang tidak ada hubungannya, yaitu titik, nama, dan daftar
// periksa, hanya untuk sampai ke langkah keempat. Padahal justru foto yang paling
// sering ditambahkan belakangan: orang lewat, melihat kondisinya, lalu memotret.
// Halaman detail sudah menyatakan "satu foto kondisinya sangat membantu warga lain",
// tetapi sebelumnya tidak memberi satu pun tombol untuk melakukannya.
//
// Siapa pun yang sudah masuk boleh menambah, bukan hanya pemilik lokasi. Itu bukan
// pelonggaran baru: aturan basis data sudah berbunyi begitu sejak schema-patch-5.sql,
// dan formulir sunting pun sudah mengizinkannya. Yang berubah hanya jalannya
// dipersingkat.
const props = defineProps<{
  idLokasi: string
  jumlahSekarang: number
}>()

const emit = defineEmits<{ tersimpan: [] }>()

const MAKS_PER_LOKASI = MAKS_FOTO_PER_LOKASI

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { tampilkan } = useNotifikasi()

const input = ref<HTMLInputElement | null>(null)
const mengunggah = ref(false)
const kemajuan = ref('')

// Halaman induk yang memutuskan kapan tombol ini berhenti ditawarkan, jadi di sini
// sisa kuota hanya dipakai untuk memotong berkas yang dipilih sekaligus.
const sisa = computed(() => Math.max(0, MAKS_PER_LOKASI - props.jumlahSekarang))

async function pilihBerkas(e: Event) {
  const el = e.target as HTMLInputElement
  const berkas = [...(el.files ?? [])]
  if (berkas.length === 0) return

  // Dipotong di sini, bukan hanya disembunyikan di tampilan. Memilih empat berkas
  // sekaligus lewat pemilih berkas bawaan tetap mungkin walau tombolnya disembunyikan.
  const dipakai = berkas.slice(0, sisa.value)
  const dibuang = berkas.length - dipakai.length

  mengunggah.value = true
  let berhasil = 0

  try {
    for (const [i, b] of dipakai.entries()) {
      kemajuan.value = dipakai.length > 1 ? `Mengunggah ${i + 1} dari ${dipakai.length}` : 'Mengunggah'

      const blob = await kecilkanFoto(b)
      const jalur = `${props.idLokasi}/${Date.now()}-${i}.jpg`

      const { error: errUnggah } = await supabase.storage
        .from('location-photos')
        .upload(jalur, blob, { contentType: 'image/jpeg', upsert: false })

      if (errUnggah) continue

      const { data: pub } = supabase.storage.from('location-photos').getPublicUrl(jalur)
      const { error: errBaris } = await supabase
        .from('location_photos')
        .insert({ location_id: props.idLokasi, photo_url: pub.publicUrl })

      // Baris gagal tersimpan berarti fotonya tidak akan pernah tampil. Berkasnya
      // ditarik lagi supaya tidak tertinggal sebagai berkas yatim di Storage.
      if (errBaris) {
        await supabase.storage.from('location-photos').remove([jalur])
        continue
      }
      berhasil++
    }

    if (berhasil === 0) {
      tampilkan('Foto gagal diunggah. Periksa koneksi lalu coba lagi.', 'galat')
    }
    else {
      tampilkan(dibuang > 0
        ? `${berhasil} foto tersimpan. ${dibuang} foto tidak ikut karena batasnya ${MAKS_PER_LOKASI} foto per lokasi.`
        : `${berhasil} foto tersimpan. Terima kasih.`)
      emit('tersimpan')
    }
  }
  catch {
    tampilkan('Foto gagal diproses. Coba ambil ulang.', 'galat')
  }
  finally {
    mengunggah.value = false
    kemajuan.value = ''
    if (input.value) input.value.value = ''
  }
}
</script>

<template>
  <!-- Pengunjung tanpa akun diberi tahu apa yang perlu dilakukan, bukan disodori
       tombol yang lalu menolaknya. Alamat kembalinya ikut dibawa, jadi setelah masuk
       ia mendarat lagi di halaman lokasi yang sedang dilihatnya, bukan di peta. -->
  <NuxtLink
    v-if="!user"
    :to="`/masuk?redirect=/lokasi/${idLokasi}`"
    class="tombol tombol-sekunder"
  >
    Masuk untuk tambah foto
  </NuxtLink>

  <label
    v-else
    class="tombol tombol-sekunder cursor-pointer"
    :class="mengunggah ? 'pointer-events-none opacity-60' : ''"
  >
    <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 8.5h3.2l1.4-2h7.8l1.4 2H20a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
      <circle cx="11.5" cy="13.5" r="3.4" />
    </svg>
    {{ mengunggah ? kemajuan : 'Tambah foto' }}

    <!-- capture environment membuka kamera belakang langsung di ponsel, karena foto
         di sini memang harus diambil di lokasinya, bukan diambil dari galeri. -->
    <input
      ref="input" type="file" accept="image/*" capture="environment" multiple
      class="sr-only" :disabled="mengunggah"
      @change="pilihBerkas"
    >
  </label>
</template>
