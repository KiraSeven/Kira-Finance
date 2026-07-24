/**
 * app.js
 * -----------------------------------------------------------------------
 * Entry point aplikasi. Tanggung jawabnya:
 *  1. Inisialisasi auth (seed admin default + baca session tersimpan).
 *  2. Mount shell aplikasi (.shell > .shell__sidebar + .shell__main) ke #app.
 *  3. Mendaftarkan router.js dan me-render hasil resolve tiap route:
 *     halaman login, halaman page module, 403, atau 404.
 *  4. Melepas splash screen setelah semuanya siap.
 * Tidak ada logic bisnis di sini — itu tugas services/ dan page module.
 * Class CSS yang dipakai di sini mengikuti definisi di css/layout.css,
 * css/components.css, dan css/responsive.css (.shell, .shell__sidebar,
 * .shell__main, .shell__navbar, .shell__content, .auth-screen, dst).
 * -----------------------------------------------------------------------
 */

import { initAuth, login, getCurrentSession } from './auth.js';
import { initRouter, navigate, refreshRoute } from './router.js';
import { renderSidebar } from '../components/sidebar.js';
import { createSkeletonRows } from '../components/loader.js';
import { toastError, toastSuccess } from '../components/toast.js';
import { initFirebase } from './firebase.js';
import { APP_NAME } from './config.js';

const appRoot = document.getElementById('app');
const splashEl = document.getElementById('app-splash');

let shellEl = null;
let sidebarScrimEl = null;
let contentEl = null;
let currentPageCleanup = null;

/** Bangun / perbarui shell (.shell > .shell__sidebar + .shell__content). Tanpa navbar. */
function ensureShell(title, currentPath) {
  const sidebar = renderSidebar({ currentPath, onNavigate: handleNavigate });
  sidebar.classList.add('shell__sidebar');

  if (shellEl) {
    shellEl.querySelector('.shell__sidebar')?.replaceWith(sidebar);
    return contentEl;
  }

  shellEl = document.createElement('div');
  shellEl.className = 'shell';

  const main = document.createElement('div');
  main.className = 'shell__main';

  contentEl = document.createElement('div');
  contentEl.className = 'shell__content';

  main.appendChild(contentEl);
  shellEl.appendChild(sidebar);
  shellEl.appendChild(main);

  // Tombol buka sidebar, hanya terlihat di layar mobile (lihat .mobile-menu-btn
  // di responsive.css) — mengambang, tidak mengambil ruang/menutupi konten.
  const mobileMenuBtn = document.createElement('button');
  mobileMenuBtn.type = 'button';
  mobileMenuBtn.className = 'mobile-menu-btn';
  mobileMenuBtn.setAttribute('aria-label', 'Buka menu');
  mobileMenuBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>';
  mobileMenuBtn.addEventListener('click', toggleSidebarMobile);
  shellEl.appendChild(mobileMenuBtn);

  sidebarScrimEl = document.createElement('div');
  sidebarScrimEl.className = 'sidebar-scrim hidden';
  sidebarScrimEl.addEventListener('click', closeSidebarMobile);
  shellEl.appendChild(sidebarScrimEl);

  appRoot.innerHTML = '';
  appRoot.appendChild(shellEl);

  return contentEl;
}

function handleNavigate(path) {
  closeSidebarMobile();
  navigate(path);
}

function toggleSidebarMobile() {
  const sidebar = shellEl?.querySelector('.shell__sidebar');
  const isOpen = sidebar?.classList.toggle('is-open');
  sidebarScrimEl?.classList.toggle('hidden', !isOpen);
}

function closeSidebarMobile() {
  shellEl?.querySelector('.shell__sidebar')?.classList.remove('is-open');
  sidebarScrimEl?.classList.add('hidden');
}

function teardownShell() {
  shellEl = null;
  sidebarScrimEl = null;
  contentEl = null;
  appRoot.innerHTML = '';
}

/** Halaman login: dua panel (brand + form), sesuai grid .auth-screen di layout.css */
function renderLoginPage() {
  teardownShell();
  appRoot.innerHTML = `
    <div class="auth-screen">
      <div class="auth-screen__brand">
        <div class="sidebar__brand" style="padding:0;">
          <span class="sidebar__brand-mark">K</span>
          <span class="sidebar__brand-name">${APP_NAME}</span>
        </div>
        <div>
          <h2 class="text-xl" style="margin-bottom: var(--space-2);">Satu dashboard untuk seluruh keuangan sekolah.</h2>
          <p class="text-secondary">Pemasukan, pengeluaran, anggaran, dan laporan — tercatat rapi dan mudah diaudit.</p>
        </div>
        <p class="text-tertiary" style="font-size: var(--text-xs);">&copy; ${new Date().getFullYear()} ${APP_NAME}</p>
      </div>
      <div class="auth-screen__panel">
        <div class="auth-screen__form-wrap stack">
          <div>
            <h1 class="text-xl" style="margin-bottom: var(--space-1);">Masuk ke akun Anda</h1>
            <p class="text-secondary">Kelola keuangan sekolah dengan aman dalam satu dashboard.</p>
          </div>
          <form class="stack" data-login-form novalidate>
            <div class="field">
              <label class="field__label" for="login-email">Email</label>
              <input class="input" type="email" id="login-email" name="email" placeholder="admin@sekolah.sch.id" required />
            </div>
            <div class="field">
              <label class="field__label" for="login-password">Kata Sandi</label>
              <input class="input" type="password" id="login-password" name="password" placeholder="********" required />
            </div>
            <span class="field__error" data-login-error style="display:none;"></span>
            <button type="submit" class="btn btn--primary btn--block" data-login-submit>Masuk</button>
          </form>
          <p class="text-tertiary" style="font-size: var(--text-xs);">
            Akun demo: <span class="mono">admin@sekolah.sch.id</span> / <span class="mono">admin123</span>
          </p>
        </div>
      </div>
    </div>
  `;

  const form = appRoot.querySelector('[data-login-form]');
  const errorEl = appRoot.querySelector('[data-login-error]');
  const submitBtn = appRoot.querySelector('[data-login-submit]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Memproses...';

    const formData = new FormData(form);
    try {
      await login(formData.get('email'), formData.get('password'));
      const firstName = getCurrentSession()?.name?.split(' ')[0];
      toastSuccess(firstName ? `Selamat datang kembali, ${firstName}!` : 'Selamat datang kembali!');
      refreshRoute();
    } catch (error) {
      errorEl.textContent = error.message || 'Gagal masuk. Periksa kembali email dan kata sandi.';
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Masuk';
    }
  });
}

function renderErrorPage({ code, title, message }) {
  teardownShell();
  appRoot.innerHTML = `
    <div class="auth-screen">
      <div class="auth-screen__brand">
        <div class="sidebar__brand" style="padding:0;">
          <span class="sidebar__brand-mark">K</span>
          <span class="sidebar__brand-name">${APP_NAME}</span>
        </div>
        <div></div>
        <p class="text-tertiary" style="font-size: var(--text-xs);">&copy; ${new Date().getFullYear()} ${APP_NAME}</p>
      </div>
      <div class="auth-screen__panel">
        <div class="auth-screen__form-wrap stack" style="text-align:center; align-items:center;">
          <p class="num text-accent" style="font-size: var(--text-3xl); font-weight: var(--weight-bold);">${code}</p>
          <h1 class="text-xl">${title}</h1>
          <p class="text-secondary">${message}</p>
          <button type="button" class="btn btn--primary" data-back-home>Kembali ke Dashboard</button>
        </div>
      </div>
    </div>
  `;
  appRoot.querySelector('[data-back-home]').addEventListener('click', () => navigate('/dashboard'));
}

async function handleRouteResolve(result) {
  if (currentPageCleanup) {
    try { currentPageCleanup(); } catch { /* noop */ }
    currentPageCleanup = null;
  }

  switch (result.type) {
    case 'auth':
      renderLoginPage();
      break;

    case 'not-found':
      renderErrorPage({ code: '404', title: 'Halaman Tidak Ditemukan', message: 'Rute yang Anda tuju tidak tersedia.' });
      break;

    case 'forbidden':
      renderErrorPage({ code: '403', title: 'Akses Ditolak', message: 'Anda tidak memiliki izin untuk membuka halaman ini.' });
      break;

    case 'loading': {
      const content = ensureShell(result.title, result.path);
      content.innerHTML = '';
      content.appendChild(createSkeletonRows(6));
      break;
    }

    case 'page': {
      const content = ensureShell(result.title, result.path);
      try {
        const cleanup = await result.module.render(content);
        if (typeof cleanup === 'function') currentPageCleanup = cleanup;
      } catch (error) {
        console.error(`[app.js] Gagal me-render halaman "${result.path}":`, error);
        toastError('Gagal memuat halaman', 'Silakan coba lagi atau hubungi administrator.');
      }
      break;
    }

    default:
      break;
  }
}

async function bootstrap() {
  try {
    const firebaseReady = await initFirebase();
    if (!firebaseReady) {
      throw new Error(
        'Tidak bisa terhubung ke Firebase. Periksa koneksi internet, atau konfigurasi FIREBASE_CONFIG di js/config.js.',
      );
    }
    await initAuth();
    initRouter(handleRouteResolve);
  } catch (error) {
    console.error('[app.js] Gagal inisialisasi aplikasi:', error);
    appRoot.innerHTML = `
      <div class="auth-screen">
        <div class="auth-screen__panel">
          <div class="auth-screen__form-wrap stack" style="text-align:center;">
            <h1 class="text-xl">Aplikasi Gagal Dimuat</h1>
            <p class="text-secondary">${error.message || 'Muat ulang halaman. Jika masalah berlanjut, hubungi administrator.'}</p>
          </div>
        </div>
      </div>
    `;
  } finally {
    appRoot.hidden = false;
    splashEl?.classList.add('app-splash--hidden');
    setTimeout(() => splashEl?.remove(), 400);
  }
}

bootstrap();
