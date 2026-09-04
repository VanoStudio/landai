// Proxy ke Nominatim. Dari browser header User-Agent tidak bisa diatur, padahal
// kebijakan pemakaian Nominatim mewajibkan identifikasi aplikasi. Lewat server
// route ini header bisa dipasang, sekalian lolos CORS.
// Pencarian hanya dipicu saat user menekan cari, bukan tiap ketikan, supaya
// batas satu permintaan per detik tidak dilanggar.

interface HasilNominatim {
  display_name: string
  lat: string
  lon: string
  name?: string
  addresstype?: string
}

export default defineEventHandler(async (event) => {
  const { q } = getQuery(event)
  const kueri = String(q ?? '').trim()

  if (kueri.length < 3) return { hasil: [] }

  try {
    const data = await $fetch<HasilNominatim[]>('https://nominatim.openstreetmap.org/search', {
      query: {
        q: kueri,
        format: 'jsonv2',
        limit: 6,
        countrycodes: 'id',
        addressdetails: 0,
      },
      headers: {
        'User-Agent': 'landai/1.0 (peta aksesibilitas difabel; ITechno Cup 2026)',
        'Accept-Language': 'id',
      },
      timeout: 8000,
    })

    return {
      hasil: (data ?? []).map(h => ({
        nama: h.name || h.display_name.split(',')[0]!.trim(),
        alamat: h.display_name,
        lat: Number(h.lat),
        lng: Number(h.lon),
      })),
    }
  }
  catch {
    throw createError({ statusCode: 502, statusMessage: 'Pencarian tempat sedang tidak bisa dipakai' })
  }
})
