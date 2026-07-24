/**
 * utils.js
 * -----------------------------------------------------------------------
 * Kumpulan pure function reusable: format angka/tanggal, id generator,
 * debounce, validasi, dan helper DOM kecil. Tidak boleh ada logic bisnis
 * atau akses storage di sini.
 * -----------------------------------------------------------------------
 */

import { LOCALE, CURRENCY } from './config.js';

/** Format angka jadi Rupiah, contoh: 1500000 -> "Rp1.500.000" */
export function formatCurrency(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(number);
}

/** Format angka biasa dengan pemisah ribuan */
export function formatNumber(value) {
  return new Intl.NumberFormat(LOCALE).format(Number(value) || 0);
}

/** Format tanggal ISO -> "22 Jul 2026" */
export function formatDate(isoString, options = {}) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(date);
}

/** Format tanggal + jam -> "22 Jul 2026, 14:30" */
export function formatDateTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

/** input[type=date] value helper, default hari ini */
export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

/** ID unik ringkas, contoh: "trx_lq3f9x2k9a1" */
export function generateId(prefix = 'id') {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${random}`;
}

/** Nomor dokumen berurut, contoh: makeDocNumber('INV', 12) -> "INV-0012" */
export function makeDocNumber(prefix, sequence) {
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

/** Debounce standar untuk input pencarian dsb */
export function debounce(fn, delay = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Escape string sebelum disisipkan ke innerHTML (cegah XSS dari input user) */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/** Ambil inisial nama untuk avatar, contoh: "Budi Santoso" -> "BS" */
export function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Clamp angka ke rentang [min, max] */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Jumlahkan field numerik dari array of object */
export function sumBy(items, key) {
  return items.reduce((total, item) => total + (Number(item[key]) || 0), 0);
}

/** Group array by key -> Map */
export function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/** Validasi sederhana: field wajib diisi */
export function required(value) {
  if (value === null || value === undefined) return 'Wajib diisi';
  if (typeof value === 'string' && value.trim() === '') return 'Wajib diisi';
  return null;
}

/** Validasi angka harus > 0 */
export function positiveNumber(value) {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return 'Harus berupa angka lebih dari 0';
  return null;
}

/** Buat elemen DOM dari string HTML (return elemen pertama) */
export function elementFromHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

/** Query helper singkat */
export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

export function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

/** Download string sebagai file (dipakai fitur export/backup) */
export function downloadFile(filename, content, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Baca file input sebagai teks (Promise) */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Baca file input sebagai Data URL (Promise) — untuk preview dokumen/gambar */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Kompres file gambar jadi Data URL JPEG yang lebih kecil (resize + turunkan
 * kualitas) sebelum disimpan sebagai base64 di Realtime Database — supaya
 * ukuran node tetap wajar meski file aslinya foto kamera HP (bisa 5-10MB).
 * @param {File} file
 * @param {{ maxDimension?: number, quality?: number }} [options]
 * @returns {Promise<string>} Data URL JPEG hasil kompresi
 */
export function compressImageToDataUrl(file, { maxDimension = 1600, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Gagal memuat gambar.'));
    };
    img.src = objectUrl;
  });
}
