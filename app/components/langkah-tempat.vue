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
      <div class="mt-2 grid grid-cols-2 gap-2">
        <label
          v-for="k in KATEGORI_PILIHAN" :key="k"
          class="flex min-h-11 cursor-pointer items-center rounded border px-3 py-2 text-sm"
          :class="kategori === k
            ? 'border-brand bg-brand text-white font-medium'
            : 'border-gray-300 hover:border-gray-500'"
        >
          <input v-model="kategori" type="radio" :value="k" class="sr-only">
          {{ LABEL_KATEGORI[k] }}
        </label>
      </div>
    </fieldset>
  </div>
</template>
