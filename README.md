# Kira Finance — Sistem Informasi Keuangan Sekolah

Dashboard keuangan sekolah: pemasukan, pengeluaran, anggaran (RAB), jurnal
umum, akun kas & bank, laporan, dokumen bukti, manajemen pengguna, lisensi,
dan backup/restore — dalam satu aplikasi web modular berbasis vanilla
JavaScript (ES Modules), tanpa build step.

## Menjalankan secara lokal

Karena aplikasi memakai ES Modules (`import`/`export`), buka **lewat server
HTTP**, bukan `file://` langsung (browser memblokir module loading dari
`file://`).

```bash
# opsi apa saja yang tersedia di mesin Anda, contoh:
npx serve .
# atau
python3 -m http.server 8080
```

Lalu buka `http://localhost:PORT/index.html`.

**Akun demo** (dibuat otomatis saat pertama kali dijalankan, lihat
`services/auth.service.js#seedDefaultAdmin`):

- Email: `admin@sekolah.sch.id`
- Kata sandi: `admin123`

## Arsitektur

```
index.html          Shell HTML: splash, #app root, portal modal/toast/loader
css/
  variables.css      Design tokens (warna, tipografi, spacing, shadow, motion)
  layout.css         Struktur halaman: .shell, grid, page-header, utility
  components.css     Styling visual tiap komponen (button, card, table, dst)
  animations.css     Keyframes & transition
  style.css          Reset & tipografi dasar
  responsive.css      Breakpoint overrides
js/
  app.js             Entry point: bootstrap auth, mount shell, bind router
  router.js          Router hash-based + route guard per role
  firebase.js         Wrapper opsional ke Firebase (fallback ke localStorage)
  config.js           Konstanta global (nav menu, role, kategori default)
  utils.js             Helper murni (format, validasi, DOM helper)
  auth.js              Jembatan UI <-> auth.service.js + auth state
  storage.js            Lapisan persistensi generik (localStorage backend)
  dashboard.js …        Satu file per halaman, masing-masing ekspor render(container)
components/           UI reusable: navbar, sidebar, modal, toast, loader,
                       card, chart, table, form, datatable
services/              Business logic per domain, murni — tidak menyentuh DOM
assets/                Ikon & gambar
manifest.json, sw.js   Dukungan PWA (installable + app-shell caching)
```

### Alur data

`page module (js/*.js)` → `service (services/*.service.js)` →
`storage.js` → `localStorage`.

Page module tidak pernah mengakses `localStorage` langsung; service tidak
pernah menyentuh DOM. Ini menjaga business logic tetap testable dan UI
tetap dumb/replaceable.

### Menghubungkan ke Firebase (opsional)

Isi `FIREBASE_CONFIG` di `js/config.js`. Selama kosong, `storage.js` berjalan
penuh di atas `localStorage` — aplikasi tetap berfungsi 100% tanpa project
Firebase nyata (cocok untuk demo/instalasi single-device).

## Peran pengguna

| Role        | Akses                                                          |
|-------------|------------------------------------------------------------------|
| Administrator | Semua halaman, termasuk Pengguna, Pengaturan, Lisensi          |
| Bendahara     | Semua transaksi & laporan, termasuk Backup & Restore           |
| Staf Tata Usaha | Input transaksi & lihat laporan                              |

Aturan akses per rute ada di `ROUTE_PERMISSIONS` (`js/config.js`) dan
ditegakkan di `router.js` (guard) serta `sidebar.js` (sembunyikan menu).

## Catatan keamanan

Hashing password (SHA-256 via `crypto.subtle`) dan skema lisensi lokal di
proyek ini cukup untuk instalasi single-tenant/offline. Untuk deployment
multi-sekolah/production sungguhan, ganti `auth.service.js` dan
`license.service.js` agar bicara ke backend/API nyata dengan hashing yang
lebih kuat (bcrypt/argon2) dan penerbitan lisensi server-side.
