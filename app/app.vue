<script setup lang="ts">
// Tag pratinjau tautan tinggal di sini, bukan di nuxt.config, karena alamat
// gambarnya harus mutlak dan diambil dari runtime config.
//
// Gambarnya PNG, bukan SVG, karena WhatsApp dan Telegram tidak merender SVG pada
// og:image dan akan menampilkan tautan tanpa gambar sama sekali. Berkasnya dirender
// lokal dari tanda SVG yang sama, jadi tidak ada aset yang digambar dua kali.
const { situsUrl } = useRuntimeConfig().public as { situsUrl: string }

const JUDUL = 'landai — peta aksesibilitas tempat umum'
const RINGKAS = 'Cari tahu apakah sebuah tempat bisa kamu akses sebelum berangkat. '
  + 'Skor aksesibilitas dari delapan fasilitas, diisi dan diverifikasi warga.'

useSeoMeta({
  description: RINGKAS,
  ogSiteName: 'landai',
  ogType: 'website',
  ogTitle: JUDUL,
  ogDescription: RINGKAS,
  ogUrl: situsUrl,
  ogLocale: 'id_ID',
  ogImage: `${situsUrl}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'landai, peta aksesibilitas tempat umum yang diisi warga',
  twitterCard: 'summary_large_image',
  twitterTitle: JUDUL,
  twitterDescription: RINGKAS,
  twitterImage: `${situsUrl}/og.png`,
})
</script>

<template>
  <NuxtPage />
</template>
