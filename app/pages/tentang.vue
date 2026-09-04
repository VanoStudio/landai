<script setup lang="ts">
useHead({ title: 'Tentang landai' })
</script>

<template>
  <div class="mx-auto max-w-lg">
    <header class="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
      <NuxtLink to="/" class="text-sm font-medium text-gray-700 hover:text-gray-900">
        Kembali ke peta
      </NuxtLink>
    </header>

    <article class="px-4 pb-16 pt-6">
      <h1 class="text-2xl font-bold leading-tight">Tentang landai</h1>
      <p class="mt-3 text-gray-700">
        landai adalah peta aksesibilitas tempat umum yang diisi oleh warga. Tujuannya satu:
        memberi tahu orang apakah sebuah tempat bisa mereka akses, sebelum mereka pergi ke sana.
      </p>

      <h2 class="mt-8 text-base font-semibold">Masalah yang dijawab</h2>
      <p class="mt-2 text-gray-700">
        Belum ada sumber informasi terpercaya soal kondisi aksesibilitas tempat umum di Indonesia.
        Penyandang disabilitas, lansia, dan orang tua dengan stroller sering baru tahu sebuah tempat
        tidak ramah akses setelah tiba di sana, saat pulang bukan lagi pilihan yang murah.
      </p>
      <p class="mt-3 text-gray-700">
        Aplikasi peta yang sudah ada menyimpan lokasi dan jam buka. Keduanya tidak menyimpan apakah
        rampnya ada, apakah guiding block-nya tersambung, apakah liftnya benar-benar menyala.
      </p>

      <h2 class="mt-8 text-base font-semibold">Kaitan dengan SDG 11</h2>
      <p class="mt-2 text-gray-700">
        Tujuan Pembangunan Berkelanjutan nomor 11 menuntut kota yang inklusif, aman, tangguh, dan
        berkelanjutan. Target 11.7 secara khusus meminta akses universal ke ruang publik yang aman
        dan mudah dijangkau, terutama bagi penyandang disabilitas dan lansia.
      </p>
      <p class="mt-3 text-gray-700">
        Sebuah kota tidak bisa memperbaiki apa yang tidak diukurnya. landai mengubah kondisi
        aksesibilitas dari cerita mulut ke mulut menjadi data per lokasi yang bisa dilihat siapa saja:
        delapan fasilitas, satu skor, satu peta. Warga memakainya untuk merencanakan perjalanan, dan
        data yang sama menunjukkan tempat mana yang paling perlu dibenahi lebih dulu.
      </p>

      <h2 class="mt-8 text-base font-semibold">Cara datanya dikumpulkan</h2>
      <ol class="mt-2 space-y-2 text-gray-700">
        <li>
          <span class="font-medium">Warga menandai lokasi.</span>
          Titik diambil dari GPS perangkat di tempat, lalu bisa dikoreksi manual dengan menggeser pin.
        </li>
        <li>
          <span class="font-medium">Mengisi checklist delapan fasilitas.</span>
          Ramp, lebar pintu, toilet difabel, parkir difabel, lift, guiding block, tempat duduk, dan
          kerataan permukaan jalan.
        </li>
        <li>
          <span class="font-medium">Memotret kondisinya.</span>
          Foto diambil langsung lewat kamera perangkat, bukan dipilih dari galeri.
        </li>
      </ol>

      <h2 class="mt-8 text-base font-semibold">Cara skornya dihitung</h2>
      <p class="mt-2 text-gray-700">
        Skor adalah jumlah fasilitas yang tersedia dibagi delapan, dikali seratus. Angkanya dihitung
        langsung di database setiap checklist berubah, bukan dikirim dari browser, jadi tidak bisa
        diubah lewat formulir. Hijau berarti lima fasilitas ke atas terpenuhi, amber tiga sampai
        empat, merah dua atau kurang.
      </p>

      <h2 class="mt-8 text-base font-semibold">Cara datanya dijaga</h2>
      <p class="mt-2 text-gray-700">
        Setiap lokasi mencatat siapa kontributornya dan kapan. Warga lain yang pernah ke tempat yang
        sama bisa menyatakan datanya masih akurat atau sudah berubah. Lokasi baru tampil dengan
        penanda berongga sampai tiga warga mengonfirmasi, lalu penandanya menjadi terisi penuh.
      </p>
      <p class="mt-3 text-gray-700">
        Data yang belum dikonfirmasi tetap ditampilkan, bukan disembunyikan. Menyembunyikannya
        membuat peta kosong, menyamarkannya membuat peta berbohong.
      </p>

      <h2 class="mt-8 text-base font-semibold">Tim</h2>
      <p class="mt-2 text-gray-700">
        Vano mengerjakan pengembangan, Husein melakukan survei lapangan, Dakara meneliti kriteria
        aksesibilitas dan dampaknya.
      </p>
      <p class="mt-3 text-gray-700">
        Survei pertama mengambil koridor Blok M: Stasiun MRT Blok M, Blok M Plaza, dan Kantor
        Kecamatan Kebayoran Baru. Ketiganya sejarak jalan kaki, dan sengaja mencampur tempat yang
        biasanya sudah ramah akses dengan yang sering luput dari perhatian.
      </p>

      <p class="mt-8 border-t border-gray-200 pt-4 text-sm text-gray-600">
        Dibuat untuk ITechno Cup 2026, kategori Web Development, subtema Smart Sustainable Digital
        Solution for Inclusive Society.
      </p>

      <NuxtLink
        to="/"
        class="mt-6 inline-flex min-h-11 items-center rounded bg-brand px-4 font-medium text-white hover:bg-brand-gelap"
      >
        Buka peta
      </NuxtLink>
    </article>
  </div>
</template>
