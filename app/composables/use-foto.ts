// Foto dari kamera HP bisa 4-8 MB. Di jaringan lapangan itu gagal upload atau sangat lama.
const SISI_MAKS = 1600
const MUTU = 0.8

// Batas foto per lokasi, bukan per unggahan. Ditulis di sini, bukan di komponennya, karena
// halaman detail juga perlu tahu kapan berhenti menawarkan tombol tambah.
export const MAKS_FOTO_PER_LOKASI = 6

// Watermark ditanam ke berkasnya, bukan ditumpuk lewat CSS saat ditampilkan.
const WM_TEKS = 'landai'
const WM_HIJAU = '#0F6E56'

// Ukuran tanda mengikuti tinggi gambar, bukan angka tetap, supaya proporsinya sama pada
// foto potret maupun lanskap.
function ukuranTanda(tinggi: number) {
  return Math.round(Math.min(34, Math.max(20, tinggi * 0.042)))
}

// Jalur anak tangga yang melandai, disalin PERSIS dari public/tanda.svg, termasuk kurva
// kuadratik di tiap sudut dalamnya.
export const JALUR_TANDA = 'M5 25 L5 22.6 L7.9 22.6 Q8.3 22.6 8.3 22.2 L8.3 19.6 '
  + 'Q8.3 19.2 8.7 19.2 L11.1 19.2 Q11.6 19.2 11.6 18.7 L11.6 16.4 Q11.6 15.8 12.2 15.8 '
  + 'L14 15.8 Q15.8 15.8 17.2 14.9 L27 8.4 L27 25 Z'

function gambarTanda(ctx: CanvasRenderingContext2D, x: number, y: number, sisi: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(sisi / 32, sisi / 32)

  // Kotak membulat 32x32 dengan jari-jari 8, angka yang sama dengan rx pada SVG-nya.
  ctx.fillStyle = WM_HIJAU
  ctx.beginPath()
  ctx.roundRect(0, 0, 32, 32, 8)
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.fill(new Path2D(JALUR_TANDA))
  ctx.restore()
}

/* Menanam tanda landai di pojok kiri atas kanvas yang sudah berisi gambar. Bentuknya pil
   putih, bukan tulisan putih polos. */
export function tanamTanda(ctx: CanvasRenderingContext2D, lebar: number, tinggi: number) {
  const sisi = ukuranTanda(tinggi)
  const pad = Math.round(sisi * 0.42)
  const jarak = Math.round(sisi * 0.32)
  const tepi = Math.round(sisi * 0.6)

  ctx.save()
  ctx.font = `700 ${sisi * 0.82}px "Public Sans", system-ui, -apple-system, "Segoe UI", sans-serif`
  ctx.textBaseline = 'middle'

  const lebarTeks = ctx.measureText(WM_TEKS).width
  const lebarPil = pad + sisi + jarak + lebarTeks + pad
  const tinggiPil = sisi + pad * 1.1

  // Gambar yang terlalu kecil tidak diberi tanda sama sekali. Menaruh pil yang memakan
  // seperempat bingkai bukan penandaan, melainkan perusakan.
  if (lebarPil > lebar * 0.62) { ctx.restore(); return }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.beginPath()
  ctx.roundRect(tepi, tepi, lebarPil, tinggiPil, tinggiPil / 2)
  ctx.fill()

  gambarTanda(ctx, tepi + pad, tepi + (tinggiPil - sisi) / 2, sisi)

  ctx.fillStyle = WM_HIJAU
  ctx.fillText(WM_TEKS, tepi + pad + sisi + jarak, tepi + tinggiPil / 2 + sisi * 0.03)
  ctx.restore()
}

export async function kecilkanFoto(berkas: File): Promise<Blob> {
  // Menunggu fontnya siap sebelum menggambar.
  await document.fonts?.ready?.catch?.(() => {})

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

  // Ditanam setelah gambar, sebelum dikemas jadi berkas. Kegagalan menanam tanda tidak boleh
  // membatalkan fotonya: bukti kondisi lapangan lebih penting daripada penandaan mereknya.
  try {
    tanamTanda(ctx, lebar, tinggi)
  }
  catch {
    // roundRect belum ada di peramban yang sangat lama. Fotonya tetap dikirim.
  }

  const blob = await new Promise<Blob | null>(res => kanvas.toBlob(res, 'image/jpeg', MUTU))
  return blob ?? berkas
}
