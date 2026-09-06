// Matriks pengujian penyaring isi kasar.
//
// Yang diuji bukan cuma "kata kasar tertangkap". Bagian yang paling mudah salah
// justru sisi sebaliknya: nama tempat sungguhan yang TIDAK boleh dituduh. Nama
// seperti "Anjungan Tunai Mandiri", "Bangsal Melati", dan "Klinik Hewan Anjing dan
// Kucing" semuanya sah, dan peringatan palsu pada nama seperti itu membuat orang
// berhenti mempercayai peringatannya sama sekali.
//
// Berkasnya TypeScript dan memakai impor tanpa ekstensi, jadi dikemas dulu dengan
// esbuild yang memang sudah ikut sebagai dependensi Vite. Tidak ada dependensi baru.
//
// Jalankan dari akar repo:
//
//   node docs/qa/uji-saring-kata.mjs

import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const sementara = mkdtempSync(join(tmpdir(), 'landai-saring-'))
const keluaran = join(sementara, 'saring.mjs')

await build({
  entryPoints: [join(process.cwd(), 'app', 'utils', 'saring-kata.ts')],
  outfile: keluaran,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})

const { detectToxicWords, normalizeText, sensorKata } = await import(pathToFileURL(keluaran).href)

const langkah = []
const catat = (nama, lolos, ket = '') => {
  langkah.push({ nama, lolos })
  console.log(`  ${lolos ? 'LOLOS' : 'GAGAL'}  ${nama}${ket ? '  ' + ket : ''}`)
}

// ---------- harus tertangkap ----------
const HARUS_KENA = [
  ['kata kasar polos', 'dasar bangsat'],
  ['kata kasar sebagai nama tempat', 'Warung Kontol'],
  ['huruf besar kecil campur', 'DaSaR GoBlOk'],
  ['huruf berulang tiga kali', 'anjjjir tempat ini'],
  ['huruf berulang dua kali', 'anjjir parah'],
  ['huruf berulang panjang', 'baaaangsaaat'],
  ['leetspeak angka', 'b4ngs4t'],
  ['leetspeak campur simbol', 'b@j1ng4n'],
  ['leetspeak nol dan lima', 'k0nt0l'],
  ['leetspeak dolar', 'a$u'],
  ['tanda baca di tengah kata', 'a.n.j.i.r'],
  ['tanda hubung di tengah kata', 'bang-sat'],
  ['tanda seru berlebihan di ujung', 'goblok!!!'],
  ['simbol at di ujung', 'anjir@@@'],
  ['simbol at di awal kata', '@njir'],
  ['spasi disisipkan di tengah', 'bang sat'],
  ['di tengah kalimat panjang', 'toiletnya rusak parah dan petugasnya tolol sekali'],
  ['kata hewan sebagai umpatan', 'anjing banget tempatnya'],
  ['kata hewan jauh dari penanda konteks', 'anjing lah pokoknya, dekat pasar juga becek'],
]

console.log('\n--- harus tertangkap ---\n')
for (const [nama, teks] of HARUS_KENA) {
  const h = detectToxicWords(teks)
  catat(nama, h.isToxic, h.isToxic ? h.matchedWords.map(sensorKata).join(', ') : `"${teks}"`)
}

// ---------- tidak boleh tertangkap ----------
const TIDAK_BOLEH_KENA = [
  ['nama tempat wajar', 'Stasiun MRT Blok M'],
  ['nama tempat panjang', 'Kantor Kecamatan Kebayoran Baru Jakarta Selatan'],
  ['mengandung penggalan mirip, anjungan', 'Anjungan Tunai Mandiri Bank Mandiri'],
  ['mengandung penggalan mirip, bangsal', 'Bangsal Melati RSUD Pasar Minggu'],
  ['mengandung penggalan mirip, asuransi', 'Kantor Asuransi Jiwa Sejahtera'],
  ['mengandung penggalan mirip, kontrakan', 'Kontrakan Pak Haji nomor 12'],
  ['mengandung penggalan mirip, kontraktor', 'Kantor Kontraktor Bangunan'],
  ['nomor jalan dan angka', 'Jalan Raya Pasar Minggu No 45 RT 05 RW 03'],
  ['singkatan berangka', 'Gg 4 No 5 Blok B3'],
  ['catatan lapangan panjang', 'Ramp di pintu utara agak curam tapi masih bisa dilewati kursi roda. '
    + 'Toilet difabel ada di lantai satu, dekat lift, pintunya cukup lebar. '
    + 'Guiding block terputus di depan eskalator, perlu dilaporkan ke pengelola.'],
  ['klinik hewan, penanda berdekatan', 'Klinik Hewan Anjing dan Kucing Sehat'],
  ['rumah makan, penanda berdekatan', 'Rumah Makan Babi Panggang Karo'],
  ['sate, penanda berdekatan', 'Sate Babi Pak Kumis'],
  ['wisata, penanda berdekatan', 'Curug Setan Bogor'],
  ['taman satwa, penanda berdekatan', 'Taman Safari Monyet Ekor Panjang'],
  ['teks kosong', ''],
  ['hanya spasi', '   '],
]

console.log('\n--- tidak boleh tertangkap ---\n')
for (const [nama, teks] of TIDAK_BOLEH_KENA) {
  const h = detectToxicWords(teks)
  catat(nama, !h.isToxic, h.isToxic ? `salah menuduh: ${h.matchedWords.join(', ')}` : 'bersih')
}

// ---------- normalizeText ----------
console.log('\n--- pembakuan teks ---\n')
for (const [masuk, harap] of [
  ['ANJJJIR', 'anjir'],
  ['b4ngs4t', 'bangsat'],
  ['a.n.j.i.r', 'anjir'],
  // Angka pada nama tempat ikut diterjemahkan leetspeak, 4 jadi a dan 5 jadi s.
  // Hasilnya kata pendek tak bermakna yang tidak ada di daftar mana pun, jadi tidak
  // menimbulkan tuduhan. Diuji supaya perilaku itu tercatat, bukan kebetulan.
  ['Blok M 45', 'blok m as'],
  ['Halo   Dunia', 'halo dunia'],
]) {
  const hasil = normalizeText(masuk)
  catat(`normalizeText("${masuk}")`, hasil === harap, `"${hasil}"`)
}

// ---------- sensor ----------
console.log('\n--- sensor tampilan ---\n')
catat('Kata panjang disensor bagian tengahnya', sensorKata('bangsat') === 'b*****t', sensorKata('bangsat'))
catat('Kata tiga huruf tetap tersamar', sensorKata('asu') === 'a*u', sensorKata('asu'))
catat('Kata asli tidak pernah utuh di layar',
  ['bangsat', 'kontol', 'anjing'].every(k => sensorKata(k) !== k))

rmSync(sementara, { recursive: true, force: true })

const gagal = langkah.filter(l => !l.lolos)
console.log(`\n  ${langkah.length - gagal.length} dari ${langkah.length} pemeriksaan lolos`)
process.exitCode = gagal.length ? 1 : 0
