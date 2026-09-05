<script setup lang="ts">
// Papan kontributor. Murni bacaan: menghitung ulang dari tabel locations dan profiles
// yang sudah bisa dibaca siapa saja. Tidak ada tabel baru, tidak ada perubahan aturan
// keamanan, tidak ada mekanisme klaim maupun penukaran apa pun.
//
// Penghitungan per kontributor dilakukan di sisi klien, bukan lewat kueri agregat,
// karena PostgREST tidak menyediakan GROUP BY tanpa membuat view di basis data, dan
// membuat view berarti mengubah skema. Jumlah barisnya puluhan, jadi menghitungnya
// di peramban tidak menimbulkan beban yang berarti.

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const idPengguna = useIdPengguna()

// Ambang tingkat ditulis sebagai konstanta di sini, bukan disimpan di basis data,
// supaya bisa diubah tanpa migrasi dan supaya jelas ini keputusan tampilan.
const TINGKAT = [
  { nama: 'Baru mulai', minimal: 1, berikutnya: 3 },
  { nama: 'Kontributor aktif', minimal: 3, berikutnya: 6 },
  { nama: 'Kontributor utama', minimal: 6, berikutnya: null },
] as const

interface Kontributor {
  id: string
  nama: string
  jumlah: number
  tingkat: string
  berikutnya: number | null
  kemajuan: number
}

function tingkatDari(jumlah: number) {
  // Dibaca dari yang tertinggi supaya ambang teratas menang.
  return [...TINGKAT].reverse().find(t => jumlah >= t.minimal) ?? TINGKAT[0]
}

// Kemajuan diukur dari nol menuju ambang tingkat berikutnya, bukan dari ambang masuk
// tingkat yang sedang dijalani. Cara kedua membuat kontributor pertama, yang baru
// punya satu lokasi, mendapat bilah kosong yang terlihat seperti kegagalan memuat.
// Yang sudah di tingkat teratas selalu penuh.
function kemajuanDari(jumlah: number, t: (typeof TINGKAT)[number]) {
  if (t.berikutnya === null) return 100
  return Math.min(100, Math.round((jumlah / t.berikutnya) * 100))
}

const { data: kontributor, pending, error } = await useAsyncData<Kontributor[]>(
  'papan-kontributor',
  async () => {
    const { data, error } = await supabase
      .from('locations')
      // Relasi disebut lewat kolom kunci asingnya. Sejak updated_by ada, locations punya
      // dua kunci asing ke profiles dan PostgREST menolak menebak yang mana yang dimaksud.
      .select('created_by, profiles!created_by ( nama )')
      .not('created_by', 'is', null)

    if (error) throw error

    const per = new Map<string, { nama: string, jumlah: number }>()

    for (const baris of (data ?? []) as any[]) {
      const id = baris.created_by as string
      const p = Array.isArray(baris.profiles) ? baris.profiles[0] : baris.profiles
      const sebelumnya = per.get(id)
      per.set(id, {
        nama: p?.nama || sebelumnya?.nama || 'Warga',
        jumlah: (sebelumnya?.jumlah ?? 0) + 1,
      })
    }

    return [...per.entries()]
      .map(([id, v]) => {
        const t = tingkatDari(v.jumlah)
        return {
          id,
          nama: v.nama,
          jumlah: v.jumlah,
          tingkat: t.nama,
          berikutnya: t.berikutnya,
          kemajuan: kemajuanDari(v.jumlah, t),
        }
      })
      .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, 'id'))
  },
  { default: () => [] },
)

useHead({ title: 'Papan kontributor' })
</script>

<template>
  <div class="mx-auto max-w-lg">
    <header class="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
      <div class="flex items-center gap-3">
        <NuxtLink to="/" class="tombol tombol-tersier -ml-2">Kembali ke peta</NuxtLink>
        <MerekLandai class="ml-auto" :ukuran="22" tulisan="text-sm" />
      </div>
    </header>

    <article class="px-4 pb-16 pt-6">
      <h1 class="text-2xl font-bold leading-tight">Papan kontributor</h1>
      <p class="mt-3 text-gray-700">
        Warga yang sudah menambahkan lokasi ke peta ini. Urutannya dari yang terbanyak.
      </p>
      <p class="mt-2 text-sm text-gray-600">
        Ini bentuk pengakuan komunitas, bukan program hadiah. Tidak ada yang bisa diklaim
        atau ditukar dari halaman ini.
      </p>

      <!-- Di sinilah orang paling mungkin menyadari namanya perlu dirapikan, jadi di
           sini pula jalan keluarnya ditawarkan. -->
      <p v-if="user" class="mt-2 text-sm text-gray-600">
        Nama di daftar ini diambil dari profil Anda.
        <NuxtLink to="/akun" class="font-medium text-brand underline">Ubah nama tampilan</NuxtLink>.
      </p>

      <p v-if="pending" class="mt-8 text-sm text-gray-600" role="status">Memuat papan</p>

      <p v-else-if="error" role="alert" class="mt-8 text-sm text-skor-kurang">
        Gagal memuat papan kontributor.
      </p>

      <div
        v-else-if="kontributor.length === 0"
        class="mt-8 rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center"
      >
        <p class="text-sm font-medium text-gray-700">Belum ada kontributor</p>
        <p class="mt-1 text-sm text-gray-600">
          Lokasi pertama yang Anda tambahkan akan muncul di sini.
        </p>
      </div>

      <ol v-else class="mt-8 divide-y divide-gray-200">
        <!-- Baris milik sendiri ditandai. Tanpa ini, papan ini hanya daftar nama orang
             lain, padahal justru di sinilah seseorang memeriksa kemajuannya sendiri. -->
        <li
          v-for="(k, i) in kontributor" :key="k.id"
          class="-mx-3 rounded-lg px-3 py-4"
          :class="k.id === idPengguna ? 'bg-gray-50 ring-1 ring-inset ring-brand/25' : ''"
        >
          <div class="flex items-baseline justify-between gap-3">
            <p class="min-w-0 truncate font-semibold">
              <span class="mr-1.5 text-sm text-gray-500 tabular-nums">{{ i + 1 }}</span>
              {{ k.nama }}
              <span
                v-if="k.id === idPengguna"
                class="ml-1.5 rounded-full bg-brand px-2 py-0.5 align-middle text-[11px] font-medium text-white"
              >Anda</span>
            </p>
            <p class="shrink-0 text-sm text-gray-700 tabular-nums">
              {{ k.jumlah }} lokasi
            </p>
          </div>

          <p class="mt-1 text-sm text-gray-600">{{ k.tingkat }}</p>

          <!-- Bilah kemajuan. Terisi memakai hijau merek yang sudah ada, tidak ada
               warna baru, dan bukan warna skor supaya tidak tertukar artinya. -->
          <div
            class="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"
            role="progressbar"
            :aria-valuenow="k.kemajuan" aria-valuemin="0" aria-valuemax="100"
            :aria-label="k.berikutnya
              ? `Kemajuan menuju ${k.berikutnya} lokasi`
              : 'Sudah di tingkat tertinggi'"
          >
            <div class="h-full rounded-full bg-brand" :style="{ width: `${k.kemajuan}%` }" />
          </div>

          <p class="mt-1.5 text-xs text-gray-600 tabular-nums">
            <template v-if="k.berikutnya">
              {{ k.berikutnya - k.jumlah }} lokasi lagi menuju tingkat berikutnya
            </template>
            <template v-else>Tingkat tertinggi</template>
          </p>
        </li>
      </ol>

      <h2 class="mt-10 text-base font-semibold">Tingkat kontributor</h2>
      <ul class="mt-2 divide-y divide-gray-200 text-sm">
        <li v-for="t in TINGKAT" :key="t.nama" class="flex justify-between gap-4 py-2.5">
          <span class="font-medium">{{ t.nama }}</span>
          <span class="text-gray-600 tabular-nums">
            {{ t.berikutnya ? `${t.minimal} sampai ${t.berikutnya - 1} lokasi` : `${t.minimal} lokasi atau lebih` }}
          </span>
        </li>
      </ul>

      <NuxtLink to="/tentang" class="tombol tombol-sekunder mt-8">
        Tentang landai
      </NuxtLink>
    </article>
  </div>
</template>
