// Foto dari kamera HP bisa 4-8 MB. Di jaringan lapangan itu gagal upload atau
// sangat lama. Dikecilkan dulu di browser sebelum dikirim ke Storage.
const SISI_MAKS = 1600
const MUTU = 0.8

export async function kecilkanFoto(berkas: File): Promise<Blob> {
  const bitmap = await createImageBitmap(berkas)

  const skala = Math.min(1, SISI_MAKS / Math.max(bitmap.width, bitmap.height))
  const lebar = Math.round(bitmap.width * skala)
  const tinggi = Math.round(bitmap.height * skala)

  const kanvas = document.createElement('canvas')
  kanvas.width = lebar
  kanvas.height = tinggi

  const ctx = kanvas.getContext('2d')
  if (!ctx) return berkas

  ctx.drawImage(bitmap, 0, 0, lebar, tinggi)
  bitmap.close()

  const blob = await new Promise<Blob | null>(res => kanvas.toBlob(res, 'image/jpeg', MUTU))
  return blob ?? berkas
}
