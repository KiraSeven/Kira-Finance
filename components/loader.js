/**
 * loader.js
 * -----------------------------------------------------------------------
 * Overlay loading global (dipakai saat proses async berat: login, backup,
 * restore) dan helper skeleton untuk placeholder loading di dalam page.
 * -----------------------------------------------------------------------
 */

let overlayEl = null;
let activeCount = 0;

function getOverlay() {
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.className = 'loader-overlay';
    overlayEl.innerHTML = '<div class="spinner"></div>';
  }
  return overlayEl;
}

/** Tampilkan overlay loading full-screen. Aman dipanggil bertumpuk. */
export function showLoader() {
  activeCount += 1;
  const overlay = getOverlay();
  if (!overlay.isConnected) {
    document.getElementById('loader-root').appendChild(overlay);
  }
}

/** Sembunyikan overlay loading. Hanya benar-benar hilang saat counter 0. */
export function hideLoader() {
  activeCount = Math.max(0, activeCount - 1);
  if (activeCount === 0 && overlayEl?.isConnected) {
    overlayEl.remove();
  }
}

/** Bungkus sebuah promise dengan loader otomatis muncul/hilang */
export async function withLoader(promiseFn) {
  showLoader();
  try {
    return await promiseFn();
  } finally {
    hideLoader();
  }
}

/** Buat elemen skeleton block untuk placeholder loading di dalam card/table */
export function createSkeleton({ width = '100%', height = '16px', radius } = {}) {
  const el = document.createElement('div');
  el.className = 'skeleton';
  el.style.width = width;
  el.style.height = height;
  if (radius) el.style.borderRadius = radius;
  return el;
}

/** Render beberapa baris skeleton sekaligus (dipakai loading state tabel) */
export function createSkeletonRows(count = 5) {
  const wrap = document.createElement('div');
  wrap.className = 'stack';
  for (let i = 0; i < count; i += 1) {
    wrap.appendChild(createSkeleton({ height: '44px', radius: 'var(--radius-md)' }));
  }
  return wrap;
}
