<script setup lang="ts">
// Sapaan untuk pengunjung pertama. Sengaja bukan jendela modal dan bukan tur
// bertahap: keduanya menahan orang di depan pintu, padahal peta di belakangnya
// justru barang yang mereka datangi. Kartu ini menempel di sudut, petanya tetap
// bisa digeser dan diketuk, dan satu ketukan menutupnya untuk selamanya.
//
// Ambangnya penyimpanan lokal peramban, bukan status akun. Orang yang sudah paham
// aturan mainnya tidak perlu diberi tahu lagi hanya karena belum mendaftar, dan
// perangkat baru memang pantas diberi tahu sekali lagi.
const KUNCI = 'landai:pengenalan-ditutup'

const terlihat = ref(false)

onMounted(() => {
  try {
    terlihat.value = localStorage.getItem(KUNCI) !== '1'
  }
  catch {
    // Mode penyamaran atau penyimpanan situs diblokir. Tanpa catatan, kunjungan
    // ini tidak bisa dibedakan dari kunjungan pertama, jadi kartunya tetap tampil.
    terlihat.value = true
  }
})

function tutup() {
  terlihat.value = false
  try {
    localStorage.setItem(KUNCI, '1')
  }
  catch {
    // Tidak bisa diingat lintas kunjungan, tapi menutupnya tetap berlaku sekarang.
  }
}
</script>

<template>
  <section
    v-if="terlihat"
    aria-labelledby="judul-pengenalan"
    class="relative rounded-lg border border-gray-200 bg-white px-4 py-3 pr-12 shadow-lg"
  >
    <h2 id="judul-pengenalan" class="text-sm font-semibold">Baru pertama ke sini?</h2>
    <p class="mt-1 text-[13px] leading-relaxed text-gray-700">
      Melihat peta dan membuka detail lokasi tidak perlu akun.
      Kamu baru perlu masuk untuk menambah lokasi atau mengonfirmasi data warga lain.
    </p>

    <button
      type="button" aria-label="Tutup pengenalan"
      class="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      @click="tutup"
    >
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </section>
</template>
