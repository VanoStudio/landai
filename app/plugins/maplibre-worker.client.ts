import { setWorkerUrl } from 'maplibre-gl'

// Lihat scripts/salin-worker-maplibre.mjs untuk alasannya. Jalur ini dilayani dari
// public/, jadi sama benarnya di dev maupun setelah di-build.
export default defineNuxtPlugin(() => {
  setWorkerUrl('/maplibre-gl-worker.mjs')
})
