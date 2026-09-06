<script setup lang="ts">
const nama = defineModel<string>('nama', { required: true })
const kategori = defineModel<string>('kategori', { required: true })
</script>

<template>
  <div class="space-y-5">
    <div>
      <label for="nama-tempat" class="block text-sm font-medium">Nama tempat</label>
      <input
        id="nama-tempat" v-model="nama" type="text" required maxlength="120"
        placeholder="Stasiun MRT Blok M"
        class="mt-1.5 w-full rounded border border-gray-400 px-3 py-2.5 text-base"
      >
    </div>

    <fieldset>
      <legend class="text-sm font-medium">Jenis tempat</legend>

      <!-- Satu kolom, bukan dua. Sejak jenisnya digeneralkan, tiap pilihan membawa
           contoh di bawahnya, dan contoh itulah yang menyudahi keraguan: tanpa
           "halte, stasiun, terminal", orang membaca "Transportasi umum" sebagai
           kereta saja lalu memilih "Lainnya", persis yang terjadi pada empat halte
           di survei pertama. Dua kolom memaksa contohnya terpotong. -->
      <div class="mt-2 grid gap-2">
        <label
          v-for="k in KATEGORI_PILIHAN" :key="k"
          class="flex min-h-11 cursor-pointer flex-col justify-center rounded border px-3 py-2"
          :class="kategori === k
            ? 'border-brand bg-brand text-white'
            : 'border-gray-300 hover:border-gray-500'"
        >
          <input v-model="kategori" type="radio" :value="k" class="sr-only">
          <span class="text-sm font-medium">{{ LABEL_KATEGORI[k] }}</span>
          <span
            class="mt-0.5 text-xs"
            :class="kategori === k ? 'text-white/80' : 'text-gray-600'"
          >{{ CONTOH_KATEGORI[k] }}</span>
        </label>
      </div>
    </fieldset>
  </div>
</template>
