<script setup lang="ts">
// Lapisan pembuka yang sangat singkat, bukan pengganti rangka pemuatan. Rangka peta sudah
// dirender server, jadi ia hadir di HTML pertama.
defineProps<{ selesai?: boolean }>()

const TANGGA = 'M5 25 L5 22.6 L7.9 22.6 Q8.3 22.6 8.3 22.2 L8.3 19.6 Q8.3 19.2 8.7 19.2 '
  + 'L11.1 19.2 Q11.6 19.2 11.6 18.7 L11.6 16.4 Q11.6 15.8 12.2 15.8 L14 15.8 '
  + 'Q15.8 15.8 17.2 14.9 L27 8.4 L27 25 Z'
</script>

<template>
  <!-- Disembunyikan dari pembaca layar. Kabar "sedang memuat" sudah dibawa teks khusus pembaca
       layar di halaman peta, dan menyuarakannya dua kali justru mengganggu. -->
  <div class="layar-pembuka" :class="{ 'pembuka-selesai': selesai }" aria-hidden="true">
    <div class="flex items-center gap-3">
      <svg viewBox="0 0 32 32" class="h-14 w-14 shrink-0" focusable="false">
        <path class="pembuka-glif" :d="TANGGA" fill="#fff" />
      </svg>
      <p class="text-4xl font-bold leading-none text-white">landai</p>
    </div>
  </div>
</template>
