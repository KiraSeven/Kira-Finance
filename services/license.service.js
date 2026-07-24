/**
 * license.service.js
 * -----------------------------------------------------------------------
 * Manajemen lisensi aplikasi untuk sekolah (nama sekolah, masa aktif,
 * kode lisensi). Validasi dilakukan secara lokal (checksum sederhana) —
 * cukup untuk mengunci penggunaan per-instalasi, BUKAN sistem lisensi
 * server-side yang tidak bisa dibajak. Ganti generateChecksum() dengan
 * pemanggilan API server sungguhan untuk produksi bertingkat enterprise.
 * -----------------------------------------------------------------------
 */

import * as storage from '../js/storage.js';
import { STORAGE_KEYS } from '../js/config.js';

function generateChecksum(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().slice(0, 8);
}

export async function getLicense() {
  return storage.getValue(STORAGE_KEYS.LICENSE, null);
}

/**
 * Aktivasi lisensi lokal. Kode lisensi valid dianggap "KIRA-<checksum
 * dari namaSekolah+expiryDate>". Ini contoh skema sederhana yang bisa
 * diganti dengan validasi server saat aplikasi ini di-deploy nyata.
 */
export async function activateLicense({ schoolName, expiryDate, licenseKey }) {
  const expected = `KIRA-${generateChecksum(schoolName + expiryDate)}`;
  if (licenseKey.trim().toUpperCase() !== expected) {
    throw new Error('Kode lisensi tidak valid untuk data sekolah ini.');
  }

  const license = {
    schoolName,
    expiryDate,
    licenseKey: licenseKey.trim().toUpperCase(),
    activatedAt: new Date().toISOString(),
    status: 'active',
  };
  await storage.setValue(STORAGE_KEYS.LICENSE, license);
  return license;
}

/** Generator kode lisensi (dipakai halaman admin/demo untuk membuat kode) */
export function generateLicenseKey(schoolName, expiryDate) {
  return `KIRA-${generateChecksum(schoolName + expiryDate)}`;
}

export async function getLicenseStatus() {
  const license = await getLicense();
  if (!license) return { status: 'inactive', daysLeft: 0 };

  const today = new Date();
  const expiry = new Date(license.expiryDate);
  const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { status: 'expired', daysLeft, license };
  if (daysLeft <= 30) return { status: 'expiring-soon', daysLeft, license };
  return { status: 'active', daysLeft, license };
}

export async function deactivateLicense() {
  return storage.removeValue(STORAGE_KEYS.LICENSE);
}
