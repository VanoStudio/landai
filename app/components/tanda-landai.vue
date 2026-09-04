<script setup lang="ts">
// Tanda merek landai. Bentuknya ramp: bidang dasar mendatar, lalu bidang yang naik
// landai dari kiri bawah ke kanan atas dengan lengkung lembut, bukan garis lurus
// tajam, karena landai justru berarti kemiringan yang ramah dilalui.
//
// Digambar sebagai SVG murni supaya tajam di ukuran apa pun, dari 16 piksel favicon
// sampai 1200 piksel gambar pratinjau. Bentuknya sengaja sederhana dan pejal agar
// tetap terbaca saat dikecilkan, mengikuti vernakular rambu di DESIGN-BRIEF.
withDefaults(defineProps<{ ukuran?: number }>(), { ukuran: 28 })
</script>

<template>
  <svg
    :width="ukuran" :height="ukuran" viewBox="0 0 32 32"
    class="shrink-0" role="img" aria-label="landai"
  >
    <rect width="32" height="32" rx="8" fill="var(--color-brand)" />
    <!-- Bidang dasar, tempat ramp bertumpu -->
    <rect x="6" y="21.5" width="20" height="3.5" rx="1.75" fill="#fff" opacity="0.45" />
    <!-- Bidang naik, lengkungnya lembut supaya terbaca sebagai landai bukan tanjakan -->
    <path d="M6 21 Q17.5 20 26 9.5 L26 21 Z" fill="#fff" />
  </svg>
</template>
