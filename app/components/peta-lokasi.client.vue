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

// Komponen ini khusus sisi klien, jadi sebelum hidrasi tidak ada apa pun di layar.
// Justru itu jendela paling kosong yang dilihat pengguna. Rangka pemuatannya karena
// itu tinggal di halaman, yang ikut dirender server, dan komponen ini cuma memberi
// tahu kapan rangka boleh dilepas.
let sudahLapor = false
function laporSiap() {
  if (sudahLapor) return
  sudahLapor = true
  emit('siap')
}
let peta: maplibregl.Map | null = null

// Penanda disimpan berkunci, bukan sebagai senarai. Kuncinya menyandikan
// keanggotaan kelompok, jadi penanda yang keanggotaannya tidak berubah bisa
// dipakai ulang apa adanya alih-alih dibuat ulang tiap kali pandangan berhenti.
let penanda = new Map<string, maplibregl.Marker>()
let penandaSaya: maplibregl.Marker | null = null

// Koridor Blok M, titik mulai survei (PRD bagian 9).
const PUSAT: [number, number] = [106.7983, -6.2440]

// Basemap streets-v2: memuat label jalan, nama tempat, dan ikon kategori umum,
// supaya peta memberi konteks sekitar dan tidak terasa kosong. Konsekuensinya
// basemap kini berwarna sendiri, jadi saturasinya diredam lewat gaya kanvas di
// main.css agar penanda skor tetap jadi warna paling menonjol di layar.
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

// Jarak layar di bawah ini dianggap tumpang tindih. Sedikit lebih besar dari
// diameter penanda, supaya dua penanda tidak saling menyentuh.
const RADIUS_KLUSTER = 48

interface Kelompok {
  anggota: LokasiPeta[]
  x: number
  y: number
}

// Pengelompokan dihitung dari jarak di layar, bukan dari jarak sebenarnya, karena
// yang mengganggu pembacaan adalah tumpang tindih piksel. Konsekuensinya kelompok
// membubar sendiri saat peta diperbesar, tanpa aturan zoom terpisah.
function kelompokkan(): Kelompok[] {
  if (!peta) return props.lokasi.map(l => ({ anggota: [l], x: 0, y: 0 }))

  const grup: Kelompok[] = []
  const terpilih: Kelompok[] = []

  for (const l of props.lokasi) {
    const t = peta.project([l.lng, l.lat])

    // Penanda yang sedang dipilih tidak boleh tersembunyi di dalam kelompok,
    // karena kartunya sedang terbuka dan mata mencari penandanya.
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
  el.textContent = String(anggota.length)
  el.setAttribute('aria-label', `${anggota.length} lokasi berdekatan, perbesar untuk memisahkan`)

  // Warnanya netral, bukan warna skor. Satu kelompok memuat banyak skor sekaligus,
  // jadi memberinya satu warna skor akan menyampaikan hal yang tidak benar.
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!peta) return
    const b = new maplibregl.LngLatBounds()
    anggota.forEach(a => b.extend([a.lng, a.lat]))
    // Padding dijaga kecil: di layar 390px, padding besar menyisakan bidang yang
    // terlalu sempit sehingga perbesarannya kurang dan kelompoknya tidak terpisah.
    peta.fitBounds(b, { padding: 70, maxZoom: 19, duration: 600, essential: true })
  })
  return el
}

// Identitas sebuah penanda adalah keanggotaannya, bukan urutannya. Penanda tunggal
// dikenali dari id lokasinya, kelompok dari daftar anggotanya yang diurutkan supaya
// urutan hasil pengelompokan tidak ikut menentukan kunci.
function kunciKelompok(g: Kelompok): string {
  return g.anggota.length === 1
    ? `s:${g.anggota[0]!.id}`
    : `k:${g.anggota.map(a => a.id).sort().join(',')}`
}

// Isi penanda tunggal bisa berubah tanpa keanggotaannya berubah, misalnya setelah
// skornya dihitung ulang. Diperbarui di tempat, tetap tanpa membuat elemen baru.
function segarkanIsi(el: HTMLElement, l: LokasiPeta) {
  if (el.textContent !== String(l.skor)) el.textContent = String(l.skor)
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

    // Sudah ada dan keanggotaannya sama: dipakai ulang. MapLibre yang memindahkan
    // posisinya sendiri tiap bingkai, jadi tidak ada yang perlu dikerjakan di sini.
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

    // Transform dipasang sebelum elemen masuk ke DOM. MapLibre memasang posisinya
    // lewat antrean tugas DOM yang baru dijalankan pada bingkai berikutnya, jadi
    // elemen baru sempat terlukis satu bingkai di titik nol wadah, yaitu pojok kiri
    // atas peta. Itulah kedipan yang terlihat. Dengan transform awal yang sudah
    // benar, bingkai pertamanya sudah berada di tempatnya.
    const titik = peta.project([lng, lat])
    el.style.transform = `translate(-50%, -50%) translate(${titik.x}px, ${titik.y}px)`

    bertahan.set(kunci, new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(peta))
  }

  // Yang tersisa di peta lama adalah kelompok yang keanggotaannya benar-benar
  // berubah. Hanya itu yang dibongkar.
  penanda.forEach(m => m.remove())
  penanda = bertahan

  tandaiTerpilih()
}

function tandaiTerpilih() {
  penanda.forEach((m) => {
    const el = m.getElement()
    // Penanda kluster tidak punya id tunggal, jadi tidak pernah ditandai terpilih.
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

// Pembungkus komponen client-only Nuxt memasang elemen root setelah onMounted,
// jadi template ref masih null di sana pada muat pertama. Inisialisasi digantung
// ke ref-nya sendiri, bukan ke onMounted.
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

  // Pendengar moveend dipasang SEBELUM pembingkaian pertama, bukan sesudahnya.
  //
  // Dulu urutannya terbalik, dan akibatnya halus tapi nyata: pasFrame() pertama
  // memakai durasi nol, jadi ia melompat seketika dan memancarkan moveend saat itu
  // juga, sebelum pendengarnya ada. Kelompok yang terhitung pada zoom awal 14.5 pun
  // tidak pernah dihitung ulang untuk bingkai yang sebenarnya. Kalau data sudah ikut
  // terhidrasi dari server, watch pada props.lokasi juga tidak pernah menyala, jadi
  // tidak ada satu pun yang memperbaikinya.
  //
  // Yang terlihat pengguna: penanda tampil dalam kelompok yang salah sejak awal, lalu
  // tiba-tiba tersusun ulang begitu peta pertama kali digeser atau diperbesar.
  // Terukur di layar 390px: satu kelompok berisi tiga lokasi menjadi dua tambah satu
  // hanya karena peta digeser lima piksel, tanpa ada penanda yang terpilih dan tanpa
  // perubahan perbesaran.
  peta.on('moveend', gambarPenanda)

  // Penanda adalah overlay DOM, bukan lapisan peta, jadi tidak perlu menunggu
  // gaya selesai dimuat. Digambar langsung supaya lokasi sudah terlihat walau
  // tile masih dalam perjalanan di jaringan lambat.
  gambarPenanda()
  pasFrame()

  // Rangka dilepas begitu ubin pertama benar-benar terlukis. Memakai 'idle' dan
  // bukan 'load' supaya rangkanya tidak hilang selagi layar masih putih.
  peta.once('idle', laporSiap)

  // Jaring pengaman: kalau ubin macet di jaringan buruk, rangka tidak boleh
  // menutupi peta selamanya. Penanda tetap terlihat walau latar masih kosong.
  setTimeout(laporSiap, 12000)

  // Kalau gaya MapTiler gagal (kuota habis, kunci dibatasi domain, jaringan juri
  // memblokir), peta tidak boleh kosong saat demo. Turunkan ke raster OSM.
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

// Titik posisi pengguna. Warnanya biru, satu-satunya warna di luar palet skor,
// karena "kamu di sini" adalah konvensi peta yang sudah dikenal universal dan
// memakai hijau justru akan tertukar dengan arti skor.
function tandaiPosisiSaya(lat: number, lng: number) {
  if (!peta) return

  if (!penandaSaya) {
    const el = document.createElement('div')
    el.className = 'titik-saya'
    el.setAttribute('aria-hidden', 'true')
    penandaSaya = new maplibregl.Marker({ element: el })
  }

  penandaSaya.setLngLat([lng, lat]).addTo(peta)
  peta.easeTo({ center: [lng, lat], zoom: Math.max(peta.getZoom(), 16), duration: 800, essential: true })
}

// Memindahkan pandangan ke sebuah titik tanpa menaruh penanda apa pun, dipakai
// oleh pencarian area di peta utama.
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

// Pembingkaian pertama tanpa animasi, karena tidak ada yang perlu diikuti mata.
// Tapi ketika penyaring mengubah jumlah lokasi, peta bergeser dengan easing supaya
// terlihat bahwa yang berubah adalah isinya, bukan tiba-tiba pindah tempat.
let jumlahTerakhir = props.lokasi.length

watch(() => props.lokasi, () => {
  gambarPenanda()

  const berubah = props.lokasi.length !== jumlahTerakhir
  jumlahTerakhir = props.lokasi.length
  if (berubah) pasFrame(650)
}, { deep: true })

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
  <div ref="wadah" class="h-full w-full" />
</template>
