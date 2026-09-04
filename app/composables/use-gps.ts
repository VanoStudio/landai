export function useGps() {
  const memuat = ref(false)
  const pesanError = ref('')

  async function ambilPosisi(): Promise<{ lat: number, lng: number, akurasi: number } | null> {
    pesanError.value = ''

    if (!import.meta.client || !navigator.geolocation) {
      pesanError.value = 'Perangkat ini tidak mendukung lokasi otomatis.'
      return null
    }

    // Geolocation hanya jalan di HTTPS atau localhost. Kalau dibuka lewat
    // alamat IP lokal, browser memblokirnya tanpa penjelasan yang jelas.
    if (!window.isSecureContext) {
      pesanError.value = 'Lokasi otomatis butuh koneksi aman. Buka lewat alamat https.'
      return null
    }

    memuat.value = true
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      })
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        akurasi: pos.coords.accuracy,
      }
    }
    catch (e: any) {
      pesanError.value = e?.code === 1
        ? 'Izin lokasi ditolak. Aktifkan di pengaturan browser, atau geser pin manual.'
        : 'Gagal membaca lokasi. Geser pin manual saja.'
      return null
    }
    finally {
      memuat.value = false
    }
  }

  return { ambilPosisi, memuat, pesanError }
}
