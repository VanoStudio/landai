<script setup lang="ts">
// maplibre-gl v6 tidak punya default export lagi, hanya named export.
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const props = defineProps<{ lat: number, lng: number }>()
const emit = defineEmits<{ geser: [{ lat: number, lng: number }] }>()

const config = useRuntimeConfig()
const wadah = ref<HTMLDivElement | null>(null)
let peta: maplibregl.Map | null = null
let pin: maplibregl.Marker | null = null

// Sama seperti peta utama: ref elemen baru terisi setelah onMounted.
watch(wadah, (el) => {
  if (!el || peta) return
  const kunci = config.public.maptilerKey

  peta = new maplibregl.Map({
    container: el,
    style: kunci
      ? `https://api.maptiler.com/maps/dataviz-light/style.json?key=${kunci}`
      : {
          version: 8,
          sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 } },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
    center: [props.lng, props.lat],
    zoom: 17,
    attributionControl: { compact: true },
  })

  pin = new maplibregl.Marker({ draggable: true, color: '#0F6E56' })
    .setLngLat([props.lng, props.lat])
    .addTo(peta)

  pin.on('dragend', () => {
    const p = pin!.getLngLat()
    emit('geser', { lat: p.lat, lng: p.lng })
  })

  peta.on('click', (e) => {
    pin!.setLngLat(e.lngLat)
    emit('geser', { lat: e.lngLat.lat, lng: e.lngLat.lng })
  })
}, { immediate: true, flush: 'post' })

onBeforeUnmount(() => {
  pin?.remove()
  peta?.remove()
  peta = null
})

// Titik bisa berubah dari pencarian nama tempat atau dari GPS device.
watch(() => [props.lat, props.lng], ([lat, lng]) => {
  if (!peta || !pin) return
  const sekarang = pin.getLngLat()
  if (Math.abs(sekarang.lat - lat!) < 1e-9 && Math.abs(sekarang.lng - lng!) < 1e-9) return
  pin.setLngLat([lng!, lat!])
  peta.easeTo({ center: [lng!, lat!], zoom: Math.max(peta.getZoom(), 17), duration: 400 })
})
</script>

<template>
  <div ref="wadah" class="h-full w-full" />
</template>
