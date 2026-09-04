# SETUP: landai

Panduan menyiapkan repo dari nol sampai bisa jalan di lokal dan ter-deploy.

## 1. Prasyarat

- Node.js versi 20 atau lebih baru
- npm atau pnpm
- Git
- Akun GitHub
- Akun Supabase, gratis di supabase.com
- Akun Vercel, gratis di vercel.com, sudah terhubung ke GitHub

## 2. Buat repo GitHub

Nama repo yang disarankan: `landai`.

```
gh repo create landai --public --clone
cd landai
```

Kalau tidak pakai GitHub CLI, buat repo baru manual di GitHub dengan nama yang sama, lalu clone ke lokal.

## 3. Scaffold project Nuxt

```
npx nuxi@latest init . --package-manager npm
```

Pasang dependency utama:
```
npm install @nuxtjs/supabase maplibre-gl
npm install -D @nuxtjs/tailwindcss
```

Tambahkan `@nuxtjs/supabase` dan `@nuxtjs/tailwindcss` ke array `modules` di `nuxt.config.ts`.

## 4. Setup Supabase

1. Buat project baru di dashboard Supabase.
2. Buka SQL editor, jalankan seluruh isi `schema.sql` yang ada di repo ini, ini membuat tabel `profiles`, `locations`, `accessibility_checklist`, `location_photos`, `confirmations`, sekaligus trigger otomatis dan Row Level Security dasar.
3. Aktifkan Row Level Security di setiap tabel, minimal aturan: siapa saja boleh membaca (`select`), hanya user login boleh menulis (`insert`), user hanya boleh mengubah data miliknya sendiri (`update`, `delete`).
4. Buat bucket Storage baru bernama `location-photos`, set public read.
5. Salin `Project URL` dan `anon public key` dari Settings API.
UNTUK YANG SUPABASE SUDAH ADA YA, BISA DI CEK AJA.

## 5. Environment variable

Buat file `.env` di root, jangan pernah di-commit (`.env` sudah otomatis ada di `.gitignore` bawaan Nuxt):

```
SUPABASE_URL=isi_dari_dashboard
SUPABASE_KEY=isi_anon_key_dari_dashboard
```

## 6. Jalankan dev server

```
npm run dev
```
Buka `http://localhost:3000`.

## 7. Setup desain dengan Impeccable

```
npx impeccable install
```
Reload sesi Claude Code, lalu jalankan `/impeccable init` di dalam Claude Code. Isi jawabannya mengikuti `DESIGN-BRIEF.md`, jangan menjawab dari nol.

## 8. Setup Graphify, opsional

```
uv tool install graphifyy
graphify install
```
Ini membantu Claude Code menavigasi codebase seiring project bertambah besar, tidak wajib untuk MVP.

## 9. Deploy ke Vercel

1. Import repo `landai` di dashboard Vercel, Nuxt terdeteksi otomatis.
2. Tambahkan environment variable yang sama seperti `.env` di pengaturan project Vercel.
3. Deploy, dapat URL `.vercel.app`.

## 10. Checklist sebelum submission lomba

- README di root repo mengikuti template resmi ITechno Cup 2026.
- Link hosting yang aktif dicantumkan di README.
- Pastikan environment variable di Vercel sudah benar, coba buka link hosting dari device lain untuk memastikan tidak ada yang bergantung ke `localhost`.
- Data awal koridor Blok M dari Husein sudah masuk semua ke database sebelum deadline.

## 11. Pembagian akses repo

Hanya Vano yang menulis kode. Husein mengisi data lewat form yang sudah live di link hosting, tidak perlu akses ke repo. Dakara berkontribusi lewat dokumen terpisah (rubrik kriteria, riset dampak, draft README bagian tentang), hasilnya diteruskan ke Vano untuk dimasukkan ke halaman tentang dan README.