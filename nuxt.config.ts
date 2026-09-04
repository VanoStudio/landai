import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-03',
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      link: [
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
      include: ['/tambah-lokasi'],
      exclude: [],
    },
  },

  runtimeConfig: {
    public: {
      // diisi dari NUXT_PUBLIC_MAPTILER_KEY di .env
      maptilerKey: '',
    },
  },
})
