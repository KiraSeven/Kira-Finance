/**
 * config.js
 * -----------------------------------------------------------------------
 * Konstanta & konfigurasi global. Tidak ada logic di sini — hanya data
 * statis yang dipakai modul lain (app name, kunci storage, role, kategori
 * default, kredensial Firebase).
 * -----------------------------------------------------------------------
 */

export const APP_NAME = 'Kira Finance';
export const APP_VERSION = '1.0.0';
export const CURRENCY = 'IDR';
export const LOCALE = 'id-ID';

/**
 * Konfigurasi Firebase — project "kira-finance-78d0d".
 * Backend aplikasi ini SEPENUHNYA Firebase (Realtime Database + Authentication
 * + Storage) — tidak ada mode lokal/offline lagi. Pastikan sebelum dipakai:
 *  1. Authentication > Sign-in method > Email/Password sudah AKTIF.
 *  2. Realtime Database sudah dibuat.
 *  3. Storage sudah dibuat (untuk lampiran dokumen di menu Dokumen & Bukti).
 *  4. Security Rules RTDB & Storage sudah di-set (lihat catatan di firebase.js).
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAqNWkF0cTqGgdoOZ5x5H5twC6ivPQKKDQ',
  authDomain: 'kira-finance-78d0d.firebaseapp.com',
  databaseURL: 'https://kira-finance-78d0d-default-rtdb.firebaseio.com',
  projectId: 'kira-finance-78d0d',
  storageBucket: 'kira-finance-78d0d.firebasestorage.app',
  messagingSenderId: '712033306610',
  appId: '1:712033306610:web:4d84d943a7dfd1ec150d6b',
};

/** Prefix semua node/key data di Realtime Database supaya tidak bentrok dengan project Firebase lain */
export const STORAGE_PREFIX = 'kira-finance:';

export const STORAGE_KEYS = {
  SESSION: `${STORAGE_PREFIX}session`,
  META: `${STORAGE_PREFIX}meta`,
  USERS: `${STORAGE_PREFIX}users`,
  ACCOUNTS: `${STORAGE_PREFIX}accounts`,
  INCOME: `${STORAGE_PREFIX}income`,
  EXPENSE: `${STORAGE_PREFIX}expense`,
  BUDGET: `${STORAGE_PREFIX}budget`,
  JOURNAL: `${STORAGE_PREFIX}journal`,
  DOCUMENTS: `${STORAGE_PREFIX}documents`,
  SETTINGS: `${STORAGE_PREFIX}settings`,
  LICENSE: `${STORAGE_PREFIX}license`,
  SEQUENCE: `${STORAGE_PREFIX}sequence`,
};

/** Role pengguna & label tampilannya */
export const ROLES = {
  ADMIN: 'admin',
  BENDAHARA: 'bendahara',
  STAFF: 'staff',
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.BENDAHARA]: 'Bendahara',
  [ROLES.STAFF]: 'Staf Tata Usaha',
};

/** Kategori transaksi default (bisa ditambah user lewat Pengaturan) */
export const DEFAULT_INCOME_CATEGORIES = [
  'SPP', 'Uang Pangkal', 'Dana BOS', 'Sumbangan', 'Sewa Kantin', 'Lain-lain',
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Gaji & Honor', 'Operasional', 'Sarana & Prasarana', 'Kegiatan Siswa',
  'Listrik & Internet', 'Konsumsi', 'Lain-lain',
];

export const TRANSACTION_STATUS = {
  DRAFT: 'draft',
  POSTED: 'posted',
  VOID: 'void',
};

export const NAV_GROUPS = [
  {
    label: 'Utama',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: 'grid' },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      { path: '/income', label: 'Pemasukan', icon: 'arrow-down-circle' },
      { path: '/expense', label: 'Pengeluaran', icon: 'arrow-up-circle' },
      { path: '/journal', label: 'Jurnal Umum', icon: 'book' },
    ],
  },
  {
    label: 'Perencanaan',
    items: [
      { path: '/budget', label: 'Anggaran (RAB)', icon: 'target' },
      { path: '/accounts', label: 'Akun Kas & Bank', icon: 'wallet' },
    ],
  },
  {
    label: 'Laporan',
    items: [
      { path: '/reports', label: 'Laporan Keuangan', icon: 'bar-chart' },
      { path: '/documents', label: 'Dokumen & Bukti', icon: 'file' },
    ],
  },
  {
    label: 'Administrasi',
    items: [
      { path: '/users', label: 'Pengguna', icon: 'users' },
      { path: '/settings', label: 'Pengaturan', icon: 'settings' },
      { path: '/license', label: 'Lisensi', icon: 'shield' },
      { path: '/backup', label: 'Backup & Restore', icon: 'database' },
    ],
  },
];

export const ROUTE_PERMISSIONS = {
  '/users': [ROLES.ADMIN],
  '/settings': [ROLES.ADMIN],
  '/license': [ROLES.ADMIN],
  '/backup': [ROLES.ADMIN, ROLES.BENDAHARA],
};
