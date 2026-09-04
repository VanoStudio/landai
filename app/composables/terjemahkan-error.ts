// Pesan error Supabase datang dalam bahasa Inggris teknis. DESIGN-BRIEF minta
// bahasa Indonesia sederhana tanpa istilah teknis di UI pengguna umum.
const PETA_PESAN: Record<string, string> = {
  'Invalid login credentials': 'Email atau kata sandi salah.',
  'Email not confirmed': 'Akun belum diaktifkan. Buka tautan konfirmasi di emailmu.',
  'User already registered': 'Email ini sudah terdaftar. Coba masuk saja.',
  'Password should be at least 6 characters': 'Kata sandi minimal 6 karakter.',
  'Unable to validate email address: invalid format': 'Format email tidak benar.',
  'Email rate limit exceeded': 'Terlalu banyak percobaan. Tunggu beberapa menit.',
  'For security purposes, you can only request this after 60 seconds': 'Tunggu satu menit sebelum mencoba lagi.',

  // Kesalahan pengaturan project, bukan kesalahan pengguna. Kalimatnya menyebut
  // tempat memperbaikinya, karena yang membaca ini biasanya pemilik projectnya.
  'Email logins are disabled': 'Masuk lewat email sedang dimatikan di pengaturan Supabase. Aktifkan provider Email di Authentication, Sign In / Providers.',
  'Email signups are disabled': 'Pendaftaran lewat email sedang dimatikan di pengaturan Supabase. Aktifkan provider Email di Authentication, Sign In / Providers.',
  'Signups not allowed for this instance': 'Pendaftaran akun baru sedang ditutup di pengaturan Supabase.',
  'Database error saving new user': 'Akun gagal dibuat di database. Cek trigger handle_new_user di Supabase.',
}

export function terjemahkanError(pesan: string): string {
  for (const [inggris, indonesia] of Object.entries(PETA_PESAN)) {
    if (pesan.includes(inggris)) return indonesia
  }

  // Error yang tak dikenal jangan ditelan jadi kalimat kosong. Pesan aslinya selalu
  // masuk console, dan saat dev ikut ditampilkan, supaya pengembang tidak menebak-nebak
  // seperti yang terjadi waktu provider Email dimatikan diam-diam.
  console.error('[auth] error yang belum diterjemahkan:', pesan)

  return import.meta.dev
    ? `Terjadi kendala. Pesan asli: ${pesan}`
    : 'Terjadi kendala. Coba lagi sebentar lagi.'
}
