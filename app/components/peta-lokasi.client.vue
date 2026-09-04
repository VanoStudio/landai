<script setup lang="ts">
// maplibre-gl v6 tidak punya default export lagi, hanya named export.
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const props = defineProps<{
  lokasi: LokasiPeta[]
  terpilih?: string | null
}>()

const emit = defineEmits<{ pilih: [LokasiPeta | null] }>()

const config = useRuntimeConfig()
const wadah = ref<HTMLDivElement | null>(null)
let peta: maplibregl.Map | null = null
let penanda: maplibregl.Marker[] = []

// Koridor Blok M, titik mulai survei (PRD bagian 9).
const PUSAT: [number, number] = [106.7983, -6.2440]

// Basemap netral supaya warna skor jadi satu-satunya warna kuat di layar.
// Kalau kunci tidak ada atau gagal, jatuh ke raster OSM supaya peta tetap muncul.
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

function buatElemenPenanda(l: LokasiPeta): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'penanda-skor'
  el.style.setProperty('--warna-skor', warnaSkor(l.skor))
  el.dataset.status = l.status
  el.dataset.id = l.id
  el.setAttribute('aria-label', `${l.nama}, skor ${l.skor} dari 100, ${labelSkor(l.skor)}`)
  el.textContent = String(l.skor)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    emit('pilih', l)
  })
  return el
}

function gambarPenanda() {
  if (!peta) return
  penanda.forEach(p => p.remove())
  penanda = props.lokasi.map(l =>
    new maplibregl.Marker({ element: buatElemenPenanda(l) })
      .setLngLat([l.lng, l.lat])
      .addTo(peta!),
  )
  tandaiTerpilih()
}

function tandaiTerpilih() {
  penanda.forEach((m) => {
    const el = m.getElement()
    el.dataset.terpilih = String(el.dataset.id === props.terpilih)
  })
}

function pasFrame() {
  if (!peta || props.lokasi.length === 0) return
  const b = new maplibregl.LngLatBounds()
  props.lokasi.forEach(l => b.extend([l.lng, l.lat]))
  peta.fitBounds(b, {
    padding: { top: 120, bottom: 200, left: 48, right: 48 },
    maxZoom: 16,
    duration: 0,
  })
}

// Pembungkus komponen client-only Nuxt memasang elemen root setelah onMounted,
// jadi template ref masih null di sana pada muat pertama. Inisialisasi digantung
// ke ref-nya sendiri, bukan ke onMounted.
watch(wadah, (el) => {
  if (!el || peta) return

  const kunci = config.public.maptilerKey
  peta = new maplibregl.Map({
    container: el,
    style: kunci
      ? `https://api.maptiler.com/maps/dataviz-light/style.json?key=${kunci}`
      : GAYA_OSM,
    center: PUSAT,
    zoom: 14.5,
    attributionControl: { compact: true },
  })

  peta.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

  // Penanda adalah overlay DOM, bukan lapisan peta, jadi tidak perlu menunggu
  // gaya selesai dimuat. Digambar langsung supaya lokasi sudah terlihat walau
  // tile masih dalam perjalanan di jaringan lambat.
  gambarPenanda()
  pasFrame()

  // Kalau gaya MapTiler gagal (kuota habis, kunci dibatasi domain, jaringan juri
  // memblokir), peta tidak boleh kosong saat demo. Turunkan ke raster OSM.
  let sudahJatuh = false
  peta.on('error', () => {
    if (sudahJatuh || !kunci || !peta) return
    if (peta.isStyleLoaded()) return
    sudahJatuh = true
    peta.setStyle(GAYA_OSM)
  })

  // Klik di area kosong menutup kartu ringkas.
  peta.on('click', () => emit('pilih', null))
}, { immediate: true, flush: 'post' })

onBeforeUnmount(() => {
  penanda.forEach(p => p.remove())
  peta?.remove()
  peta = null
})

watch(() => props.lokasi, () => gambarPenanda(), { deep: true })

// Memusatkan setiap penanda yang diketuk justru menyembunyikannya di balik bilah
// filter atau kartu ringkas. Peta hanya digeser kalau penanda benar-benar berada
// di area yang tertutup lapisan antarmuka.
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
  })
}

watch(() => props.terpilih, () => {
  tandaiTerpilih()
  const l = props.lokasi.find(x => x.id === props.terpilih)
  if (l) pastikanTerlihat(l)
})
</script>

<template>
  <div ref="wadah" class="h-full w-full bg-gray-100" />
</template>
