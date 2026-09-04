<script setup lang="ts">
// Keadaan ketika sebuah lokasi belum punya foto. Sebelumnya berupa kotak abu
// bergaris putus dengan teks kecil, yang mudah disalahartikan sebagai gambar rusak.
// Diganti ikon kamera yang jelas disengaja, plus kalimat yang mengundang, bukan
// kalimat yang sekadar memberitakan ketiadaan.
withDefaults(defineProps<{ ringkas?: boolean }>(), { ringkas: false })
</script>

<template>
  <!-- Bentuk ringkas dipakai di kartu peta: hanya ikon, karena bidangnya 64 piksel
       dan teks apa pun di situ akan lebih kecil daripada batas keterbacaan. -->
  <div
    v-if="ringkas"
    class="grid h-16 w-16 shrink-0 place-items-center rounded border border-gray-200 bg-gray-50"
  >
    <svg
      viewBox="0 0 24 24" class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor"
      stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    >
      <path d="M3 8.5h3.2l1.4-2h7.8l1.4 2H20a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
      <circle cx="11.5" cy="13.5" r="3.4" />
    </svg>
    <span class="sr-only">Belum ada foto</span>
  </div>

  <div
    v-else
    class="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-7 text-center"
  >
    <svg
      viewBox="0 0 24 24" class="h-9 w-9 text-gray-400" fill="none" stroke="currentColor"
      stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    >
      <path d="M3 8.5h3.2l1.4-2h7.8l1.4 2H20a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
      <circle cx="11.5" cy="13.5" r="3.4" />
    </svg>
    <p class="text-sm font-medium text-gray-700">Belum ada foto di sini</p>
    <p class="max-w-xs text-sm text-gray-600">
      Kalau kamu lewat tempat ini, satu foto kondisinya sangat membantu warga lain.
    </p>
  </div>
</template>
