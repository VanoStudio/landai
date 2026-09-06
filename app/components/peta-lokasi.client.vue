<script setup lang="ts">
// maplibre-gl v6 tidak punya default export lagi, hanya named export.
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const props = defineProps<{
  lokasi: LokasiPeta[]
  terpilih?: string | null
}>()

const emit = defineEmits<{
  pilih: [LokasiPeta | null]
  siap: []
}>()

const config = useRuntimeConfig()
const wadah = ref<HTMLDivElement | null>(null)

// Rangka pemuatan tinggal di halaman, bukan di sini, karena komponen ini khusus sisi klien
// dan tidak ikut dirender server.
let sudahLapor = false
function laporSiap() {
  if (sudahLapor) return
  sudahLapor = true
  emit('siap')
}
let peta: maplibregl.Map | null = null

// Berkunci, bukan senarai: kuncinya menyandikan keanggotaan kelompok, jadi penanda yang
// tidak berubah dipakai ulang alih-alih dibuat ulang tiap pandangan berhenti.
let penanda = new Map<string, maplibregl.Marker>()
let penandaSaya: maplibregl.Marker | null = null

// Titik tengah koridor yang disurvei, Pejaten sampai Warung Jati. Peta dibuka di sini
// supaya lokasi yang sudah terisi langsung terlihat, termasuk di layar ponsel.
const PUSAT: [number, number] = [106.8294, -6.2705]

// Cadangan kalau kunci MapTiler tidak ada atau gagal, supaya peta tetap muncul.
const GAYA_OSM: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

// Angka dan lingkarannya WAJIB di elemen anak.
function buatElemenPenanda(l: LokasiPeta): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'penanda-skor'
  el.style.setProperty('--warna-skor', warnaSkor(l.skor))
  el.dataset.status = l.status
  el.dataset.id = l.id
  el.setAttribute('aria-label', `${l.nama}, skor ${l.skor} dari 100, ${labelSkor(l.skor)}`)

  const bulat = document.createElement('span')
  bulat.className = 'penanda-bulat'
  bulat.textContent = String(l.skor)
  el.appendChild(bulat)

  el.addEventListener('click', (e) => {
    e.stopPropagation()
    emit('pilih', l)
  })
  return el
}

// Sedikit lebih besar dari diameter penanda, supaya keduanya tidak saling menyentuh.
const RADIUS_KLUSTER = 48

interface Kelompok {
  anggota: LokasiPeta[]
  x: number
  y: number
}

// Dihitung dari jarak di layar, bukan jarak sebenarnya, jadi kelompok membubar sendiri
// saat peta diperbesar tanpa perlu aturan zoom terpisah.
function kelompokkan(): Kelompok[] {
  if (!peta) return props.lokasi.map(l => ({ anggota: [l], x: 0, y: 0 }))

  const grup: Kelompok[] = []
  const terpilih: Kelompok[] = []

  for (const l of props.lokasi) {
    const t = peta.project([l.lng, l.lat])

    // Penanda terpilih tidak boleh tersembunyi di dalam kelompok.
    if (l.id === props.terpilih) {
      terpilih.push({ anggota: [l], x: t.x, y: t.y })
      continue
    }

    const dekat = grup.find(g => Math.hypot(g.x - t.x, g.y - t.y) < RADIUS_KLUSTER)
    if (dekat) dekat.anggota.push(l)
    else grup.push({ anggota: [l], x: t.x, y: t.y })
  }

  return [...grup, ...terpilih]
}

function buatElemenKluster(anggota: LokasiPeta[]): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'penanda-kluster'
  el.setAttribute('aria-label', `${anggota.length} lokasi berdekatan, perbesar untuk memisahkan`)

  const bulat = document.createElement('span')
  bulat.className = 'penanda-bulat'
  bulat.textContent = String(anggota.length)
  el.appendChild(bulat)

  // Netral, bukan warna skor: satu kelompok memuat banyak skor sekaligus.
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!peta) return
    const b = new maplibregl.LngLatBounds()
    anggota.forEach(a => b.extend([a.lng, a.lat]))
    // Padding kecil: di 390px, padding besar membuat perbesarannya kurang dan kelompoknya
    // tidak terpisah.
    peta.fitBounds(b, { padding: 70, maxZoom: 19, duration: 600, essential: true })
  })
  return el
}

// Identitas penanda adalah keanggotaannya, bukan urutannya. Daftar anggota diurutkan
// supaya urutan pengelompokan tidak ikut menentukan kunci.
function kunciKelompok(g: Kelompok): string {
  return g.anggota.length === 1
    ? `s:${g.anggota[0]!.id}`
    : `k:${g.anggota.map(a => a.id).sort().join(',')}`
}

// Skor bisa berubah tanpa keanggotaan berubah. Diperbarui di tempat.
function segarkanIsi(el: HTMLElement, l: LokasiPeta) {
  const bulat = el.querySelector<HTMLElement>('.penanda-bulat')
  if (bulat && bulat.textContent !== String(l.skor)) bulat.textContent = String(l.skor)
  el.style.setProperty('--warna-skor', warnaSkor(l.skor))
  el.dataset.status = l.status
  el.setAttribute('aria-label', `${l.nama}, skor ${l.skor} dari 100, ${labelSkor(l.skor)}`)
}

function gambarPenanda() {
  if (!peta) return

  const bertahan = new Map<string, maplibregl.Marker>()

  for (const g of kelompokkan()) {
    const kunci = kunciKelompok(g)
    const satu = g.anggota.length === 1

    // Keanggotaan sama: dipakai ulang, MapLibre yang memindahkan posisinya sendiri.
    const lama = penanda.get(kunci)
    if (lama) {
      penanda.delete(kunci)
      if (satu) segarkanIsi(lama.getElement(), g.anggota[0]!)
      bertahan.set(kunci, lama)
      continue
    }

    const el = satu ? buatElemenPenanda(g.anggota[0]!) : buatElemenKluster(g.anggota)
    const lng = satu ? g.anggota[0]!.lng : g.anggota.reduce((s, a) => s + a.lng, 0) / g.anggota.length
    const lat = satu ? g.anggota[0]!.lat : g.anggota.reduce((s, a) => s + a.lat, 0) / g.anggota.length

    // Transform dipasang sebelum elemen masuk DOM. MapLibre memasangnya lewat antrean
    // tugas yang baru jalan bingkai berikutnya, jadi tanpa ini elemen baru berkedip
    // satu bingkai di pojok kiri atas peta.
    const titik = peta.project([lng, lat])
    el.style.transform = `translate(-50%, -50%) translate(${titik.x}px, ${titik.y}px)`

    bertahan.set(kunci, new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(peta))
  }

  // Sisanya kelompok yang keanggotaannya berubah. Hanya itu yang dibongkar.
  penanda.forEach(m => m.remove())
  penanda = bertahan

  tandaiTerpilih()
}

function tandaiTerpilih() {
  penanda.forEach((m) => {
    const el = m.getElement()
    if (!el.dataset.id) return
    el.dataset.terpilih = String(el.dataset.id === props.terpilih)
  })
}

function pasFrame(durasi = 0) {
  if (!peta || props.lokasi.length === 0) return
  const b = new maplibregl.LngLatBounds()
  props.lokasi.forEach(l => b.extend([l.lng, l.lat]))
  peta.fitBounds(b, {
    padding: { top: 120, bottom: 200, left: 48, right: 48 },
    maxZoom: 16,
    duration: durasi,
    essential: true,
  })
}

// Pembungkus client-only memasang elemen root setelah onMounted, jadi template ref masih
// null di sana. Inisialisasi digantung ke ref-nya sendiri.
watch(wadah, (el) => {
  if (!el || peta) return

  const kunci = config.public.maptilerKey
  peta = new maplibregl.Map({
    container: el,
    style: kunci
      ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${kunci}`
      : GAYA_OSM,
    center: PUSAT,
    zoom: 14.5,
    attributionControl: { compact: true },
  })

  peta.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

  // WAJIB dipasang sebelum pasFrame(). Pembingkaian pertama berdurasi nol, jadi ia
  // memancarkan moveend saat itu juga; kalau pendengarnya belum ada, penanda tampil
  // dalam kelompok yang salah sampai peta digeser.
  peta.on('moveend', gambarPenanda)

  // Penanda adalah overlay DOM, bukan lapisan peta, jadi tidak menunggu gaya dimuat.
  gambarPenanda()
  pasFrame()

  // 'idle', bukan 'load', supaya rangkanya tidak hilang selagi layar masih putih.
  peta.once('idle', laporSiap)

  // Jaring pengaman: ubin yang macet tidak boleh menutupi peta selamanya.
  setTimeout(laporSiap, 12000)

  // Gaya MapTiler gagal, misalnya kuota habis: turunkan ke raster OSM.
  let sudahJatuh = false
  peta.on('error', () => {
    if (sudahJatuh || !kunci || !peta) return
    if (peta.isStyleLoaded()) return
    sudahJatuh = true
    peta.setStyle(GAYA_OSM)
    peta.once('idle', laporSiap)
  })

  // Klik di area kosong menutup kartu ringkas.
  peta.on('click', () => emit('pilih', null))
}, { immediate: true, flush: 'post' })

// Biru, satu-satunya warna di luar palet skor: hijau akan tertukar dengan arti skor.
function tandaiPosisiSaya(lat: number, lng: number) {
  if (!peta) return

  if (!penandaSaya) {
    const el = document.createElement('div')
    el.className = 'titik-saya'
    el.setAttribute('aria-hidden', 'true')

    // Alasannya sama dengan penanda skor: tanpa ini titiknya berkedip satu bingkai di pojok
    // kiri atas peta.
    const titik = peta.project([lng, lat])
    el.style.transform = `translate(-50%, -50%) translate(${titik.x}px, ${titik.y}px)`

    penandaSaya = new maplibregl.Marker({ element: el })
  }

  penandaSaya.setLngLat([lng, lat]).addTo(peta)
  peta.easeTo({ center: [lng, lat], zoom: Math.max(peta.getZoom(), 16), duration: 800, essential: true })
}

// Memindahkan pandangan tanpa menaruh penanda, dipakai pencarian area.
function pindahKe(lat: number, lng: number, zoom = 15.5) {
  peta?.easeTo({ center: [lng, lat], zoom, duration: 900, essential: true })
}

defineExpose({ tandaiPosisiSaya, pindahKe })

onBeforeUnmount(() => {
  penandaSaya?.remove()
  penandaSaya = null
  penanda.forEach(p => p.remove())
  peta?.remove()
  peta = null
})

// Pembingkaian pertama tanpa animasi. Perubahan jumlah lokasi oleh penyaring pakai easing,
// supaya terlihat isinya yang berubah, bukan petanya yang pindah tempat.
let jumlahTerakhir = props.lokasi.length

watch(() => props.lokasi, () => {
  gambarPenanda()

  const berubah = props.lokasi.length !== jumlahTerakhir
  jumlahTerakhir = props.lokasi.length
  if (berubah) pasFrame(650)
}, { deep: true })

// Memusatkan tiap penanda yang diketuk justru menyembunyikannya di balik bilah filter atau
// kartu ringkas. Digeser hanya kalau penandanya memang tertutup.
function pastikanTerlihat(l: LokasiPeta) {
  if (!peta) return

  const kotak = peta.getContainer()
  const titik = peta.project([l.lng, l.lat])
  const TINGGI_LAPISAN_ATAS = 130
  const TINGGI_KARTU = 250

  const tertutup
    = titik.y < TINGGI_LAPISAN_ATAS
    || titik.y > kotak.clientHeight - TINGGI_KARTU
    || titik.x < 32
    || titik.x > kotak.clientWidth - 32

  if (!tertutup) return

  peta.easeTo({
    center: [l.lng, l.lat],
    offset: [0, -(TINGGI_KARTU - TINGGI_LAPISAN_ATAS) / 2],
    duration: 400,
    // Tanpa essential, MapLibre melewati animasinya pada perangkat yang meminta gerak
    // dikurangi, dan penandanya justru berpindah mendadak.
    essential: true,
  })
}

watch(() => props.terpilih, () => {
  tandaiTerpilih()
  const l = props.lokasi.find(x => x.id === props.terpilih)
  if (l) pastikanTerlihat(l)
})
</script>

<template>
  <div ref="wadah" class="h-full w-full" />
</template>
