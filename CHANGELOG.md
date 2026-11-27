# Changelog

Semua perubahan penting pada Herald Styx UI dicatat di file ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/), dan proyek ini memakai [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Added

- **Iteration Budget Meter**: akumulasi jumlah turn dan step dihitung per sesi (`N turns · M steps`), ditampilkan pada header Agent Panel dan tooltip model chip di status bar.
- **Reasoning Effort Switch**: chip di status bar kanan (`STATUSBAR_AREAS.right`) untuk mengganti tingkat pemikiran model (*none*, *low*, *med*, *high*) per sesi chat secara instan lewat satu klik.
- **Intelligent Tool Break & Stalled Indicator**: tombol interupsi darurat pada baris step yang sedang `running` di Agent Panel (mengirim `session.interrupt`), serta status visual `stalled` jika tool berjalan lebih dari 15 detik.
- **Better Session Appearance**: tombol dot warna interaktif pada baris sesi di sidebar (`SESSION_ROW_AREAS.trailing`) untuk mengelompokkan atau menandai percakapan secara visual.
- **Scroll on Session Switch**: otomatis menggeser tampilan transcript ke pesan paling baru saat berpindah tab sesi percakapan.
- **Prompt Enhancement Action**: tombol template prompt di kotak pesan composer (`COMPOSER_AREAS.actions`) dengan menu cepat (*Review Code*, *Explain Step-by-Step*, *Write Tests*, *Refactor Cleanly*).
- Toggle pengaturan baru di **Settings > Plugins > Herald Styx UI** untuk mengaktifkan atau menonaktifkan masing-masing fitur baru di atas.

## [0.1.0] - 2026-11-27

Rilis pertama. Plugin Hermes Desktop untuk logo model dan service, serta agent panel yang menampilkan kerja agent secara live, tanpa mengubah tema, warna, atau layout.

### Added

- **Logo di model menu**: setiap row model mendapat logo vendor, dicocokkan lewat model id lalu provider.
- **Logo di composer model pill**: logo tampil di samping nama model pada composer tiap chat, termasuk pane terpisah. Model dan provider dibaca dari `aria-label` pill, dengan format lokal Prancis (` : `) dan CJK (`：`) ikut didukung. Pill compact dan pill effort tidak diberi logo.
- **Model chip di status bar**: logo dan nama model yang dipakai. Klik untuk membuka atau menutup agent panel. Router alias tanpa nama vendor memakai provider dari `session.info` chat yang sedang fokus.
- **Logo di chat tool rows**: logo service (GitHub, Gmail, Notion, Obsidian, dan lainnya) menggantikan ikon generik pada tool row.
- **Agent panel** di sisi kanan, mengikuti chat yang sedang fokus:
  - Step: tool call, bridged `tool_call` dipecah per panggilan, step "Thinking", durasi, dan status done / failed / running / stopped.
  - Plan dari `todo.updated`.
  - Sources: host dari URL beserta logonya, dan query pencarian.
  - Sub-agent dengan model, jumlah tool, dan status.
  - Approval card: **Allow once** dan **Deny** menekan card Hermes sendiri jika sedang tampil (lewat `data-approval-run` / `data-approval-deny`), atau mengirim `approval.respond`.
- Turn diakhiri lewat `message.complete`, `message.error`, `session.reclaimed`, dan `approval.cancelled`. Jika koneksi putus tanpa event akhir, turn dihentikan setelah Hermes melaporkan session idle selama 8 detik.
- Host di **Sources** dicocokkan per label domain utuh, jadi `netflix.com` tidak dikira X dan `nonlinear.io` tidak dikira Linear.
- **Settings > Plugins > Herald Styx UI** dengan toggle untuk agent panel, chip status bar, logo di model pill composer, dan logo di chat row.
- Perintah palette **Herald Styx UI: Toggle agent panel**.
- 25 logo vendor model dan 44 logo service, dikonfigurasi di `logos.config.json` dan disisipkan ke `dist/plugin.js` oleh `scripts/build.mjs`. SVG dibersihkan dari script dan referensi eksternal saat build.
- Test harness (`test/harness.mjs`) dengan 89 pemeriksaan, merender React tree asli di jsdom terhadap mock SDK.
- Folder `preview/` berisi screenshot setiap fitur UI.
- Lisensi MIT, disediakan "AS IS" tanpa garansi.

### Changed

- Nama plugin diganti dari **Agent Lens** menjadi **Herald Styx UI**, dengan id dan folder `herald-styx-ui`. Pengaturan lama di `hermes.plugin.agent-lens.*` tidak ikut pindah; hapus folder `desktop-plugins/agent-lens` supaya plugin tidak termuat dua kali.

[Unreleased]: https://github.com/ILSTR-RIX/herald-styx-ui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ILSTR-RIX/herald-styx-ui/releases/tag/v0.1.0
