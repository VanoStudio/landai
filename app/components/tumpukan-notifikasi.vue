<script setup lang="ts">
// Wadah notifikasi, dipasang sekali di app.vue sehingga berlaku di semua halaman. Letaknya
// di tepi atas, di tengah.
const { daftar, tutup } = useNotifikasi()
</script>

<template>
  <!-- Wadahnya tembus klik supaya tidak ada satu pun bagian layar yang menjadi mati hanya
       karena sebuah pesan sedang lewat. -->
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-3 pt-3"
    aria-live="polite"
  >
    <TransitionGroup name="notif">
      <div
        v-for="n in daftar" :key="n.id"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border bg-white py-2.5 pl-3 pr-2 shadow-lg"
        :class="n.jenis === 'galat' ? 'border-skor-kurang' : 'border-gray-300'"
        :role="n.jenis === 'galat' ? 'alert' : 'status'"
      >
        <p class="min-w-0 flex-1 text-[13px] leading-snug text-gray-800">{{ n.pesan }}</p>

        <button
          type="button" aria-label="Tutup pesan"
          class="-my-1.5 grid h-11 w-11 shrink-0 place-items-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          @click="tutup(n.id)"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor"
            stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
