// maplibre-gl v6 memuat worker-nya lewat `new URL('./maplibre-gl-worker.mjs', import.meta.url)`
// dengan nama berkas yang dirakit saat runtime. Bundler tidak bisa melihat referensi itu
// secara statis, jadi worker tidak pernah ikut ter-emit ke hasil build dan peta gagal
// merender tile tanpa pesan error yang jelas.
//
// Worker itu sendiri mengimpor "./maplibre-gl-shared.mjs" secara relatif, jadi keduanya
// harus disalin berdampingan. Menyalin worker saja membuatnya mati dengan 404 senyap.
//
// Plugin klien menunjuk MapLibre ke salinan ini lewat setWorkerUrl().
// Dijalankan otomatis saat install, dev, dan build.

import { copyFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BERKAS = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

const akar = join(dirname(fileURLToPath(import.meta.url)), '..')
const dirAsal = join(akar, 'node_modules', 'maplibre-gl', 'dist')
const dirTujuan = join(akar, 'public')

await mkdir(dirTujuan, { recursive: true })

for (const berkas of BERKAS) {
  const asal = join(dirAsal, berkas)
  if (!existsSync(asal)) {
    console.error(`[maplibre] ${berkas} tidak ada di ${dirAsal}. Jalankan npm install dulu.`)
    process.exit(1)
  }
  await copyFile(asal, join(dirTujuan, berkas))
}

console.log(`[maplibre] ${BERKAS.length} berkas worker disalin ke public/`)
