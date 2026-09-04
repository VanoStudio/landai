<script setup lang="ts">
const MAKS_FOTO = 3

const foto = defineModel<{ blob: Blob, pratinjau: string }[]>('foto', { required: true })
const catatan = defineModel<string>('catatan', { required: true })

const memproses = ref(false)
const pesanError = ref('')
const input = ref<HTMLInputElement | null>(null)

async function tambahFoto(e: Event) {
  const berkas = (e.target as HTMLInputElement).files?.[0]
  if (!berkas) return

  // Menyembunyikan tombolnya lewat v-if saja tidak cukup: selama pemrosesan foto
  // ketiga belum selesai, daftar belum bertambah, elemen input masih ada di DOM,
  // dan beberapa berkas beruntun bisa lolos sekaligus. Terbukti tembus ke empat
  // foto saat diuji. Batasnya dijaga di sini, bukan di tampilan.
  if (foto.value.length >= MAKS_FOTO) {
    pesanError.value = `Maksimal ${MAKS_FOTO} foto.`
    if (input.value) input.value.value = ''
    return
  }

  pesanError.value = ''
  memproses.value = true
  try {
    const blob = await kecilkanFoto(berkas)

    // Diperiksa ulang setelah menunggu: beberapa pemrosesan bisa berjalan
    // bersamaan, dan yang datang belakangan harus dibuang, bukan ditumpuk.
    if (foto.value.length >= MAKS_FOTO) {
      pesanError.value = `Maksimal ${MAKS_FOTO} foto.`
      return
    }

    foto.value = [...foto.value, { blob, pratinjau: URL.createObjectURL(blob) }]
  }
  catch {
    pesanError.value = 'Foto gagal diproses. Coba ambil ulang.'
  }
  finally {
    memproses.value = false
    if (input.value) input.value.value = ''
  }
}

function hapusFoto(i: number) {
  URL.revokeObjectURL(foto.value[i]!.pratinjau)
  foto.value = foto.value.filter((_, idx) => idx !== i)
}

onBeforeUnmount(() => foto.value.forEach(f => URL.revokeObjectURL(f.pratinjau)))
</script>

<template>
  <div class="space-y-5">
    <div>
      <p class="text-sm font-medium">Foto kondisi tempat</p>
      <p class="mt-1 text-sm text-gray-600">
        Foto diambil langsung di lokasi supaya datanya bisa dipercaya. Maksimal {{ MAKS_FOTO }} foto.
      </p>

      <ul v-if="foto.length" class="mt-3 grid grid-cols-3 gap-2">
        <li v-for="(f, i) in foto" :key="f.pratinjau" class="relative">
          <img :src="f.pratinjau" alt="" class="aspect-square w-full rounded object-cover">
          <button
            type="button" :aria-label="`Hapus foto ${i + 1}`"
            class="absolute right-1 top-1 rounded-full bg-black/70 p-1.5 text-white"
            @click="hapusFoto(i)"
          >
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor"
              stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </li>
      </ul>

      <label
        v-if="foto.length < MAKS_FOTO"
        class="mt-3 block cursor-pointer rounded border border-dashed border-gray-400 px-4 py-4 text-center text-sm font-medium text-brand"
      >
        <input
          ref="input" type="file" accept="image/*" capture="environment"
          class="sr-only" @change="tambahFoto"
        >
        {{ memproses ? 'Memproses foto' : foto.length ? 'Ambil foto lagi' : 'Ambil foto' }}
      </label>

      <p v-if="pesanError" role="alert" class="mt-2 text-sm text-skor-kurang">{{ pesanError }}</p>
    </div>

    <div>
      <label for="catatan" class="block text-sm font-medium">Catatan tambahan</label>
      <p class="mt-1 text-sm text-gray-600">Opsional. Misalnya ramp ada tapi terlalu curam.</p>
      <textarea
        id="catatan" v-model="catatan" rows="3" maxlength="500"
        class="mt-1.5 w-full rounded border border-gray-400 px-3 py-2.5 text-base"
      />
    </div>
  </div>
</template>
