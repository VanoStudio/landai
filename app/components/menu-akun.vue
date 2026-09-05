<script setup lang="ts">
// Menu akun. Satu tombol yang menggantikan dua kendali header sekaligus, yaitu ikon
// akun dan tombol keluar, lalu membuka seluruh urusan akun di dalamnya.
//
// Alasannya bukan kerapian. Sebelum ini, aksi milik akun tersebar sebagai tombol
// terpisah di header, jadi setiap tambahan memakan lebar, dan yang tidak muat di ponsel
// langsung hilang. Akibatnya terukur: di layar 414px, pengguna yang sudah masuk sama
// sekali tidak punya jalan ke halaman akun maupun papan kontributor, kecuali lewat ikon
// tentang lalu menggulir ke tengah halaman. Menu ini membuat penambahan berikutnya
// masuk ke dalam daftar, bukan ke dalam baris header.
//
// Di ponsel penggantian itu justru menghemat ruang: tombol keluar selebar sekitar 72px
// diganti tombol bundar 44px.
//
// Tombolnya memakai huruf awal nama, bukan ikon orang generik, karena selain membuka
// menu ia sekaligus menjawab pertanyaan yang selama ini tidak dijawab di mana pun:
// sedang masuk sebagai siapa.
const user = useSupabaseUser()
const { data: profil } = useProfilSaya()
const keluar = useKeluar()

const terbuka = ref(false)
const pemicu = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)

// Panel dipasang fixed, bukan absolute. Wadah halaman peta memakai overflow-hidden
// supaya halamannya tidak ikut tergulir, dan panel absolute apa pun yang menjulur ke
// bawah header akan terpotong oleh wadah itu.
const posisi = ref({ atas: 0, kanan: 0 })

const nama = computed(() => profil.value?.nama?.trim() || 'Warga')
const surel = computed(() => (user.value as Record<string, any> | null)?.email ?? '')

const inisial = computed(() => {
  const huruf = nama.value.match(/\p{L}/u)
  return (huruf ? huruf[0] : '?').toUpperCase()
})

function hitungPosisi() {
  const el = pemicu.value
  if (!el) return
  const r = el.getBoundingClientRect()
  posisi.value = {
    atas: Math.round(r.bottom + 8),
    kanan: Math.round(window.innerWidth - r.right),
  }
}

function buka() {
  hitungPosisi()
  terbuka.value = true
  nextTick(() => panel.value?.querySelector<HTMLElement>('a, button')?.focus())
}

function tutup(kembalikanFokus = false) {
  if (!terbuka.value) return
  terbuka.value = false
  if (kembalikanFokus) nextTick(() => pemicu.value?.focus())
}

function alih() {
  terbuka.value ? tutup(true) : buka()
}

function klikLuar(e: MouseEvent) {
  const t = e.target as Node
  if (pemicu.value?.contains(t) || panel.value?.contains(t)) return
  tutup()
}

function tombolPapan(e: KeyboardEvent) {
  if (e.key === 'Escape') tutup(true)
}

onMounted(() => {
  document.addEventListener('click', klikLuar)
  document.addEventListener('keydown', tombolPapan)
  window.addEventListener('resize', hitungPosisi)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', klikLuar)
  document.removeEventListener('keydown', tombolPapan)
  window.removeEventListener('resize', hitungPosisi)
})

async function keluarDanTutup() {
  tutup()
  await keluar()
}
</script>

<template>
  <div class="shrink-0">
    <button
      ref="pemicu"
      type="button"
      :aria-expanded="terbuka"
      aria-haspopup="menu"
      :aria-label="`Menu akun, masuk sebagai ${nama}`"
      class="menu-akun-pemicu grid h-11 w-11 place-items-center rounded-full border text-sm font-bold transition-colors"
      :class="terbuka
        ? 'border-brand bg-brand text-white'
        : 'border-gray-300 bg-white text-brand hover:border-gray-500'"
      @click="alih"
    >
      <span aria-hidden="true">{{ inisial }}</span>
    </button>

    <Transition name="menu">
      <div
        v-if="terbuka"
        ref="panel"
        role="menu"
        aria-label="Menu akun"
        class="fixed z-50 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl"
        :style="{ top: `${posisi.atas}px`, right: `${posisi.kanan}px` }"
      >
        <!-- Identitas ditaruh paling atas. Sebelum ada menu ini, tidak ada satu tempat
             pun di aplikasi yang menyebutkan sedang masuk sebagai siapa. -->
        <div class="border-b border-gray-200 px-4 py-3">
          <p class="truncate font-semibold">{{ nama }}</p>
          <p class="mt-0.5 truncate text-xs text-gray-600">{{ surel }}</p>
        </div>

        <NuxtLink
          to="/akun" role="menuitem"
          class="menu-akun-butir flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm"
          @click="tutup()"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0 text-gray-500" fill="none"
            stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
          </svg>
          Ubah nama tampilan
        </NuxtLink>

        <NuxtLink
          to="/papan-kontributor" role="menuitem"
          class="menu-akun-butir flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm"
          @click="tutup()"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0 text-gray-500" fill="none"
            stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <path d="M5 20V11" />
            <path d="M12 20V5" />
            <path d="M19 20v-6" />
          </svg>
          Kontribusi saya
        </NuxtLink>

        <button
          type="button" role="menuitem"
          class="menu-akun-butir flex min-h-11 w-full items-center gap-3 border-t border-gray-200 px-4 py-2.5 text-left text-sm"
          @click="keluarDanTutup"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0 text-gray-500" fill="none"
            stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <path d="M15 17l5-5-5-5" />
            <path d="M20 12H9" />
            <path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
          </svg>
          Keluar
        </button>
      </div>
    </Transition>
  </div>
</template>
