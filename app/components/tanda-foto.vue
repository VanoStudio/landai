<script setup lang="ts">
// Tanda landai yang ditempelkan di atas foto saat ditampilkan. Foto yang diunggah sejak
// fitur penandaan ada sudah membawa tandanya di dalam
withDefaults(defineProps<{ kecil?: boolean }>(), { kecil: false })
</script>

<template>
  <span
    class="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 shadow-sm"
    aria-hidden="true"
  >
    <TandaLandai :ukuran="kecil ? 14 : 18" />
    <span class="font-bold leading-none text-brand" :class="kecil ? 'text-[11px]' : 'text-sm'">landai</span>
  </span>
</template>
