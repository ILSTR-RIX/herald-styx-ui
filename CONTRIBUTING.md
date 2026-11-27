# Berkontribusi ke Herald Styx UI

Terima kasih sudah mau membantu. Kontribusi yang paling sering dibutuhkan adalah **menambah logo** model atau service, dan untuk itu cukup mengedit satu file: `logos.config.json`. Panduan ini menjelaskan langkah-langkahnya dari awal sampai pull request.

## Yang dibutuhkan

- [Node.js](https://nodejs.org) 18 atau lebih baru. Build tidak butuh `npm install`.
- Git dan akun GitHub.
- Hermes Desktop, jika ingin mencoba hasilnya langsung (opsional, tapi disarankan).

## Menambah logo

### 1. Fork dan clone

```sh
git clone https://github.com/<username-kamu>/herald-styx-ui.git
cd herald-styx-ui
git checkout -b logo-<nama>
```

### 2. Cari ikonnya

Ada dua sumber ikon. Pakai yang sesuai jenisnya:

| Jenis | Sumber | Prefix | Contoh |
|---|---|---|---|
| **Model** (vendor LLM) | [LobeHub Icons](https://lobehub.com/icons) | `lobe:` | `lobe:ai21`, `lobe:inflection` |
| **Service** (tool, MCP server, situs) | [Simple Icons](https://simpleicons.org) | `si:` | `si:trello`, `si:todoist` |

Pastikan nama ikonnya ada **di versi yang dipakai proyek** (lihat `versions` di `logos.config.json`). Buka URL berikut di browser; jika muncul SVG, namanya benar:

```
https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.106.0/icons/<nama>.svg
https://cdn.jsdelivr.net/npm/simple-icons@16.38.1/icons/<slug>.svg
```

Tips:
- LobeHub sering punya varian `-color` (misalnya `claude-color`). Pakai varian berwarna jika ada.
- Beberapa merek sudah dihapus dari Simple Icons karena permintaan pemiliknya (misalnya `slack` sudah tidak ada). Jika ikonnya tidak ada di kedua sumber, ikon itu belum bisa ditambahkan; buka issue saja.

### 3. Tambahkan satu baris

Setiap baris berbentuk:

```json
["id", ["alias", "alias"], "lobe:<nama>" | "si:<slug>", "#warna"]
```

| Bagian | Isi |
|---|---|
| `id` | Nama pendek, huruf kecil, unik di dalam daftarnya. |
| `alias` | Substring huruf kecil yang dicari di nama model atau nama tool. |
| sumber | `lobe:<nama>` atau `si:<slug>`, sesuai langkah 2. Hanya huruf kecil, angka, dan `-`. |
| `#warna` | Warna merek dalam hex. Dipakai untuk ikon satu warna, karena logo dirender sebagai `<img>` dan tidak bisa mewarisi warna teks. |

Contoh menambah service Todoist ke array `services`:

```json
["todoist",      ["todoist"],                      "si:todoist",        "#E44332"],
```

Contoh menambah model AI21 ke array `models`:

```json
["ai21",        ["ai21", "jamba"],                  "lobe:ai21",             "#E91E63"],
```

### 4. Pilih alias dengan hati-hati

Ini bagian yang paling penting. Pencocokan memakai **substring, tanpa membedakan huruf besar-kecil, dan baris pertama yang cocok yang menang**.

- **Model** dicocokkan lebih dulu lewat model id (misalnya `openrouter/anthropic/claude-opus-4.5`), lalu lewat provider. Jadi alias `claude` menang walaupun id-nya diawali `openrouter/`.
- **Service** dicocokkan lewat label app dari gateway (misalnya `GitHub`), bagian tengah nama MCP (`mcp__github__create_issue` → `github`), lalu nama tool.
- **Host di Sources** dicocokkan per label domain utuh, bukan substring. Alias berisi titik (misalnya `x.com`) harus sama dengan host atau akhiran domainnya. Alias dengan `_` atau `__` hanya dipakai untuk nama tool, tidak untuk host.

Aturan praktis:

- **Hindari alias yang terlalu pendek atau umum.** Alias `ai` akan cocok dengan `openai`, `gemini`, `mistral-ai`, dan hampir semuanya. Lebih baik `ai21` atau `jamba`.
- **Letakkan vendor sebelum router.** Router seperti OpenRouter atau Groq menjual ulang model vendor lain, jadi baris router harus berada di bawah baris vendor.
- **Pakai penanda pembeda jika namanya umum.** Contoh yang sudah ada: Linear memakai `linear_` dan `linear.`, bukan `linear`, supaya tidak cocok dengan kata lain. Model `o1` ditulis `/o1` supaya tidak cocok dengan `glm-o1`.
- **Jangan menduplikasi `id`** di daftar yang sama.

Untuk menguji alias dengan cepat, buka console Hermes setelah plugin terpasang:

```js
__heraldStyx.modelLogo('ai21/jamba-1.5-large')?.id     // → "ai21"
__heraldStyx.serviceLogo('mcp__todoist__add_task')?.id  // → "todoist"
__heraldStyx.hostLogo('https://todoist.com/app')?.id    // → "todoist"
```

### 5. Build

```sh
node scripts/build.mjs
```

Build mengunduh SVG yang baru sekali ke `.cache/`, membersihkannya dari script, event handler, dan referensi eksternal, lalu menyisipkannya ke `dist/plugin.js`. Jika sumber ikon salah, build berhenti dengan pesan yang jelas:

| Pesan | Artinya |
|---|---|
| `Error: si:slack: HTTP 404` | Ikon tidak ada di versi itu. Periksa lagi namanya (langkah 2). |
| `Error: bad logo source "si:Bad_Name"` | Format salah. Pakai huruf kecil, angka, dan `-` saja. |
| `Error: ... not an SVG` | URL tidak mengembalikan SVG. |
| `Error: unsafe SVG after sanitise` | SVG berisi script atau handler yang tidak bisa dibersihkan. Pilih ikon lain. |

### 6. Jalankan test

```sh
npm i --no-save react@19 react-dom@19 nanostores @nanostores/react jsdom esbuild
node test/harness.mjs
```

Semua pemeriksaan harus lulus (`ALL PASSED`). Jika alias barumu membuat test logo lama gagal, aliasnya terlalu luas; perbaiki aliasnya, bukan test-nya.

Jika kamu ingin, tambahkan satu baris check di bagian `// 1. Logo matching` pada `test/harness.mjs` untuk logo barumu, misalnya:

```js
check('service: mcp__todoist__add_task → todoist', serviceLogo('mcp__todoist__add_task')?.id === 'todoist')
```

### 7. Coba di Hermes (disarankan)

```sh
HERMES_HOME="$LOCALAPPDATA/hermes" node scripts/build.mjs --install   # Windows (Git Bash)
node scripts/build.mjs --install                                       # macOS / Linux
```

Lalu buka ⌘K / Ctrl+K dan jalankan **Reload desktop plugins**. Periksa logonya di model menu, composer, atau chat row, dan pastikan terlihat jelas di tema terang maupun gelap.

### 8. Commit dan buka pull request

Commit **`logos.config.json` dan `dist/plugin.js` bersama-sama**. `dist/plugin.js` adalah file yang dipasang pengguna, jadi harus selalu sesuai dengan config. Jangan commit folder `.cache/` atau `node_modules/`; keduanya sudah diabaikan oleh `.gitignore`.

```sh
git add logos.config.json dist/plugin.js
git commit -m "Add Todoist logo"
git push origin logo-<nama>
```

Di deskripsi pull request, sebutkan:
- Logo apa yang ditambah, dan dari sumber mana (`lobe:` atau `si:`).
- Contoh nama model, tool, atau host yang sekarang mendapat logo.
- Screenshot dari Hermes jika ada.

## Checklist pull request logo

- [ ] Ikon ada di versi `lobe` / `si` yang tercantum di `versions`.
- [ ] `id` unik dan alias tidak terlalu umum.
- [ ] Baris vendor berada di atas baris router yang menjual ulang modelnya.
- [ ] `node scripts/build.mjs` berhasil.
- [ ] `node test/harness.mjs` menampilkan `ALL PASSED`.
- [ ] `logos.config.json` dan `dist/plugin.js` di-commit bersama.

## Kontribusi lain

Perbaikan bug, fitur, dan dokumentasi juga diterima.

- Kode plugin ada di `src/plugin.js`. **Jangan edit `dist/plugin.js` secara langsung**; file itu ditulis ulang setiap build.
- Plugin hanya boleh meng-import `@hermes/plugin-sdk`, `react`, dan `react/jsx-runtime`. Test harness memeriksa aturan ini.
- Jangan mengubah warna atau layout Hermes. Gaya plugin hanya memakai variabel tema Hermes (`--ui-*`).
- Untuk perubahan besar, buka issue dulu supaya arahnya bisa didiskusikan sebelum kamu menulis banyak kode.
- Tambahkan catatan perubahanmu di bawah `## [Unreleased]` pada [CHANGELOG.md](CHANGELOG.md).

## Merek dan lisensi

Logo adalah milik pemiliknya masing-masing dan hanya dipakai untuk menunjukkan model atau service mana yang sedang dipakai. Jangan menambah logo yang tidak berasal dari LobeHub Icons atau Simple Icons, dan jangan mengubah bentuk logo.

Dengan mengirim kontribusi, kamu setuju kontribusimu dirilis di bawah [lisensi MIT](LICENSE) proyek ini, yang disediakan "AS IS" tanpa garansi.
