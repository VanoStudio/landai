<script setup lang="ts">
// Tag pratinjau tautan tinggal di sini, bukan di nuxt.config, karena alamat gambarnya
// harus mutlak dan diambil dari runtime config.
const { situsUrl } = useRuntimeConfig().public as { situsUrl: string }

// Satu sumber kebenaran untuk judul.
const JUDUL = 'Landai: Peta Aksesibilitas Kota yang Ramah Difabel'
const RINGKAS = 'Cari tahu apakah sebuah tempat bisa Anda akses sebelum berangkat. '
  + 'Skor aksesibilitas dari delapan fasilitas, diisi dan diverifikasi warga.'

// Halaman dalam cukup menyebut namanya sendiri, misalnya `title: 'Akun'`, dan akhiran
// mereknya ditambahkan di sini, dipisah garis tegak: "Akun | Landai". Peta adalah satu-
// satunya pengecualian.
useHead({
  title: JUDUL,
  titleTemplate: (judulHalaman?: string) =>
    judulHalaman && judulHalaman !== JUDUL ? `${judulHalaman} | Landai` : JUDUL,
})

useSeoMeta({
  description: RINGKAS,
  ogSiteName: 'Landai',
  ogType: 'website',
  ogTitle: JUDUL,
  ogDescription: RINGKAS,
  ogUrl: situsUrl,
  ogLocale: 'id_ID',
  ogImage: `${situsUrl}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: JUDUL,
  twitterCard: 'summary_large_image',
  twitterTitle: JUDUL,
  twitterDescription: RINGKAS,
  twitterImage: `${situsUrl}/og.png`,
})
</script>

<template>
  <NuxtPage />

  <!-- Satu wadah notifikasi untuk seluruh aplikasi, bukan kotak pesan yang ditulis ulang per
       halaman. -->
  <TumpukanNotifikasi />
</template>
