<script setup lang="ts">
// Kode warna dan bentuk penanda tidak menjelaskan dirinya sendiri sampai seseorang
// mengetuk penanda. Legenda ini menutup jarak itu sekali, lalu bisa ditutup dan
// tidak muncul lagi di perangkat yang sama.
const KUNCI = 'landai:legenda-ditutup'

const terlihat = ref(false)

onMounted(() => {
  try {
    terlihat.value = localStorage.getItem(KUNCI) !== '1'
  }
  catch {
    // Mode penyamaran atau penyimpanan situs diblokir. Legenda tetap tampil.
    terlihat.value = true
  }
})

function tutup() {
  terlihat.value = false
  try {
    localStorage.setItem(KUNCI, '1')
  }
  catch {
    // Tidak bisa diingat, tapi menutupnya tetap berlaku untuk sesi ini.
  }
}

const TINGKAT = [
  { warna: '#639922', label: 'Ramah' },
  { warna: '#BA7517', label: 'Sedang' },
  { warna: '#E24B4A', label: 'Kurang' },
]
</script>

<template>
  <div
    v-if="terlihat"
    class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm"
  >
    <ul class="flex items-center gap-3">
      <li v-for="t in TINGKAT" :key="t.label" class="flex items-center gap-1.5">
        <span
          class="h-3.5 w-3.5 shrink-0 rounded-full"
          :style="{ background: t.warna }"
          aria-hidden="true"
        />
        <span class="text-xs text-gray-700">{{ t.label }}</span>
      </li>
      <li class="flex items-center gap-1.5">
        <span
          class="h-3.5 w-3.5 shrink-0 rounded-full bg-white"
          style="box-shadow: inset 0 0 0 2px #6B7280"
          aria-hidden="true"
        />
        <span class="text-xs text-gray-700">Belum dikonfirmasi</span>
      </li>
    </ul>

    <button
      type="button" aria-label="Tutup legenda"
      class="-mr-1 ml-auto shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      @click="tutup"
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>
</template>
