<script setup lang="ts">
// Peringatan isi kasar pada formulir kontribusi.
//
// Bentuknya sengaja sama persis dengan peringatan kemungkinan duplikat yang sudah
// ada di formulir yang sama: garis amber, latar putih, dua aksi. Keduanya jenis
// pesan yang sama, yaitu "ini mungkin keliru, tapi Anda yang lebih tahu", jadi
// keduanya harus terlihat sebagai benda yang sama.
//
// Amber, bukan merah. Merah di aplikasi ini dipakai untuk kegagalan yang benar
// benar menghentikan, misalnya simpanan yang ditolak basis data. Ini bukan itu:
// pengguna tetap boleh mengirim, dan warnanya harus mengatakan demikian.
//
// Kata yang terpicu disebutkan supaya bisa ditindaklanjuti, tetapi disensor bagian
// tengahnya. Menuliskannya ulang secara utuh tidak menambah kejelasan apa pun dan
// justru menaruh kata itu di layar untuk kedua kalinya.
const props = defineProps<{
  matchedWords: string[]
  kolom: ('nama' | 'catatan')[]
}>()

const emit = defineEmits<{
  edit: []
  lanjut: []
}>()

const daftar = computed(() => props.matchedWords.map(sensorKata).join(', '))

// Kedua kolom disebut kalau keduanya bermasalah. Menyebut salah satu saja membuat
// orang memperbaiki satu lalu tertahan lagi oleh yang lain tanpa tahu sebabnya.
const namaKolom = computed(() => {
  const nama = props.kolom.map(k => (k === 'nama' ? 'nama tempat' : 'catatan tambahan'))
  return nama.length > 1 ? nama.join(' dan ') : (nama[0] ?? 'isian')
})
</script>

<template>
  <section
    role="status"
    class="mt-4 rounded-lg border border-skor-sedang bg-white px-4 py-3"
  >
    <h2 class="text-sm font-semibold">Ada kata yang mungkin kasar</h2>
    <p class="mt-1 text-sm text-gray-700">
      Pada {{ namaKolom }} terbaca
      <span class="font-medium tabular-nums">{{ daftar }}</span>.
      Isi ini akan terbaca warga lain yang membuka peta, termasuk yang memakainya
      untuk mencari tempat yang bisa mereka akses. Kalau memang bagian dari nama
      tempat yang sebenarnya, kirim saja.
    </p>

    <div class="mt-3 flex flex-wrap gap-2">
      <button type="button" class="tombol tombol-sekunder" @click="emit('edit')">
        Perbaiki dulu
      </button>
      <button type="button" class="tombol tombol-tersier" @click="emit('lanjut')">
        Tetap kirim
      </button>
    </div>
  </section>
</template>
