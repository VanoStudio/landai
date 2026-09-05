import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-03',
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      link: [
        // Favicon SVG untuk peramban modern, PNG untuk yang belum menerimanya.
        { rel: 'icon', type: 'image/svg+xml', href: '/tanda.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap',
        },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0F6E56' },
      ],
    },
  },

  modules: ['@nuxtjs/supabase'],
  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  // Peta dan halaman detail wajib bisa dibuka tanpa akun (PRD bagian 7, mode lihat).
  // Default module ini melempar SEMUA halaman ke /login, jadi kita pakai `include`
  // supaya hanya rute kontribusi yang dijaga.
  supabase: {
    redirectOptions: {
      login: '/masuk',
      callback: '/konfirmasi',
      include: ['/tambah-lokasi', '/akun'],
      exclude: [],
    },
  },

  runtimeConfig: {
    public: {
      // diisi dari NUXT_PUBLIC_MAPTILER_KEY di .env
      maptilerKey: '',
      // Alamat mutlak dibutuhkan tag pratinjau tautan: WhatsApp dan Telegram
      // menolak alamat gambar yang relatif.
      situsUrl: 'https://landai-zeta.vercel.app',
    },
  },
})
