# Kebijakan Keamanan

## Versi yang didukung

Perbaikan keamanan hanya dibuat untuk rilis terbaru.

| Versi | Didukung |
|---|---|
| 0.1.x | ✅ |

## Melaporkan celah keamanan

**Jangan laporkan celah keamanan lewat issue publik, diskusi, atau pull request.**

Laporkan secara privat lewat salah satu cara berikut:

1. **GitHub (disarankan):** buka tab [Security](https://github.com/ILSTR-RIX/herald-styx-ui/security) lalu klik **Report a vulnerability**. Laporan hanya terlihat oleh pemelihara.
2. **Email:** ahmadthoriqramadhani@gmail.com dengan subjek `[SECURITY] herald-styx-ui`.

Sertakan sebanyak mungkin dari hal berikut:
- Versi Herald Styx UI (baris kedua `plugin.js`) dan versi Hermes Desktop.
- Jenis masalah dan dampaknya.
- Langkah untuk mereproduksi, atau proof of concept.
- Usulan perbaikan, jika ada.

## Yang bisa kamu harapkan

Proyek ini dipelihara secara sukarela, jadi waktu di bawah ini adalah target, bukan jaminan:

| Tahap | Target |
|---|---|
| Konfirmasi laporan diterima | 3 hari kerja |
| Penilaian awal | 7 hari kerja |
| Perbaikan dan rilis | sesuai tingkat keparahan, diumumkan di halaman Releases |

Laporan yang valid akan dikreditkan di catatan rilis, kecuali kamu ingin tetap anonim. Mohon beri waktu untuk perbaikan sebelum mengungkapkan masalah ke publik.

## Cakupan

Yang termasuk cakupan, antara lain:
- Kode di `src/plugin.js` dan hasil build `dist/plugin.js`.
- `scripts/build.mjs`, termasuk pembersihan SVG. Contoh: SVG yang lolos dengan script atau referensi eksternal.
- Cara plugin membaca DOM Hermes atau menekan tombol approval, jika bisa dipakai untuk menyetujui sesuatu tanpa tindakan pengguna.

Di luar cakupan:
- Celah di Hermes Desktop sendiri. Laporkan ke pemelihara Hermes.
- Celah di LobeHub Icons atau Simple Icons. Laporkan ke proyek tersebut.
- Masalah yang memerlukan akses langsung ke komputer atau akun pengguna.

## Catatan

Herald Styx UI berjalan di dalam Hermes Desktop dengan hak yang sama seperti plugin lain, dan disediakan "AS IS" tanpa garansi sesuai [lisensi MIT](LICENSE). Pasang hanya `plugin.js` dari [halaman Releases](https://github.com/ILSTR-RIX/herald-styx-ui/releases) resmi, dan cocokkan dengan file `plugin.js.sha256` yang menyertainya.
