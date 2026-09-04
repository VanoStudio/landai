<script setup lang="ts">
// Tanda merek landai. Filosofinya tercatat penuh di DESIGN.md bagian Tanda merek.
// Ringkasnya: tiga anak tangga kecil di sisi kiri melebur menjadi satu garis diagonal
// halus di sisi kanan. Tangga adalah hambatan, landai adalah akses, dan peralihan dari
// satu ke yang lain adalah misi aplikasi ini.
//
// Digambar sebagai SVG murni, satu jalur terisi, bukan garis bergaris tepi: bidang
// pejal tetap terbaca ketika dikecilkan, sedangkan garis setipis anak tangganya akan
// saling melebur jadi bubur di ukuran favicon.
//
// Selalu bersifat dekoratif bagi pembaca layar. Nama merek dibawa oleh tulisan di
// sebelahnya, dan tanda ini tidak pernah tampil tanpa tulisan itu (lihat MerekLandai).
withDefaults(defineProps<{ ukuran?: number }>(), { ukuran: 28 })
</script>

<template>
  <svg
    :width="ukuran" :height="ukuran" viewBox="0 0 32 32"
    class="shrink-0" data-tanda-landai aria-hidden="true" focusable="false"
  >
    <rect width="32" height="32" rx="8" fill="var(--color-brand)" />
    <!-- Sudut anak tangga membulat makin ke kanan: 0.4, lalu 0.5, lalu 0.6, lalu
         lengkung besar yang menyatukannya dengan garis lurus ke sudut kanan atas.
         Peleburannya bertahap, bukan patah di satu titik. -->
    <path
      d="M5 25 L5 22.6 L7.9 22.6 Q8.3 22.6 8.3 22.2 L8.3 19.6 Q8.3 19.2 8.7 19.2
         L11.1 19.2 Q11.6 19.2 11.6 18.7 L11.6 16.4 Q11.6 15.8 12.2 15.8 L14 15.8
         Q15.8 15.8 17.2 14.9 L27 8.4 L27 25 Z"
      fill="#fff"
    />
  </svg>
</template>
