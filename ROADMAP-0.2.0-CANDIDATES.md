# 🗺️ Kandidat Fitur Herald Styx UI v0.2.0

Dokumen ini memuat seluruh fitur dari dua repositori referensi:
1. **[apoapostolov/hermes-agent-awesome-plugins](https://github.com/apoapostolov/hermes-agent-awesome-plugins)** (Pack 26 plugin modular Hermes)
2. **[sagarmainkar/hermes-genui](https://github.com/sagarmainkar/hermes-genui)** (Generative UI interaktif untuk chat & dashboard)

---

## 📌 Cara Menandai
- Ubah `[ ]` menjadi `[x]` pada fitur atau kategori yang ingin diimplementasikan ke **Herald Styx UI v0.2.0**.
- Tambahkan catatan di baris `> Catatan:` jika ada penyesuaian khusus atau ide kombinasi dengan fitur yang sudah ada (Agent Panel, Status Chip, Logo, dll.).

---

# BAGIAN 1: Hermes Agent Awesome Plugins
Sumber: `apoapostolov/hermes-agent-awesome-plugins`

### 1. Status Bar
- [ ] **1.1. Provider Status**
  - **Deskripsi:** Menampilkan kuota tersisa & batas pemakaian per provider AI aktif (DeepSeek, OpenAI/Codex, GLM, Anthropic, Gemini, OpenRouter, dll.). Mendukung rotasi akun otomatis dan timer jam peak/off-peak.
  - **Relevansi Styx:** Bisa dipadukan dengan Model Chip Styx yang sudah ada di status bar.
  - > Catatan:
- [x] **1.2. Iteration Budget Meter**
  - **Deskripsi:** Menghitung akumulasi turn dan tool step secara kumulatif (`12 turns · 181 steps`) saat agent bekerja, lengkap dengan popover rata-rata waktu eksekusi.
  - **Relevansi Styx:** Sangat cocok disematkan di header Agent Panel atau pada status chip Styx.
  - > Catatan:
- [x] **1.3. Reasoning Switch**
  - **Deskripsi:** Tombol siklus tingkat pemikiran (*reasoning effort*: low, medium, high) langsung dari status bar dengan indikator warna tanpa harus membuka menu Settings.
  - **Relevansi Styx:** Pelengkap kontrol model yang cepat.
  - > Catatan:
- [ ] **1.4. Radio Plus**
  - **Deskripsi:** Pemutar streaming radio terintegrasi di status bar dengan pencarian ribuan stasiun (Radio Browser, TuneIn, Shoutcast), metadata lagu live, dan HLS stream.
  - **Relevansi Styx:** Fitur kenyamanan/produktivitas background saat coding.
  - > Catatan:

---

### 2. Tools & Memory (Alat & Memori)
- [x] **2.1. Intelligent Tool Break**
  - **Deskripsi:** Tombol/strip kontrol di atas composer (`/break`, `/again`, dll.) untuk membatalkan atau menginterupsi tool yang macet/berjalan kelamaan tanpa membatalkan seluruh sesi chat.
  - **Relevansi Styx:** Bisa disematkan langsung di dalam Agent Panel pada baris step yang statusnya sedang `running` terlalu lama.
  - > Catatan:
- [x] **2.2. Vercel Agent Desktop Support (Khusus Windows)**
  - **Deskripsi:** Alat otomasi Windows via UI Accessibility Tree (klik, ketik form, navigasi jendela, clipboard) secara headless tanpa merebut kursor mouse pengguna.
  - **Relevansi Styx:** Memperluas kapabilitas agen untuk berinteraksi dengan aplikasi desktop Windows.
  - > Catatan:
- [ ] **2.3. Memory Review**
  - **Deskripsi:** Dialog konfirmasi visual untuk meninjau dan menyetujui/menolak fakta memori baru yang ingin dicatat agen sebelum disimpan permanen ke database memori.
  - **Relevansi Styx:** Mirip dengan Approval Card yang sudah didukung Styx.
  - > Catatan:
- [x] **2.4. CDP Manager (Chrome DevTools Protocol)**
  - **Deskripsi:** Mengelola port CDP browser lokal dari status bar/chat tool untuk otomasi browsing web agen.
  - **Relevansi Styx:** Mempermudah debugging tool scraping web agen.
  - > Catatan:
- [x] **2.5. Delegation Nudge**
  - **Deskripsi:** Pengingat otomatis untuk model jika turn berjalan terlalu panjang (>10 tool call tanpa delegasi) agar menyarankan pembagian tugas ke sub-agent demi efisiensi biaya.
  - **Relevansi Styx:** Sangat selaras dengan section `Sub-agents` yang ada di Agent Panel Styx.
  - > Catatan:
- [x] **2.6. Jev Routing**
  - **Deskripsi:** Router model cerdas per-turn yang otomatis memilih model dan level reasoning paling hemat dan tepat berdasarkan kompleksitas prompt.
  - **Relevansi Styx:** Optimalisasi pemilihan model otomatis.
  - > Catatan:
- [x] **2.7. Byparr Tools & MCP**
  - **Deskripsi:** Integrasi solver anti-bot/Cloudflare (FlareSolverr) agar agen dapat mengambil halaman web yang terhalang challenge cookie.
  - **Relevansi Styx:** Penguat tool web extraction.
  - > Catatan:

---

### 3. Capabilities & Catalog (Manajemen Ekstensi)
- [ ] **3.1. Catalog Redesign**
  - **Deskripsi:** Tampilan visual baru untuk halaman Capabilities/Plugins dengan kartu hover pratinjau, artwork besar, dan tombol switch cepat untuk plugin, skill, dan toolset.
  - **Relevansi Styx:** Desain estetik tanpa merusak layout dasar.
  - > Catatan:
- [x] **3.2. Better Capabilities**
  - **Deskripsi:** Fitur manajemen skill lanjutan: hapus skill, export/package skill ke ZIP, eksplorasi isi file skill, dan preset aktif/nonaktif per profil kerja.
  - **Relevansi Styx:** Manajemen alat kerja yang lebih rapi.
  - > Catatan:

---

### 4. Sessions & Sidebar (Tampilan Daftar Sesi)
- [x] **4.1. Better Session Appearance**
  - **Deskripsi:** Kustomisasi icon dan warna per sesi chat di sidebar (mengganti dot bawaan dengan ikon star, rocket, flame, terminal, dll.) serta pewarnaan otomatis berdasarkan kata kunci judul.
  - **Relevansi Styx:** Mempercantik sidebar tanpa mengubah tema utama.
  - > Catatan:
- [ ] **4.2. Sidebar Manager**
  - **Deskripsi:** Menyembunyikan, menampilkan, dan mengatur ulang urutan item navigasi sidebar Hermes.
  - **Relevansi Styx:** Kustomisasi workspace minimalis.
  - > Catatan:
- [ ] **4.3. Drag to Pin Session**
  - **Deskripsi:** Fitur drag-and-drop di sidebar untuk menyematkan (pin/unpin) sesi chat penting di posisi teratas secara permanen.
  - **Relevansi Styx:** Navigasi chat yang produktif.
  - > Catatan:
- [x] **4.4. Session Retitler**
  - **Deskripsi:** Otomatis memperbarui judul percakapan secara cerdas setelah $N$ pesan berdasarkan ringkasan topik terkini (tidak menimpa judul yang dinamai manual).
  - **Relevansi Styx:** Menjaga daftar riwayat chat tetap rapi dan relevan.
  - > Catatan:
- [x] **4.5. Scroll on Switch**
  - **Deskripsi:** Otomatis melompat ke pesan paling bawah saat berpindah sesi chat tanpa merusak streaming pesan aktif.
  - **Relevansi Styx:** Peningkatan kenyamanan UX kecil namun berdampak besar.
  - > Catatan:

---

### 5. Composer (Area Input Chat)
- [ ] **5.1. Opaque Composer**
  - **Deskripsi:** Menjadikan latar belakang kotak input chat solid/tidak tembus pandang agar teks riwayat percakapan tidak bertumpuk membingungkan saat di-scroll.
  - **Relevansi Styx:** Perbaikan visual murni yang praktis.
  - > Catatan:
- [ ] **5.2. Queue Container Fix**
  - **Deskripsi:** Memperbaiki posisi tombol edit, hapus, dan jalankan pada antrean pesan prompt agar selalu terlihat tanpa harus mengarahkan mouse (hover).
  - **Relevansi Styx:** UX perbaikan alur antrean pesan.
  - > Catatan:
- [ ] **5.3. Next Steps (Interactive Chips)**
  - **Deskripsi:** Menampilkan tombol saran aksi/pertanyaan lanjutan di bawah jawaban model (`::nextsteps{...}`). Pengguna cukup klik untuk mengirim atau memilih beberapa sekaligus dengan checkbox.
  - **Relevansi Styx:** Bisa diintegrasikan di bawah jawaban chat atau di dalam Agent Panel (bagian Plan/Followup).
  - > Catatan:
- [x] **5.4. Prompt Enhance**
  - **Deskripsi:** Tombol pustaka template prompt di composer untuk menyempurnakan draf pesan pengguna sebelum dikirim ke agen.
  - **Relevansi Styx:** Asisten penulisan prompt.
  - > Catatan:

---

### 6. Writing, Reading & Posting (Produktivitas Konten)
- [x] **6.1. Voice Gate**
  - **Deskripsi:** Filter linter gaya bahasa otomatis untuk menyaring kalimat "AI slop" / klise generik AI (110 pola) sebelum respons dicetak ke layar.
  - **Relevansi Styx:** Peningkatan kualitas jawaban agen.
  - > Catatan:
- [ ] **6.2. RSS Reader**
  - **Deskripsi:** Pembaca feed RSS terintegrasi 3 kolom dengan folder dan integrasi tool agen untuk merangkum berita harian.
  - **Relevansi Styx:** Pusat kurasi berita langsung di Hermes.
  - > Catatan:
- [ ] **6.3. Reddit Integration**
  - **Deskripsi:** Integrasi akun Reddit, browser thread lokal, penyimpanan arsip postingan, dan 22 tool interaksi Reddit untuk agen.
  - **Relevansi Styx:** Riset komunitas langsung dari chat.
  - > Catatan:

---

# BAGIAN 2: Hermes GenUI (Generative UI)
Sumber: `sagarmainkar/hermes-genui`

### 7. Interactive Chat UI Blocks (Komponen Visual di Chat)
- [x] **7.1. Visual Charts & Graphs**
  - **Deskripsi:** Grafik interaktif kaya (Line dengan pewarnaan gain/loss, Column/Bar, Donut, Pie, Area, Heatmap, Combo) dengan hover tooltip kartu detail.
  - > Catatan:
- [x] **7.2. Numbers & KPI Metric Cards**
  - **Deskripsi:** Kartu ringkasan metrik statistik (KPI card, sparkline trend mini, target progress bar, streak counter).
  - > Catatan:
- [x] **7.3. Interactive Tables & Ranked Lists**
  - **Deskripsi:** Tabel data yang bisa di-sort kolomnya secara dinamis, dilengkapi visual mini-bar di sel angka dan ranked list dengan foto/ikon.
  - > Catatan:
- [ ] **7.4. Plans, Itineraries & Persistent Checklists**
  - **Deskripsi:** Jadwal perjalanan bertahap (day-by-day stops), kalender harian, dan to-do checklist interaktif yang status centangnya tersimpan permanen di memori sesi.
  - > Catatan:
- [x] **7.5. Interactive Controls & Live Calculators**
  - **Deskripsi:** Simulasi interaktif kalkulator dengan slider input real-time yang langsung menggerakkan grafik (misal simulasi cicilan, tabungan, ROI), form input dinamis, dan tombol filter.
  - > Catatan:
- [x] **7.6. Step-by-Step Explainers & Flow Simulations**
  - **Deskripsi:** Diagram alur konsep bertahap yang kotaknya dapat diinspeksi langkah demi langkah, simulasi waktu beranimasi, dan model 3D visual.
  - > Catatan:
- [ ] **7.7. Media Photo Strips**
  - **Deskripsi:** Strip galeri gambar terkurasi dari Unsplash, Pexels, atau Tavily Image lengkap dengan atribusi sumber dan kartu informasi.
  - > Catatan:
- [ ] **7.8. Layout Containers (Tabs, Grids & Accordions)**
  - **Deskripsi:** Kontainer tata letak modular (grid multi-kolom, tabbed sections, kartu accordion yang dapat dilipat, callout box catatan).
  - > Catatan:

---

### 8. Today Page (Dasbor Asisten Pribadi)
- [ ] **8.1. Header Band & Ringkasan Cuaca**
  - **Deskripsi:** Banner pembuka harian berisi sapaan, ramalan cuaca lokal, dan ringkasan status tugas (*"1 overdue, 8 need you, 4 handled"*).
  - > Catatan:
- [ ] **8.2. Kartu Up Next & Needs You**
  - **Deskripsi:** Pengingat otomatis untuk tagihan jatuh tempo, jadwal rapat, paket pengiriman, atau tiket pemesanan yang diambil dari integrasi MCP (Gmail, Calendar, dsb.).
  - > Catatan:
- [ ] **8.3. Tombol Aksi Cepat & Pay Link**
  - **Deskripsi:** Tombol bayar langsung ke halaman resmi layanan dan tombol delegasi perintah sekali klik ke Hermes.
  - > Catatan:
- [ ] **8.4. Handled Archive**
  - **Deskripsi:** Riwayat pelacakan agenda yang sudah selesai dalam 3 hari terakhir dengan tombol buka kembali (*Reopen*).
  - > Catatan:
- [ ] **8.5. Prepared Ideas**
  - **Deskripsi:** Ide-ide otomatis yang disiapkan sebelum diminta (ide kado ulang tahun sesuai tanggal kalender, resep makanan, rencana rute).
  - > Catatan:

---

### 9. Custom Dashboards & Pinned Sidebar Pages
- [x] **9.1. Pembuatan Dasbor dari Tool / MCP Data**
  - **Deskripsi:** Perintah suara/teks seperti *"Buatkan dashboard sales"* yang otomatis memanggil MCP read-only dan merender grafik + KPI komprehensif.
  - > Catatan:
- [x] **9.2. Keep in Sidebar (Pin ke Sidebar)**
  - **Deskripsi:** Tombol satu klik untuk menyematkan dasbor hasil generate menjadi halaman mandiri permanen di sidebar Hermes.
  - > Catatan:
- [x] **9.3. Background & Scheduled Auto-Refresh**
  - **Deskripsi:** Kemampuan me-refresh data dasbor secara otomatis atau terjadwal (misal setiap pagi jam 8) dengan mengulang query read-only yang sama.
  - > Catatan:

---

### 10. Fallback Engine
- [ ] **10.1. Smart Text & Markdown Table Fallback**
  - **Deskripsi:** Deteksi otomatis apakah platform klien (misal Telegram bot atau CLI) mendukung rendering grafik GenUI; jika tidak, secara transparan beralih ke tabel Markdown bersih tanpa memunculkan tag kode mentah `::blocks`.
  - > Catatan:

---

## 💡 Rekomendasi Sinergi untuk Herald Styx UI v0.2.0

Herald Styx UI memiliki keunggulan utama pada **Observabilitas Kerja Agent (Agent Panel)** dan **Identitas Model/Layanan (Logos & Status Chip)** tanpa merusak tema pengguna.

Beberapa kombinasi alami yang sangat cocok diintegrasikan:
1. **Agent Panel Supercharged:**
   - Tambahkan **Iteration & Step Meter (1.2)** ke header panel.
   - Tambahkan **Live Stalled Tool Indicator & Break Action (2.1)** di baris step yang sedang `running`.
   - Tambahkan **Next Steps Suggestions (5.3)** di bawah section Plan.
2. **Visual Feedback & Quality of Life:**
   - Tambahkan **Better Session Appearance (4.1)** untuk ikon & warna sesi di sidebar.
   - Tambahkan **Reasoning Switch (1.3)** di samping Model Chip Styx.
   - Tambahkan **Opaque Composer (5.1)** untuk keterbacaan input.
3. **GenUI Lite Inspector:**
   - Jika GenUI diaktifkan, Agent Panel bisa mendeteksi blok interaktif yang dibuat agent (KPI, Chart, Table) dan menampilkannya di tab *Artifacts*.
