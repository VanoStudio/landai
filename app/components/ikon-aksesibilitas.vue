<script setup lang="ts">
// Simbol aksesibilitas standar internasional. Sengaja tidak didesain ulang,
// familiaritas lebih penting daripada keunikan (DESIGN-BRIEF).
// Selalu netral, mewarisi currentColor. Warna hanya untuk skor.
defineProps<{
  jenis: 'kursi_roda' | 'tunanetra' | 'lansia_stroller'
  label?: string
}>()
</script>

<template>
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"
  >
    <!-- Simbol kursi roda internasional -->
    <template v-if="jenis === 'kursi_roda'">
      <circle cx="11" cy="4" r="1.8" fill="currentColor" stroke="none" />
      <path d="M9.5 8v5.5h5" />
      <path d="M14.5 13.5 17 20" />
      <circle cx="11.5" cy="16" r="5" />
    </template>

    <!-- Simbol tunanetra, tongkat putih -->
    <template v-else-if="jenis === 'tunanetra'">
      <circle cx="10" cy="4" r="1.8" fill="currentColor" stroke="none" />
      <path d="M10 7.5v5" />
      <path d="M7.5 9.5h5" />
      <path d="M10 12.5 8.5 20" />
      <path d="M10 12.5 12 20" />
      <path d="M13 8.5 18 21" />
    </template>

    <!-- Tempat duduk dan kursi dorong -->
    <template v-else>
      <path d="M4 20v-6" />
      <path d="M4 14h11" />
      <path d="M15 14V6" />
      <path d="M15 20v-6" />
      <circle cx="8" cy="20.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="M15 6h4" />
    </template>

    <title v-if="label">{{ label }}</title>
  </svg>
</template>
