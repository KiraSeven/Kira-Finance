/**
 * sw.js
 * -----------------------------------------------------------------------
 * Service worker: strategi NETWORK-FIRST untuk semua request same-origin.
 * Selalu mencoba mengambil versi terbaru dari network lebih dulu (supaya
 * perubahan kode saat development langsung kepakai, tidak nyangkut di
 * cache lama) dan hanya jatuh ke cache saat benar-benar offline. Fallback
 * ke '/index.html' HANYA untuk navigasi dokumen (mode: 'navigate'), bukan
 * untuk request .js/.css — supaya kegagalan memuat modul tidak pernah
 * diam-diam diganti dengan HTML (yang menyebabkan "render is not a
 * function" karena modul yang di-import ternyata bukan JS asli).
 *
 * Naikkan CACHE_VERSION setiap kali daftar APP_SHELL_FILES berubah supaya
 * klien lama membuang cache basi-nya.
 * -----------------------------------------------------------------------
 */

const CACHE_VERSION = 'kira-finance-shell-v1';

const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/variables.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/animations.css',
  '/css/style.css',
  '/css/responsive.css',
  '/js/app.js',
  '/js/router.js',
  '/js/firebase.js',
  '/js/config.js',
  '/js/utils.js',
  '/js/auth.js',
  '/js/storage.js',
  '/js/dashboard.js',
  '/js/income.js',
  '/js/expense.js',
  '/js/accounts.js',
  '/js/budget.js',
  '/js/journal.js',
  '/js/reports.js',
  '/js/documents.js',
  '/js/users.js',
  '/js/settings.js',
  '/js/license.js',
  '/js/backup.js',
  '/components/navbar.js',
  '/components/sidebar.js',
  '/components/datatable.js',
  '/components/modal.js',
  '/components/toast.js',
  '/components/loader.js',
  '/components/card.js',
  '/components/chart.js',
  '/components/table.js',
  '/components/form.js',
  '/services/income.service.js',
  '/services/expense.service.js',
  '/services/account.service.js',
  '/services/budget.service.js',
  '/services/report.service.js',
  '/services/license.service.js',
  '/services/auth.service.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll() atomik: kalau satu URL gagal, precache lain ikut batal.
      // allSettled supaya file yang berhasil tetap ke-cache walau ada yang miss.
      Promise.allSettled(
        APP_SHELL_FILES.map((url) =>
          fetch(url).then((res) => (res.ok ? cache.put(url, res) : null)).catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('kira-finance-shell-') && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  const isNavigation = request.mode === 'navigate';

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Fallback ke shell HTML HANYA untuk navigasi dokumen, tidak pernah
        // untuk .js/.css — request modul yang gagal harus tetap gagal,
        // bukan diam-diam diganti HTML.
        if (isNavigation) return caches.match('/index.html');
        return Response.error();
      })
  );
});
