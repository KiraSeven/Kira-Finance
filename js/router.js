/**
 * router.js
 * -----------------------------------------------------------------------
 * Router SPA sederhana berbasis window.location.hash. Tidak merender apa
 * pun secara langsung — hanya me-resolve hash saat ini ke definisi route
 * (title + loader page module) dan menyiarkan hasilnya lewat callback yang
 * didaftarkan app.js. Guard permission dicek lewat auth.js.
 * -----------------------------------------------------------------------
 */

import { isAuthenticated, canAccessRoute } from './auth.js';

/**
 * Tabel route: path -> { title, load }
 * `load` adalah dynamic import supaya page module hanya diambil saat
 * dibutuhkan (code splitting alami dari ES modules).
 */
const routes = {
  '/dashboard': { title: 'Dashboard', load: () => import('./dashboard.js') },
  '/income': { title: 'Pemasukan', load: () => import('./income.js') },
  '/expense': { title: 'Pengeluaran', load: () => import('./expense.js') },
  '/journal': { title: 'Jurnal Umum', load: () => import('./journal.js') },
  '/budget': { title: 'Anggaran (RAB)', load: () => import('./budget.js') },
  '/accounts': { title: 'Akun Kas & Bank', load: () => import('./accounts.js') },
  '/reports': { title: 'Laporan Keuangan', load: () => import('./reports.js') },
  '/documents': { title: 'Dokumen & Bukti', load: () => import('./documents.js') },
  '/users': { title: 'Pengguna', load: () => import('./users.js') },
  '/settings': { title: 'Pengaturan', load: () => import('./settings.js') },
  '/license': { title: 'Lisensi', load: () => import('./license.js') },
  '/backup': { title: 'Backup & Restore', load: () => import('./backup.js') },
};

const PUBLIC_ROUTE = '/login';
const DEFAULT_ROUTE = '/dashboard';

let onResolve = null;

function getCurrentPath() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash || DEFAULT_ROUTE;
}

export function navigate(path) {
  if (window.location.hash === `#${path}`) {
    resolveCurrentRoute();
  } else {
    window.location.hash = path;
  }
}

async function resolveCurrentRoute() {
  const path = getCurrentPath();

  if (!isAuthenticated()) {
    if (path !== PUBLIC_ROUTE) {
      window.location.hash = PUBLIC_ROUTE;
      return;
    }
    onResolve?.({ type: 'auth', path });
    return;
  }

  if (path === PUBLIC_ROUTE) {
    window.location.hash = DEFAULT_ROUTE;
    return;
  }

  const route = routes[path];
  if (!route) {
    onResolve?.({ type: 'not-found', path });
    return;
  }

  if (!canAccessRoute(path)) {
    onResolve?.({ type: 'forbidden', path, title: route.title });
    return;
  }

  onResolve?.({ type: 'loading', path, title: route.title });
  const module = await route.load();
  onResolve?.({ type: 'page', path, title: route.title, module });
}

/**
 * Inisialisasi router. `callback` dipanggil setiap kali route berubah
 * dengan object hasil resolve (lihat tipe di atas: 'auth' | 'not-found' |
 * 'forbidden' | 'loading' | 'page').
 */
export function initRouter(callback) {
  onResolve = callback;
  window.addEventListener('hashchange', resolveCurrentRoute);
  resolveCurrentRoute();
}

/** Dipanggil ulang setelah login/logout supaya router re-evaluasi guard */
export function refreshRoute() {
  resolveCurrentRoute();
}

export function getRouteTitle(path) {
  return routes[path]?.title || '';
}
